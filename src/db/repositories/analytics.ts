import { getDatabase } from '../database';
import type { ProjectStatus } from '../schema';
import { CAPITAL_SUM_SQL as CAP_SUM, GROSS_CONTRIBUTED_SQL } from './capital';
import { requireCompanyId } from './companies';

export interface ProjectReportRow {
  id: string;
  name: string;
  status: ProjectStatus;
  start_date: string | null;
  created_at: string;
  invested: number;
  spent: number;
}

export async function getProjectReport(): Promise<ProjectReportRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<ProjectReportRow>(
    `SELECT p.id, p.name, p.status, p.start_date, p.created_at,
       COALESCE((SELECT ${GROSS_CONTRIBUTED_SQL} FROM capital_ledger cl
                 JOIN project_investors pi ON pi.id = cl.project_investor_id
                 WHERE pi.project_id = p.id), 0) AS invested,
       COALESCE((SELECT SUM(amount) FROM transactions
                 WHERE project_id = p.id AND direction = 'OUT' AND is_void = 0), 0) AS spent
     FROM projects p WHERE p.company_id = ? ORDER BY p.created_at DESC`,
    requireCompanyId()
  );
}

export interface PnlRow {
  id: string;
  name: string;
  revenue: number;
  expenses: number;
  net: number;
}

export async function getPnl(): Promise<PnlRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; name: string; saleRev: number; otherInc: number; expenses: number }>(
    `SELECT p.id, p.name,
       COALESCE((SELECT SUM(sr.amount) FROM sale_receipts sr JOIN sales s ON s.id = sr.sale_id WHERE s.project_id = p.id AND sr.is_void = 0), 0) AS saleRev,
       COALESCE((SELECT SUM(t.amount) FROM transactions t JOIN categories c ON c.id = t.category_id
                 WHERE t.project_id = p.id AND t.direction = 'IN' AND t.is_void = 0 AND c.name_en = 'Other Income'), 0) AS otherInc,
       COALESCE((SELECT SUM(amount) FROM transactions WHERE project_id = p.id AND direction = 'OUT' AND is_void = 0), 0) AS expenses
     FROM projects p WHERE p.company_id = ? ORDER BY p.created_at DESC`,
    requireCompanyId()
  );
  return rows.map((r) => ({ id: r.id, name: r.name, revenue: r.saleRev + r.otherInc, expenses: r.expenses, net: r.saleRev + r.otherInc - r.expenses }));
}

export interface CashFlowMonth {
  month: string;
  inSum: number;
  outSum: number;
}

/** Monthly money in/out. Account-to-account transfers are excluded. */
export async function getCashFlow(): Promise<CashFlowMonth[]> {
  const db = await getDatabase();
  return db.getAllAsync<CashFlowMonth>(
    `SELECT substr(date, 1, 7) AS month,
       COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0) AS inSum,
       COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) AS outSum
     FROM transactions WHERE is_void = 0 AND transfer_id IS NULL AND company_id = ?
     GROUP BY month ORDER BY month`,
    requireCompanyId()
  );
}

export interface CategorySpendRow {
  nameEn: string;
  nameUr: string;
  total: number;
}

/** Expense by category. Transfers and udhaar movements are not expenses. */
export async function getExpenseByCategory(monthPrefix?: string): Promise<CategorySpendRow[]> {
  const db = await getDatabase();
  const where = monthPrefix ? 'AND t.date LIKE ?' : '';
  const params = monthPrefix ? [`${monthPrefix}%`] : [];
  return db.getAllAsync<CategorySpendRow>(
    `SELECT c.name_en AS nameEn, c.name_ur AS nameUr, COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.direction = 'OUT' AND t.is_void = 0 AND t.company_id = ?
       AND t.transfer_id IS NULL AND t.udhaar_id IS NULL ${where}
     GROUP BY t.category_id ORDER BY total DESC`,
    requireCompanyId(),
    ...params
  );
}

export interface SupplierSpendRow {
  name: string;
  total: number;
}

export async function getTopSuppliers(limit = 5): Promise<SupplierSpendRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<SupplierSpendRow>(
    `SELECT pa.name AS name, COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t JOIN parties pa ON pa.id = t.party_id
     WHERE t.direction = 'OUT' AND t.is_void = 0 AND t.company_id = ?
     GROUP BY t.party_id ORDER BY total DESC LIMIT ?`,
    requireCompanyId(),
    limit
  );
}

export interface InvestmentMatrixRow {
  investorName: string;
  projectName: string;
  committed: number;
  paid: number;
}

export async function getInvestmentMatrix(): Promise<InvestmentMatrixRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<InvestmentMatrixRow>(
    `SELECT inv.name AS investorName, pr.name AS projectName, pi.committed_amount AS committed,
       COALESCE((SELECT ${GROSS_CONTRIBUTED_SQL} FROM capital_ledger cl WHERE cl.project_investor_id = pi.id), 0) AS paid
     FROM project_investors pi
     JOIN investors inv ON inv.id = pi.investor_id
     JOIN projects pr ON pr.id = pi.project_id
     WHERE pr.company_id = ?
     ORDER BY inv.name, pr.name`,
    requireCompanyId()
  );
}

export interface RoiRow {
  id: string;
  name: string;
  profit: number;
  invested: number;
  startDate: string | null;
  roiPct: number;
}

export async function getRoiReport(): Promise<RoiRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; name: string; start_date: string | null; saleRev: number; otherInc: number; expenses: number; grossCapital: number }>(
    `SELECT p.id, p.name, p.start_date,
       COALESCE((SELECT SUM(sr.amount) FROM sale_receipts sr JOIN sales s ON s.id = sr.sale_id WHERE s.project_id = p.id AND sr.is_void = 0), 0) AS saleRev,
       COALESCE((SELECT SUM(t.amount) FROM transactions t JOIN categories c ON c.id = t.category_id
                 WHERE t.project_id = p.id AND t.direction = 'IN' AND t.is_void = 0 AND c.name_en = 'Other Income'), 0) AS otherInc,
       COALESCE((SELECT SUM(amount) FROM transactions WHERE project_id = p.id AND direction = 'OUT' AND is_void = 0), 0) AS expenses,
       COALESCE((SELECT ${GROSS_CONTRIBUTED_SQL} FROM capital_ledger cl
                 JOIN project_investors pi ON pi.id = cl.project_investor_id
                 WHERE pi.project_id = p.id), 0) AS grossCapital
     FROM projects p WHERE p.status = 'COMPLETED' AND p.company_id = ? ORDER BY p.created_at DESC`,
    requireCompanyId()
  );
  return rows.map((r) => {
    const profit = r.saleRev + r.otherInc - r.expenses;
    const invested = r.grossCapital;
    return { id: r.id, name: r.name, profit, invested, startDate: r.start_date, roiPct: invested > 0 ? (profit / invested) * 100 : 0 };
  });
}

/** Cash-flow by account: opening / in / out / balance per active account. */
export interface AccountFlowRow {
  id: string;
  name: string;
  type: string;
  opening: number;
  inSum: number;
  outSum: number;
  balance: number;
}

export async function getAccountFlowReport(): Promise<AccountFlowRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<AccountFlowRow>(
    `SELECT a.id, a.name, a.type, a.opening_balance AS opening,
       COALESCE(SUM(CASE WHEN t.direction = 'IN' AND t.is_void = 0 THEN t.amount ELSE 0 END), 0) AS inSum,
       COALESCE(SUM(CASE WHEN t.direction = 'OUT' AND t.is_void = 0 THEN t.amount ELSE 0 END), 0) AS outSum,
       a.opening_balance + COALESCE(SUM(CASE WHEN t.is_void = 0 THEN
         CASE WHEN t.direction = 'IN' THEN t.amount ELSE -t.amount END ELSE 0 END), 0) AS balance
     FROM accounts a
     LEFT JOIN transactions t ON t.account_id = a.id
     WHERE a.is_archived = 0 AND a.company_id = ?
     GROUP BY a.id
     ORDER BY a.sort_order ASC`,
    requireCompanyId()
  );
}
