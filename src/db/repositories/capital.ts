import { getDatabase } from '../database';
import {
  type CapitalEntryType,
  type CapitalLedgerRow,
  DEFAULT_USER,
  type InvestorRow,
  type ProjectStatus,
} from '../schema';
import { nowISO, uuid } from '../uuid';
import { requireCompanyId } from './companies';

export interface NewCapitalEntry {
  projectInvestorId: string;
  entryType: CapitalEntryType;
  amount: number;
  date: string;
  counterpartyPiId?: string | null;
  valuationAmount?: number | null;
  note?: string | null;
  docId?: string | null;
  createdBy?: string;
}

/**
 * Append a capital-ledger entry. APPEND-ONLY  no update/delete. A correction
 * is recorded as another entry (e.g. a WITHDRAWAL offsetting an ADDITIONAL).
 */
export async function addCapitalEntry(input: NewCapitalEntry): Promise<CapitalLedgerRow> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO capital_ledger
       (id, created_at, created_by, project_investor_id, entry_type, amount, counterparty_pi_id,
        valuation_amount, date, note, doc_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.projectInvestorId,
    input.entryType,
    input.amount,
    input.counterpartyPiId ?? null,
    input.valuationAmount ?? null,
    input.date,
    input.note ?? null,
    input.docId ?? null
  );
  return (await db.getFirstAsync<CapitalLedgerRow>(
    'SELECT * FROM capital_ledger WHERE id = ?',
    id
  ))!;
}

export async function listCapitalEntries(projectInvestorId: string): Promise<CapitalLedgerRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CapitalLedgerRow>(
    'SELECT * FROM capital_ledger WHERE project_investor_id = ? ORDER BY date, created_at',
    projectInvestorId
  );
}

/**
 * SQL expression for net paid-in capital (aliased on `cl`). Capital-affecting
 * entries add or subtract; profit/loss entries (PROFIT_PAYOUT, LOSS_ADJ) are
 * not capital. THE single copy of this accounting rule — analytics imports it
 * too, so the two can never diverge.
 */
export const CAPITAL_SUM_SQL = `SUM(CASE cl.entry_type
    WHEN 'INITIAL'         THEN cl.amount
    WHEN 'ADDITIONAL'      THEN cl.amount
    WHEN 'TRANSFER_IN'     THEN cl.amount
    WHEN 'WITHDRAWAL'      THEN -cl.amount
    WHEN 'TRANSFER_OUT'    THEN -cl.amount
    WHEN 'EXIT_SETTLEMENT' THEN -cl.amount
    ELSE 0 END)`;

const CAPITAL_SUM = `COALESCE(${CAPITAL_SUM_SQL}, 0)`;

/**
 * SQL for GROSS capital contributed (aliased on `cl`): what a participation
 * actually put in, net of transfers/withdrawals between partners but NOT
 * zeroed by EXIT_SETTLEMENT — so settled projects still report the capital
 * that funded them, while an investor exit (leaver TRANSFER_OUT + buyer
 * TRANSFER_IN) doesn't double-count the moved stake.
 */
export const GROSS_CONTRIBUTED_SQL = `SUM(CASE cl.entry_type
    WHEN 'INITIAL'      THEN cl.amount
    WHEN 'ADDITIONAL'   THEN cl.amount
    WHEN 'TRANSFER_IN'  THEN cl.amount
    WHEN 'TRANSFER_OUT' THEN -cl.amount
    WHEN 'WITHDRAWAL'   THEN -cl.amount
    ELSE 0 END)`;

/** Net paid-in capital for one project-investor participation. */
export async function getInvestorCapital(projectInvestorId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ capital: number }>(
    `SELECT ${CAPITAL_SUM} AS capital FROM capital_ledger cl WHERE cl.project_investor_id = ?`,
    projectInvestorId
  );
  return row?.capital ?? 0;
}

export interface OwnershipShare {
  projectInvestorId: string;
  investorId: string;
  name: string;
  capital: number;
  ownershipPct: number;
}

export interface ProjectCapitalSummary {
  totalCapital: number;
  shares: OwnershipShare[];
}

/**
 * Each investor's paid-in capital and live ownership % (capital / total
 * capital) for a project. The percentages sum to 100 (when total > 0).
 */
export async function getProjectCapitalSummary(
  projectId: string
): Promise<ProjectCapitalSummary> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    project_investor_id: string;
    investor_id: string;
    name: string;
    capital: number;
  }>(
    `SELECT pi.id AS project_investor_id, pi.investor_id AS investor_id,
            COALESCE(inv.name, '') AS name, ${CAPITAL_SUM} AS capital
     FROM project_investors pi
     LEFT JOIN investors inv ON inv.id = pi.investor_id
     LEFT JOIN capital_ledger cl ON cl.project_investor_id = pi.id
     WHERE pi.project_id = ?
     GROUP BY pi.id`,
    projectId
  );

  const totalCapital = rows.reduce((sum, r) => sum + r.capital, 0);
  const shares: OwnershipShare[] = rows.map((r) => ({
    projectInvestorId: r.project_investor_id,
    investorId: r.investor_id,
    name: r.name,
    capital: r.capital,
    ownershipPct: totalCapital > 0 ? (r.capital / totalCapital) * 100 : 0,
  }));

  return { totalCapital, shares };
}

/** Total net paid-in capital for an investor across ALL their projects. */
export async function getInvestorTotalCapital(investorId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ capital: number }>(
    `SELECT ${CAPITAL_SUM} AS capital
     FROM capital_ledger cl
     JOIN project_investors pi ON pi.id = cl.project_investor_id
     WHERE pi.investor_id = ?`,
    investorId
  );
  return row?.capital ?? 0;
}

export interface InvestorWithCapital extends InvestorRow {
  /** Received so far (Σ their payment transactions) — their "paid". */
  received: number;
}

/**
 * All investors with how much has been RECEIVED from each (Σ payments), to
 * show against their committed pledge — the plot-style deal/paid/remaining.
 */
export async function listInvestorsWithCapital(): Promise<InvestorWithCapital[]> {
  const db = await getDatabase();
  return db.getAllAsync<InvestorWithCapital>(
    `SELECT inv.*,
       COALESCE((
         SELECT SUM(t.amount) FROM transactions t
         WHERE t.investor_id = inv.id AND t.direction = 'IN' AND t.is_void = 0
       ), 0) AS received
     FROM investors inv
     WHERE inv.company_id = ?
     ORDER BY inv.name`,
    requireCompanyId()
  );
}

export interface InvestorLedgerEntry extends CapitalLedgerRow {
  projectName: string;
}

export interface InvestorProjectReturn {
  projectId: string;
  projectName: string;
  status: ProjectStatus;
  /** Gross capital put in (INITIAL + ADDITIONAL + TRANSFER_IN). */
  invested: number;
  /** Realized profit (PROFIT_PAYOUT − DONATION) − realized loss (LOSS_ADJ). 0 until settled. */
  profitOrLoss: number;
  settled: boolean;
}

/**
 * Per-project history for one investor (every project they're in, incl. settled):
 * how much they put in and their realized profit/loss once the project closed.
 */
export async function getInvestorProjectReturns(investorId: string): Promise<InvestorProjectReturn[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    project_id: string;
    projectName: string;
    status: ProjectStatus;
    pi_status: string;
    invested: number;
    profit: number;
  }>(
    `SELECT pi.project_id, COALESCE(pr.name, '') AS projectName, pr.status,
        pi.status AS pi_status,
        COALESCE(SUM(CASE cl.entry_type
          WHEN 'INITIAL' THEN cl.amount
          WHEN 'ADDITIONAL' THEN cl.amount
          WHEN 'TRANSFER_IN' THEN cl.amount
          ELSE 0 END), 0) AS invested,
        COALESCE(SUM(CASE cl.entry_type
          WHEN 'PROFIT_PAYOUT' THEN cl.amount
          WHEN 'DONATION' THEN -cl.amount
          WHEN 'LOSS_ADJ' THEN -cl.amount
          ELSE 0 END), 0) AS profit
     FROM project_investors pi
     JOIN projects pr ON pr.id = pi.project_id
     LEFT JOIN capital_ledger cl ON cl.project_investor_id = pi.id
     WHERE pi.investor_id = ?
     GROUP BY pi.id
     ORDER BY pr.created_at DESC`,
    investorId
  );
  return rows.map((r) => ({
    projectId: r.project_id,
    projectName: r.projectName,
    status: r.status,
    invested: r.invested,
    profitOrLoss: r.profit,
    settled: r.pi_status === 'SETTLED',
  }));
}

/** Full capital ledger for an investor across projects (newest first). */
export async function listInvestorLedger(investorId: string): Promise<InvestorLedgerEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<InvestorLedgerEntry>(
    `SELECT cl.*, COALESCE(pr.name, '') AS projectName
     FROM capital_ledger cl
     JOIN project_investors pi ON pi.id = cl.project_investor_id
     JOIN projects pr ON pr.id = pi.project_id
     WHERE pi.investor_id = ?
     ORDER BY cl.date DESC, cl.created_at DESC`,
    investorId
  );
}
