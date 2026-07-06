import { getDatabase } from '../database';
import { DEFAULT_USER } from '../schema';
import { nowISO, uuid } from '../uuid';
import { getProjectCapitalSummary } from './capital';
import { listProjectInvestors } from './investors';
import { getSaleSummary } from './sales';

export interface SettlementRow {
  projectInvestorId: string;
  investorId: string;
  name: string;
  capital: number;
  profitPct: number;
  /** + profit share, or − loss share. */
  profitOrLoss: number;
  finalPayout: number;
}

export interface Settlement {
  revenue: number;
  expenses: number;
  net: number;
  isProfit: boolean;
  totalCapital: number;
  rows: SettlementRow[];
}

/**
 * Compute the final settlement for a project (no writes):
 *  - Revenue  = sale receipts + other income
 *  - Expenses = all OUT transactions (investor payouts live in the capital
 *               ledger, not transactions, so they're naturally excluded)
 *  - Net = Revenue − Expenses
 *  - PROFIT → split by each ACTIVE investor's profit %
 *  - LOSS   → split strictly by capital ratio (locked)
 */
export async function computeSettlement(projectId: string): Promise<Settlement> {
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
  const isProfit = net >= 0;

  const summary = await getProjectCapitalSummary(projectId);
  const pis = await listProjectInvestors(projectId);
  const pctById = new Map(pis.map((p) => [p.id, { pct: p.profit_pct ?? 0, status: p.status }]));
  const active = summary.shares.filter((s) => pctById.get(s.projectInvestorId)?.status === 'ACTIVE');
  const totalCapital = active.reduce((s, x) => s + x.capital, 0);

  const rows: SettlementRow[] = active.map((s) => {
    const pct = pctById.get(s.projectInvestorId)?.pct ?? 0;
    const profitOrLoss = isProfit
      ? net * (pct / 100)
      : totalCapital > 0
        ? net * (s.capital / totalCapital) // net is negative → loss share (capital ratio)
        : 0;
    return {
      projectInvestorId: s.projectInvestorId,
      investorId: s.investorId,
      name: s.name,
      capital: s.capital,
      profitPct: pct,
      profitOrLoss,
      finalPayout: s.capital + profitOrLoss,
    };
  });

  return { revenue, expenses, net, isProfit, totalCapital, rows };
}

export interface SettlementSummaryRow {
  investorId: string;
  name: string;
  /** Gross capital the investor put in (INITIAL + ADDITIONAL + TRANSFER_IN). */
  invested: number;
  profitPct: number;
  /** + profit share, or − loss share. */
  profitOrLoss: number;
}

export interface SettlementSummary {
  revenue: number;
  expenses: number;
  net: number;
  isProfit: boolean;
  investorsInvested: number;
  investors: SettlementSummaryRow[];
  /** The project owner is the residual financier (everything not from investors). */
  owner: { invested: number; profitOrLoss: number };
}

/**
 * A completion summary that works WHETHER OR NOT the project is settled (unlike
 * `computeSettlement`, which only counts ACTIVE participations). Capital is the
 * GROSS amount each investor put in (settlement zeroes net capital), profit is
 * projected by the same Musharakah rule used at settlement, and the OWNER is
 * the residual: ownerProfit = net − Σ investorProfit; ownerInvested = cost not
 * funded by investors.
 */
export async function getProjectSettlementSummary(projectId: string): Promise<SettlementSummary> {
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
  const isProfit = net >= 0;

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
  const investors: SettlementSummaryRow[] = invRows.map((r) => {
    const pct = r.profit_pct ?? 0;
    const profitOrLoss = isProfit
      ? net * (pct / 100)
      : investorsInvested > 0
        ? net * (r.invested / investorsInvested)
        : 0;
    return { investorId: r.investor_id, name: r.name, invested: r.invested, profitPct: pct, profitOrLoss };
  });

  const investorsProfit = investors.reduce((s, r) => s + r.profitOrLoss, 0);
  const owner = {
    invested: Math.max(0, expenses - investorsInvested),
    profitOrLoss: net - investorsProfit,
  };

  return { revenue, expenses, net, isProfit, investorsInvested, investors, owner };
}

/**
 * Commit the settlement: append PROFIT_PAYOUT / LOSS_ADJ + EXIT_SETTLEMENT
 * (capital returned) ledger entries per active investor, mark every
 * participation SETTLED, and CLOSE the project. APPEND-ONLY.
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
    await tx.runAsync("UPDATE projects SET stage = 'CLOSED', status = 'COMPLETED' WHERE id = ?", projectId);
  });
}
