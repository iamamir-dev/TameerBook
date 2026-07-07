import { getDatabase } from '../database';
import { DEFAULT_USER } from '../schema';
import { nowISO, uuid } from '../uuid';
import { getProjectCapitalSummary } from './capital';
import { listProjectInvestors } from './investors';
import { getProject } from './projects';
import { getSaleSummary } from './sales';
import { loadSettings } from './settings';

/**
 * Musharakah settlement rules (locked with the owner):
 *  - PROFIT → split by each investor's agreed profit %; the OWNER takes the
 *    residual (net − Σ investor shares).
 *  - LOSS → split strictly by capital ratio across ALL capital providers 
 *    investors AND the owner (owner capital = costs not funded by investors).
 *  - DONATION → a % (Settings, per-project overridable) of each party's
 *    POSITIVE profit, deducted from their payout and pooled for charity.
 *    No donation on loss.
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

/** Revenue = sale receipts + Other Income; expenses = all live OUT rows. */
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

  const revenue = sale.receiptsTotal + (otherIncome?.s ?? 0);
  const expenses = expenseRow?.s ?? 0;
  const net = revenue - expenses;
  return { revenue, expenses, net, isProfit: net >= 0 };
}

export interface SettlementRow {
  projectInvestorId: string;
  investorId: string;
  name: string;
  capital: number;
  profitPct: number;
  /** + profit share, or − loss share (before donation). */
  profitOrLoss: number;
  /** Charity deducted from this party's profit (0 on loss). */
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
  rows: SettlementRow[];
  /** The owner's residual position (not paid out  informational). */
  owner: { capital: number; profitOrLoss: number; donation: number };
}

/**
 * Compute the final settlement for a project (no writes). Covers ACTIVE
 * participations (the ones being paid out). Loss is shared by capital ratio
 * across investors AND the owner's residual capital.
 */
export async function computeSettlement(projectId: string): Promise<Settlement> {
  const pnl = await getProjectPnl(projectId);
  const donationPct = await getDonationPct(projectId);

  const summary = await getProjectCapitalSummary(projectId);
  const pis = await listProjectInvestors(projectId);
  const pctById = new Map(pis.map((p) => [p.id, { pct: p.profit_pct ?? 0, status: p.status }]));
  const active = summary.shares.filter((s) => pctById.get(s.projectInvestorId)?.status === 'ACTIVE');
  const investorCapital = active.reduce((s, x) => s + x.capital, 0);
  // The owner financed whatever the investors didn't.
  const ownerCapital = Math.max(0, pnl.expenses - investorCapital);
  const allCapital = investorCapital + ownerCapital;

  const rows: SettlementRow[] = active.map((s) => {
    const pct = pctById.get(s.projectInvestorId)?.pct ?? 0;
    const profitOrLoss = pnl.isProfit
      ? pnl.net * (pct / 100)
      : allCapital > 0
        ? pnl.net * (s.capital / allCapital) // net negative → loss by capital ratio
        : 0;
    const donation = profitOrLoss > 0 ? profitOrLoss * (donationPct / 100) : 0;
    return {
      projectInvestorId: s.projectInvestorId,
      investorId: s.investorId,
      name: s.name,
      capital: s.capital,
      profitPct: pct,
      profitOrLoss,
      donation,
      finalPayout: s.capital + profitOrLoss - donation,
    };
  });

  const investorsPnl = rows.reduce((s, r) => s + r.profitOrLoss, 0);
  const ownerProfitOrLoss = pnl.net - investorsPnl;
  const ownerDonation = pnl.isProfit && ownerProfitOrLoss > 0 ? ownerProfitOrLoss * (donationPct / 100) : 0;
  const totalDonation = rows.reduce((s, r) => s + r.donation, 0) + ownerDonation;

  return {
    ...pnl,
    totalCapital: investorCapital,
    donationPct,
    totalDonation,
    rows,
    owner: { capital: ownerCapital, profitOrLoss: ownerProfitOrLoss, donation: ownerDonation },
  };
}

export interface SettlementSummaryRow {
  investorId: string;
  name: string;
  /** Gross capital the investor put in (INITIAL + ADDITIONAL + TRANSFER_IN). */
  invested: number;
  profitPct: number;
  /** + profit share, or − loss share (before donation). */
  profitOrLoss: number;
  donation: number;
  /** invested + profitOrLoss − donation. */
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
  /** The project owner is the residual financier (everything not from investors). */
  owner: { invested: number; profitOrLoss: number; donation: number };
}

/**
 * A completion summary that works WHETHER OR NOT the project is settled
 * (unlike `computeSettlement`, which only counts ACTIVE participations).
 * Capital is the GROSS amount each investor put in (settlement zeroes net
 * capital); profit is projected by the same Musharakah rules used at
 * settlement; the OWNER is the residual financier and shares losses by
 * capital ratio like everyone else.
 */
export async function getProjectSettlementSummary(projectId: string): Promise<SettlementSummary> {
  const db = await getDatabase();
  const pnl = await getProjectPnl(projectId);
  const donationPct = await getDonationPct(projectId);

  const invRows = await db.getAllAsync<{ investor_id: string; name: string; profit_pct: number | null; invested: number }>(
    `SELECT pi.investor_id, COALESCE(inv.name, '') AS name, pi.profit_pct,
        COALESCE(SUM(CASE cl.entry_type
          WHEN 'INITIAL' THEN cl.amount
          WHEN 'ADDITIONAL' THEN cl.amount
          WHEN 'TRANSFER_IN' THEN cl.amount
          ELSE 0 END), 0) AS invested
     FROM project_investors pi
     LEFT JOIN investors inv ON inv.id = pi.investor_id
     LEFT JOIN capital_ledger cl ON cl.project_investor_id = pi.id
     WHERE pi.project_id = ?
     GROUP BY pi.id`,
    projectId
  );

  const investorsInvested = invRows.reduce((s, r) => s + r.invested, 0);
  const ownerInvested = Math.max(0, pnl.expenses - investorsInvested);
  const allCapital = investorsInvested + ownerInvested;

  const investors: SettlementSummaryRow[] = invRows.map((r) => {
    const pct = r.profit_pct ?? 0;
    const profitOrLoss = pnl.isProfit
      ? pnl.net * (pct / 100)
      : allCapital > 0
        ? pnl.net * (r.invested / allCapital)
        : 0;
    const donation = profitOrLoss > 0 ? profitOrLoss * (donationPct / 100) : 0;
    return {
      investorId: r.investor_id,
      name: r.name,
      invested: r.invested,
      profitPct: pct,
      profitOrLoss,
      donation,
      finalPayout: r.invested + profitOrLoss - donation,
    };
  });

  const investorsPnl = investors.reduce((s, r) => s + r.profitOrLoss, 0);
  const ownerProfitOrLoss = pnl.net - investorsPnl;
  const ownerDonation = pnl.isProfit && ownerProfitOrLoss > 0 ? ownerProfitOrLoss * (donationPct / 100) : 0;
  const totalDonation = investors.reduce((s, r) => s + r.donation, 0) + ownerDonation;

  return {
    ...pnl,
    donationPct,
    totalDonation,
    investorsInvested,
    investors,
    owner: { invested: ownerInvested, profitOrLoss: ownerProfitOrLoss, donation: ownerDonation },
  };
}

/**
 * Commit the settlement: per active investor append PROFIT_PAYOUT / LOSS_ADJ,
 * a DONATION deduction (charity pool), and EXIT_SETTLEMENT (capital returned);
 * mark every participation SETTLED and COMPLETE the project. APPEND-ONLY.
 */
export async function settleProject(projectId: string, createdBy: string = DEFAULT_USER): Promise<void> {
  const db = await getDatabase();
  const settlement = await computeSettlement(projectId);
  const createdAt = nowISO();
  const date = nowISO().slice(0, 10);

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const r of settlement.rows) {
      // Profit / loss record (does not affect capital).
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
      // Charity deducted from this investor's profit share.
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
    await tx.runAsync("UPDATE projects SET status = 'COMPLETED' WHERE id = ?", projectId);
  });
}
