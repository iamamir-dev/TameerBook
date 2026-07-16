import {
  computeDistribution,
  OWNER_PARTICIPANT_ID,
  type DistributionResult,
  type DistributionRule,
  type ParticipantInput,
} from '../../utils/settlementMath';
import { getDatabase } from '../database';
import { DEFAULT_USER } from '../schema';
import { nowISO, uuid } from '../uuid';
import { getProjectCapitalSummary, GROSS_CONTRIBUTED_SQL } from './capital';
import { ProjectClosedError } from './guards';
import { listProjectInvestors } from './investors';
import { getProjectLaborTotals } from './labor';
import { getProject } from './projects';
import { getSaleSummary } from './sales';
import { loadSettings } from './settings';

/**
 * Settlement engine v2 (Shariah-based, decided at settle time):
 *  - Ownership is computed FIRST from real capital (owner = residual financier).
 *  - PROFIT splits by the rule the partners choose in the Settle Up wizard
 *    (ownership / agreed % / owner-first / pehla munafa / manual) — mutual
 *    consent on REALIZED profit, so nothing was guaranteed upfront.
 *  - LOSS always splits by capital ratio (rule ignored) — Shariah mandate.
 *  - SADAQAH: a % of profit off the top; persisted PROFIT_PAYOUT rows stay
 *    GROSS (share + its sadaqah slice) so ledger rollups are unchanged.
 * All math lives in src/utils/settlementMath.ts (pure, unit-tested).
 */

/** The donation % that applies to a project (project override → Settings). */
export async function getDonationPct(projectId: string): Promise<number> {
  const project = await getProject(projectId);
  if (project?.donation_pct != null) return project.donation_pct;
  try {
    const s = await loadSettings();
    const pct = Number(s.donationPct);
    return Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  } catch {
    return 0;
  }
}

interface ProjectPnl {
  revenue: number;
  expenses: number;
  net: number;
  isProfit: boolean;
}

/**
 * Revenue = sale receipts + Other Income; expenses = all live OUT rows PLUS
 * wages accrued but not yet paid. Without the unpaid-wage accrual the P&L
 * overstates profit and `settleProject` would pay investors money that is
 * still owed to workers (the cash OUT only lands when the worker is paid).
 */
async function getProjectPnl(projectId: string): Promise<ProjectPnl> {
  const db = await getDatabase();
  const sale = await getSaleSummary(projectId);
  const otherIncome = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(t.amount), 0) AS s
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.project_id = ? AND t.direction = 'IN' AND t.is_void = 0 AND c.name_en = 'Other Income'`,
    projectId
  );
  const expenseRow = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS s
     FROM transactions WHERE project_id = ? AND direction = 'OUT' AND is_void = 0`,
    projectId
  );
  const labor = await getProjectLaborTotals(projectId);

  const revenue = sale.receiptsTotal + (otherIncome?.s ?? 0);
  const expenses = (expenseRow?.s ?? 0) + Math.max(0, labor.outstanding);
  const net = revenue - expenses;
  return { revenue, expenses, net, isProfit: net >= 0 };
}

export interface SettlementRow {
  /** '__OWNER__' for the owner's residual row. */
  projectInvestorId: string;
  investorId: string;
  name: string;
  isOwner: boolean;
  capital: number;
  /** Capital ÷ total capital × 100 — the ownership share shown in step 1. */
  ownershipPct: number;
  /** GROSS + profit share (incl. sadaqah slice) or − loss share. */
  profitOrLoss: number;
  /** Sadaqah deducted from this party's profit (0 on loss). */
  donation: number;
  /** capital + profitOrLoss − donation. */
  finalPayout: number;
}

export interface Settlement {
  revenue: number;
  expenses: number;
  net: number;
  isProfit: boolean;
  totalCapital: number;
  donationPct: number;
  totalDonation: number;
  /** net − totalDonation — what the chosen rule divides. */
  distributable: number;
  /** ALL participants — investors first, owner last. */
  rows: SettlementRow[];
  /** Validation problems with the chosen rule's inputs (empty = valid). */
  errors: DistributionResult['errors'];
  rule: DistributionRule;
}

/** Load ACTIVE participations + the owner as math-module participants. */
async function loadParticipants(projectId: string, expenses: number): Promise<{
  participants: ParticipantInput[];
  meta: Map<string, { projectInvestorId: string; investorId: string }>;
}> {
  const summary = await getProjectCapitalSummary(projectId);
  const pis = await listProjectInvestors(projectId);
  const statusById = new Map(pis.map((p) => [p.id, p.status]));
  const active = summary.shares.filter((s) => statusById.get(s.projectInvestorId) === 'ACTIVE');
  const investorCapital = active.reduce((s, x) => s + x.capital, 0);
  const ownerCapital = Math.max(0, expenses - investorCapital);

  const meta = new Map<string, { projectInvestorId: string; investorId: string }>();
  const participants: ParticipantInput[] = active.map((s) => {
    meta.set(s.projectInvestorId, { projectInvestorId: s.projectInvestorId, investorId: s.investorId });
    return { id: s.projectInvestorId, name: s.name, capital: s.capital, isOwner: false };
  });
  participants.push({ id: OWNER_PARTICIPANT_ID, name: '', capital: ownerCapital, isOwner: true });
  return { participants, meta };
}

/**
 * Compute the settlement for a project under a chosen rule (no writes).
 * Default rule = by-ownership (Musharakah pro-rata).
 */
export async function computeSettlement(
  projectId: string,
  rule: DistributionRule = { kind: 'ownership' },
  donationPctOverride?: number
): Promise<Settlement> {
  const pnl = await getProjectPnl(projectId);
  const donationPct = donationPctOverride ?? (await getDonationPct(projectId));
  const { participants, meta } = await loadParticipants(projectId, pnl.expenses);

  const dist = computeDistribution({ participants, net: pnl.net, donationPct, rule });

  const rows: SettlementRow[] = dist.rows.map((r) => ({
    projectInvestorId: r.id,
    investorId: r.isOwner ? OWNER_PARTICIPANT_ID : meta.get(r.id)?.investorId ?? r.id,
    name: r.name,
    isOwner: r.isOwner,
    capital: r.capital,
    ownershipPct: r.ownershipPct,
    profitOrLoss: r.profitOrLoss,
    donation: r.donation,
    finalPayout: r.payout,
  }));

  return {
    ...pnl,
    totalCapital: dist.totalCapital,
    donationPct: dist.donationPct,
    totalDonation: dist.totalDonation,
    distributable: dist.distributable,
    rows,
    errors: dist.errors,
    rule,
  };
}

export interface SettlementSummaryRow {
  investorId: string;
  name: string;
  /** Gross capital the party put in (INITIAL + ADDITIONAL + TRANSFER_IN). */
  invested: number;
  ownershipPct: number;
  /** Projected (by-ownership) + profit / − loss share, gross. */
  profitOrLoss: number;
  donation: number;
  finalPayout: number;
}

export interface SettlementSummary {
  revenue: number;
  expenses: number;
  net: number;
  isProfit: boolean;
  donationPct: number;
  totalDonation: number;
  investorsInvested: number;
  investors: SettlementSummaryRow[];
  /** The project owner is the residual financier. */
  owner: { invested: number; ownershipPct: number; profitOrLoss: number; donation: number };
}

/**
 * A live summary that works WHETHER OR NOT the project is settled. Capital is
 * the GROSS amount each investor put in (settlement zeroes net capital); the
 * projection uses the default by-ownership rule — the actual division is
 * whatever the user picks in the Settle Up wizard.
 */
export async function getProjectSettlementSummary(projectId: string): Promise<SettlementSummary> {
  const db = await getDatabase();
  const pnl = await getProjectPnl(projectId);
  const donationPct = await getDonationPct(projectId);

  const invRows = await db.getAllAsync<{ investor_id: string; name: string; invested: number }>(
    `SELECT pi.investor_id, COALESCE(inv.name, '') AS name,
        COALESCE(${GROSS_CONTRIBUTED_SQL}, 0) AS invested
     FROM project_investors pi
     LEFT JOIN investors inv ON inv.id = pi.investor_id
     LEFT JOIN capital_ledger cl ON cl.project_investor_id = pi.id
     WHERE pi.project_id = ?
     GROUP BY pi.id`,
    projectId
  );

  const investorsInvested = invRows.reduce((s, r) => s + r.invested, 0);
  const ownerInvested = Math.max(0, pnl.expenses - investorsInvested);

  const participants: ParticipantInput[] = [
    ...invRows.map((r) => ({ id: r.investor_id, name: r.name, capital: r.invested, isOwner: false })),
    { id: OWNER_PARTICIPANT_ID, name: '', capital: ownerInvested, isOwner: true },
  ];
  const dist = computeDistribution({ participants, net: pnl.net, donationPct, rule: { kind: 'ownership' } });

  const byId = new Map(dist.rows.map((r) => [r.id, r]));
  const investors: SettlementSummaryRow[] = invRows.map((r) => {
    const d = byId.get(r.investor_id)!;
    return {
      investorId: r.investor_id,
      name: r.name,
      invested: r.invested,
      ownershipPct: d.ownershipPct,
      profitOrLoss: d.profitOrLoss,
      donation: d.donation,
      finalPayout: d.payout,
    };
  });
  const ownerRow = dist.rows.find((r) => r.isOwner)!;

  return {
    ...pnl,
    donationPct,
    totalDonation: dist.totalDonation,
    investorsInvested,
    investors,
    owner: {
      invested: ownerInvested,
      ownershipPct: ownerRow.ownershipPct,
      profitOrLoss: ownerRow.profitOrLoss,
      donation: ownerRow.donation,
    },
  };
}

export interface ProjectDistributionRow {
  investorId: string;
  name: string;
  invested: number;
  profit: number;
  lossAdj: number;
  donation: number;
  capitalBack: number;
}

export interface ProjectDistribution {
  /** Parsed rule kind stored at settlement (null = settled before v2). */
  ruleKind: DistributionRule['kind'] | null;
  settledAt: string | null;
  rows: ProjectDistributionRow[];
}

/** What actually happened at settlement — per-investor ledger rollup (khata). */
export async function getProjectDistribution(projectId: string): Promise<ProjectDistribution> {
  const db = await getDatabase();
  const project = await getProject(projectId);
  const rows = await db.getAllAsync<ProjectDistributionRow>(
    `SELECT pi.investor_id AS investorId, COALESCE(inv.name, '') AS name,
        COALESCE(SUM(CASE WHEN cl.entry_type IN ('INITIAL','ADDITIONAL','TRANSFER_IN') THEN cl.amount ELSE 0 END), 0) AS invested,
        COALESCE(SUM(CASE WHEN cl.entry_type = 'PROFIT_PAYOUT' THEN cl.amount ELSE 0 END), 0) AS profit,
        COALESCE(SUM(CASE WHEN cl.entry_type = 'LOSS_ADJ' THEN cl.amount ELSE 0 END), 0) AS lossAdj,
        COALESCE(SUM(CASE WHEN cl.entry_type = 'DONATION' THEN cl.amount ELSE 0 END), 0) AS donation,
        COALESCE(SUM(CASE WHEN cl.entry_type = 'EXIT_SETTLEMENT' THEN cl.amount ELSE 0 END), 0) AS capitalBack
     FROM project_investors pi
     LEFT JOIN investors inv ON inv.id = pi.investor_id
     LEFT JOIN capital_ledger cl ON cl.project_investor_id = pi.id
     WHERE pi.project_id = ?
     GROUP BY pi.id`,
    projectId
  );
  let ruleKind: ProjectDistribution['ruleKind'] = null;
  if (project?.settle_rule) ruleKind = project.settle_rule as DistributionRule['kind'];
  return { ruleKind, settledAt: project?.settled_at ?? null, rows };
}

/**
 * Commit the settlement under the chosen rule: per active investor append
 * PROFIT_PAYOUT / LOSS_ADJ (gross), DONATION (sadaqah), EXIT_SETTLEMENT
 * (capital returned) — these land in each investor's KHATA — mark every
 * participation SETTLED, stamp the rule on the project, COMPLETE it.
 * APPEND-ONLY. Allowed while ACTIVE, or after "Mark completed" as long as the
 * project was never settled (settled_at guards double-settlement).
 */
export async function settleProject(
  projectId: string,
  rule: DistributionRule = { kind: 'ownership' },
  opts: { donationPct?: number; createdBy?: string } = {}
): Promise<void> {
  const db = await getDatabase();
  const project = await getProject(projectId);
  if (!project) throw new Error(`settleProject: project ${projectId} not found`);
  const settleable =
    project.status === 'ACTIVE' || (project.status === 'COMPLETED' && project.settled_at == null);
  if (!settleable) throw new ProjectClosedError(projectId, project.status);

  const settlement = await computeSettlement(projectId, rule, opts.donationPct);
  if (settlement.errors.length > 0) {
    throw new Error(`settleProject: invalid rule inputs (${settlement.errors.map((e) => e.code).join(', ')})`);
  }
  const createdBy = opts.createdBy ?? DEFAULT_USER;
  const createdAt = nowISO();
  const date = nowISO().slice(0, 10);

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const r of settlement.rows) {
      if (r.isOwner) continue; // owner has no PI row — informational only
      // Profit / loss record (does not affect capital) — the investor's khata.
      if (Math.abs(r.profitOrLoss) > 0.001) {
        await tx.runAsync(
          `INSERT INTO capital_ledger
             (id, created_at, created_by, project_investor_id, entry_type, amount, counterparty_pi_id, valuation_amount, date, note, doc_id)
           VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL)`,
          uuid(),
          createdAt,
          createdBy,
          r.projectInvestorId,
          settlement.isProfit ? 'PROFIT_PAYOUT' : 'LOSS_ADJ',
          Math.abs(r.profitOrLoss),
          date
        );
      }
      // Sadaqah deducted from this investor's profit share.
      if (r.donation > 0.001) {
        await tx.runAsync(
          `INSERT INTO capital_ledger
             (id, created_at, created_by, project_investor_id, entry_type, amount, counterparty_pi_id, valuation_amount, date, note, doc_id)
           VALUES (?, ?, ?, ?, 'DONATION', ?, NULL, NULL, ?, 'Charity (shariah)', NULL)`,
          uuid(),
          createdAt,
          createdBy,
          r.projectInvestorId,
          r.donation,
          date
        );
      }
      // Return capital (reduces capital to zero).
      if (r.capital > 0.001) {
        await tx.runAsync(
          `INSERT INTO capital_ledger
             (id, created_at, created_by, project_investor_id, entry_type, amount, counterparty_pi_id, valuation_amount, date, note, doc_id)
           VALUES (?, ?, ?, ?, 'EXIT_SETTLEMENT', ?, NULL, NULL, ?, NULL, NULL)`,
          uuid(),
          createdAt,
          createdBy,
          r.projectInvestorId,
          r.capital,
          date
        );
      }
      await tx.runAsync(
        "UPDATE project_investors SET status = 'SETTLED', exited_at = ? WHERE id = ?",
        date,
        r.projectInvestorId
      );
    }
    // Stamp how it was divided + the double-settle marker, and complete.
    const { kind, ...params } = rule as DistributionRule & Record<string, unknown>;
    await tx.runAsync(
      "UPDATE projects SET status = 'COMPLETED', settle_rule = ?, settle_params = ?, settled_at = ? WHERE id = ?",
      kind,
      JSON.stringify({ ...params, donationPct: settlement.donationPct }),
      createdAt,
      projectId
    );
    // The settled project's plot is sold with it — it must never be offered
    // to a future project.
    await tx.runAsync(
      "UPDATE plots SET status = 'SOLD' WHERE project_id = ? AND status = 'IN_PROJECT'",
      projectId
    );
  });
}
