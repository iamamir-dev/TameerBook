import { getDatabase } from '../database';
import {
  type CapitalEntryType,
  type CapitalLedgerRow,
  DEFAULT_USER,
  type InvestorRow,
  type ProjectStatus,
  type TransactionRow,
} from '../schema';
import { nowISO, uuid } from '../uuid';
import { requireCompanyId } from './companies';

/** Note marker on a capital_ledger stake funded from the investor's balance
 *  (no cash transaction) — see `investFromBalance`. Used to include it in the
 *  activity feed without double-counting cash-funded stakes. */
export const FROM_BALANCE_NOTE = 'FROM_BALANCE';

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
  /** Received so far (Σ their IN payment transactions). */
  received: number;
  /** Realized profit across settled projects. */
  profit: number;
  /** Total standing = received + profit − paidOut (folds profit into the total). */
  total: number;
}

/**
 * All investors with their standing: cash received, realized profit, and the
 * profit-inclusive total (so the list shows the same "Total" as the profile,
 * not just cash-in). Ordered by name.
 */
export async function listInvestorsWithCapital(): Promise<InvestorWithCapital[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<InvestorRow & { received: number; paidOut: number; profit: number }>(
    `SELECT inv.*,
       COALESCE((SELECT SUM(t.amount) FROM transactions t
         WHERE t.investor_id = inv.id AND t.direction = 'IN' AND t.is_void = 0), 0) AS received,
       COALESCE((SELECT SUM(t.amount) FROM transactions t
         WHERE t.investor_id = inv.id AND t.direction = 'OUT' AND t.is_void = 0), 0) AS paidOut,
       COALESCE((SELECT SUM(CASE cl.entry_type
            WHEN 'PROFIT_PAYOUT' THEN cl.amount
            WHEN 'DONATION'      THEN -cl.amount
            WHEN 'LOSS_ADJ'      THEN -cl.amount
            ELSE 0 END)
          FROM capital_ledger cl
          JOIN project_investors pi ON pi.id = cl.project_investor_id
          WHERE pi.investor_id = inv.id), 0) AS profit
     FROM investors inv
     WHERE inv.company_id = ?
     ORDER BY inv.name`,
    requireCompanyId()
  );
  return rows.map(({ paidOut, ...r }) => ({
    ...r,
    total: r.received + r.profit - paidOut,
  }));
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

/** One row of the investor's unified activity feed. */
export interface InvestorActivityRow {
  id: string;
  date: string;
  amount: number;
  direction: 'in' | 'out';
  /** Display key: a capital entry_type, or 'TXN_IN' / 'TXN_OUT' for cash rows. */
  entryType: string;
  projectName: string;
  /** Present for cash rows → enables the detail sheet + in-place edit. */
  txn: TransactionRow | null;
  editable: boolean;
}

const ACCOUNTING_TYPES = "'PROFIT_PAYOUT','DONATION','EXIT_SETTLEMENT','LOSS_ADJ'";

/**
 * The investor's unified activity feed for the reusable `ActivityList`: their
 * real cash transactions (editable, with the rich detail sheet) MERGED with the
 * view-only settlement/accounting entries (profit / donation / exit) and any
 * "from balance" stakes — WITHOUT double-counting cash-funded stakes (those show
 * once, as their IN transaction). Newest first.
 */
export async function listInvestorActivity(investorId: string): Promise<InvestorActivityRow[]> {
  const db = await getDatabase();

  const txns = await db.getAllAsync<TransactionRow & { projectName: string }>(
    `SELECT t.*, COALESCE(pr.name, '') AS projectName
     FROM transactions t
     LEFT JOIN projects pr ON pr.id = t.project_id
     WHERE t.investor_id = ? AND t.is_void = 0`,
    investorId
  );

  const caps = await db.getAllAsync<CapitalLedgerRow & { projectName: string }>(
    `SELECT cl.*, COALESCE(pr.name, '') AS projectName
     FROM capital_ledger cl
     JOIN project_investors pi ON pi.id = cl.project_investor_id
     JOIN projects pr ON pr.id = pi.project_id
     WHERE pi.investor_id = ?
       AND (cl.entry_type IN (${ACCOUNTING_TYPES})
            OR (cl.entry_type IN ('INITIAL','ADDITIONAL') AND cl.note = '${FROM_BALANCE_NOTE}'))`,
    investorId
  );

  const CAP_POSITIVE = new Set(['INITIAL', 'ADDITIONAL', 'TRANSFER_IN', 'PROFIT_PAYOUT']);

  const txnRows: InvestorActivityRow[] = txns.map((row) => {
    const { projectName, ...txn } = row;
    return {
      id: row.id,
      date: row.date,
      amount: row.amount,
      direction: row.direction === 'IN' ? 'in' : 'out',
      entryType: row.direction === 'IN' ? 'TXN_IN' : 'TXN_OUT',
      projectName,
      txn: txn as TransactionRow,
      editable: true,
    };
  });

  const capRows: InvestorActivityRow[] = caps.map((c) => ({
    id: c.id,
    date: c.date,
    amount: c.amount,
    direction: CAP_POSITIVE.has(c.entry_type) ? 'in' : 'out',
    entryType: c.entry_type,
    projectName: c.projectName,
    txn: null,
    editable: false,
  }));

  return [...txnRows, ...capRows].sort((a, b) => {
    if (a.date === b.date) return 0;
    return a.date < b.date ? 1 : -1;
  });
}
