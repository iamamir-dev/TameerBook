import { getDatabase } from '../database';
import type { ProjectStage } from '../schema';

/** Signed capital sum (matches the capital ledger rules). */
const CAP_SUM = `SUM(CASE cl.entry_type
    WHEN 'INITIAL' THEN cl.amount
    WHEN 'ADDITIONAL' THEN cl.amount
    WHEN 'TRANSFER_IN' THEN cl.amount
    WHEN 'WITHDRAWAL' THEN -cl.amount
    WHEN 'TRANSFER_OUT' THEN -cl.amount
    WHEN 'EXIT_SETTLEMENT' THEN -cl.amount
    ELSE 0 END)`;

export interface ProjectReportRow {
  id: string;
  name: string;
  stage: ProjectStage;
  start_date: string | null;
  created_at: string;
  invested: number;
  spent: number;
}

export async function getProjectReport(): Promise<ProjectReportRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<ProjectReportRow>(
    `SELECT p.id, p.name, p.stage, p.start_date, p.created_at,
       COALESCE((SELECT ${CAP_SUM} FROM capital_ledger cl
                 JOIN project_investors pi ON pi.id = cl.project_investor_id
                 WHERE pi.project_id = p.id), 0) AS invested,
       COALESCE((SELECT SUM(amount) FROM transactions
                 WHERE project_id = p.id AND direction = 'OUT' AND is_void = 0), 0) AS spent
     FROM projects p ORDER BY p.created_at DESC`
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
       COALESCE((SELECT SUM(sr.amount) FROM sale_receipts sr JOIN sales s ON s.id = sr.sale_id WHERE s.project_id = p.id), 0) AS saleRev,
       COALESCE((SELECT SUM(t.amount) FROM transactions t JOIN categories c ON c.id = t.category_id
                 WHERE t.project_id = p.id AND t.direction = 'IN' AND t.is_void = 0 AND c.name_en = 'Other Income'), 0) AS otherInc,
       COALESCE((SELECT SUM(amount) FROM transactions WHERE project_id = p.id AND direction = 'OUT' AND is_void = 0), 0) AS expenses
     FROM projects p ORDER BY p.created_at DESC`
  );
  return rows.map((r) => ({ id: r.id, name: r.name, revenue: r.saleRev + r.otherInc, expenses: r.expenses, net: r.saleRev + r.otherInc - r.expenses }));
}

export interface CashFlowMonth {
  month: string;
  inSum: number;
  outSum: number;
}

export async function getCashFlow(): Promise<CashFlowMonth[]> {
  const db = await getDatabase();
  return db.getAllAsync<CashFlowMonth>(
    `SELECT substr(date, 1, 7) AS month,
       COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0) AS inSum,
       COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) AS outSum
     FROM transactions WHERE is_void = 0 GROUP BY month ORDER BY month`
  );
}

export interface CategorySpendRow {
  nameEn: string;
  nameUr: string;
  total: number;
}

export async function getExpenseByCategory(monthPrefix?: string): Promise<CategorySpendRow[]> {
  const db = await getDatabase();
  const where = monthPrefix ? "AND t.date LIKE ?" : '';
  const params = monthPrefix ? [`${monthPrefix}%`] : [];
  return db.getAllAsync<CategorySpendRow>(
    `SELECT c.name_en AS nameEn, c.name_ur AS nameUr, COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.direction = 'OUT' AND t.is_void = 0 ${where}
     GROUP BY t.category_id ORDER BY total DESC`,
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
     WHERE t.direction = 'OUT' AND t.is_void = 0
     GROUP BY t.party_id ORDER BY total DESC LIMIT ?`,
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
       COALESCE((SELECT ${CAP_SUM} FROM capital_ledger cl WHERE cl.project_investor_id = pi.id), 0) AS paid
     FROM project_investors pi
     JOIN investors inv ON inv.id = pi.investor_id
     JOIN projects pr ON pr.id = pi.project_id
     ORDER BY inv.name, pr.name`
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
       COALESCE((SELECT SUM(sr.amount) FROM sale_receipts sr JOIN sales s ON s.id = sr.sale_id WHERE s.project_id = p.id), 0) AS saleRev,
       COALESCE((SELECT SUM(t.amount) FROM transactions t JOIN categories c ON c.id = t.category_id
                 WHERE t.project_id = p.id AND t.direction = 'IN' AND t.is_void = 0 AND c.name_en = 'Other Income'), 0) AS otherInc,
       COALESCE((SELECT SUM(amount) FROM transactions WHERE project_id = p.id AND direction = 'OUT' AND is_void = 0), 0) AS expenses,
       COALESCE((SELECT SUM(cl.amount) FROM capital_ledger cl
                 JOIN project_investors pi ON pi.id = cl.project_investor_id
                 WHERE pi.project_id = p.id AND cl.entry_type IN ('INITIAL', 'ADDITIONAL', 'TRANSFER_IN')), 0) AS grossCapital
     FROM projects p WHERE p.stage = 'CLOSED' ORDER BY p.created_at DESC`
  );
  return rows.map((r) => {
    const profit = r.saleRev + r.otherInc - r.expenses;
    const invested = r.grossCapital;
    return { id: r.id, name: r.name, profit, invested, startDate: r.start_date, roiPct: invested > 0 ? (profit / invested) * 100 : 0 };
  });
}
