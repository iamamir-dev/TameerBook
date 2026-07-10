import { getDatabase } from '../database';
import {
  DEFAULT_USER,
  type PayType,
  type TransactionRow,
  type TxnDirection,
  type TxnPhase,
} from '../schema';
import { nowISO, uuid } from '../uuid';
import { requireCompanyId } from './companies';

export interface NewTransaction {
  direction: TxnDirection;
  amount: number;
  date: string;
  /** The account the money moved through (required for real cash movements). */
  accountId?: string | null;
  projectId?: string | null;
  plotId?: string | null;
  phase?: TxnPhase | null;
  categoryId?: string | null;
  partyId?: string | null;
  /** Free-text counterparty (e.g. an udhaar person not saved as a party). */
  counterpartyName?: string | null;
  payType?: PayType | null;
  transferId?: string | null;
  udhaarId?: string | null;
  laborId?: string | null;
  investorId?: string | null;
  description?: string | null;
  docId?: string | null;
  createdBy?: string;
}

/** Thrown when an OUT payment exceeds the paying account's live balance. */
export class InsufficientFundsError extends Error {
  constructor(
    public readonly accountId: string,
    public readonly balance: number,
    public readonly requested: number
  ) {
    super('INSUFFICIENT_FUNDS');
    this.name = 'InsufficientFundsError';
  }
}

/** True when an error from a save action is the insufficient-balance guard. */
export function isInsufficientFunds(e: unknown): e is InsufficientFundsError {
  return e instanceof Error && e.message === 'INSUFFICIENT_FUNDS';
}

/** Thrown when a payment exceeds what is still owed (deal remaining / outstanding / udhaar balance). */
export class LimitExceededError extends Error {
  constructor(
    public readonly limit: number,
    public readonly requested: number
  ) {
    super('LIMIT_EXCEEDED');
    this.name = 'LimitExceededError';
  }
}

/** True when an error from a save action is the over-limit guard. */
export function isLimitExceeded(e: unknown): e is LimitExceededError {
  return e instanceof Error && e.message === 'LIMIT_EXCEEDED';
}

/**
 * Append a transaction. The ledger is APPEND-ONLY  there is intentionally no
 * update or delete function. Corrections go through `voidTransaction`.
 *
 * VALIDATION: money can only leave an account that actually holds it  an
 * OUT posting greater than the account's live balance throws
 * `InsufficientFundsError` (reversals bypass this via their own raw insert).
 */
export async function addTransaction(input: NewTransaction): Promise<TransactionRow> {
  const db = await getDatabase();

  if (input.direction === 'OUT' && input.accountId) {
    const row = await db.getFirstAsync<{ balance: number }>(
      `SELECT a.opening_balance + COALESCE(SUM(
         CASE WHEN t.direction = 'IN' THEN t.amount
              WHEN t.direction = 'OUT' THEN -t.amount
              ELSE 0 END), 0) AS balance
       FROM accounts a
       LEFT JOIN transactions t ON t.account_id = a.id AND t.is_void = 0
       WHERE a.id = ?
       GROUP BY a.id`,
      input.accountId
    );
    const balance = row?.balance ?? 0;
    if (input.amount > balance + 0.001) {
      throw new InsufficientFundsError(input.accountId, balance, input.amount);
    }
  }

  const id = uuid();
  await db.runAsync(
    `INSERT INTO transactions
       (id, created_at, created_by, company_id, direction, amount, date, account_id, project_id, plot_id,
        phase, category_id, party_id, counterparty_name, pay_type, transfer_id, udhaar_id,
        labor_id, investor_id, description, doc_id, is_void, void_of_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    requireCompanyId(),
    input.direction,
    input.amount,
    input.date,
    input.accountId ?? null,
    input.projectId ?? null,
    input.plotId ?? null,
    input.phase ?? null,
    input.categoryId ?? null,
    input.partyId ?? null,
    input.counterpartyName ?? null,
    input.payType ?? null,
    input.transferId ?? null,
    input.udhaarId ?? null,
    input.laborId ?? null,
    input.investorId ?? null,
    input.description ?? null,
    input.docId ?? null
  );
  return getTransaction(id) as Promise<TransactionRow>;
}

export async function getTransaction(id: string): Promise<TransactionRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<TransactionRow>('SELECT * FROM transactions WHERE id = ?', id);
}

/**
 * Void a transaction WITHOUT deleting it: appends a mirror-image reversal row
 * (opposite direction, same account/links, linked via `void_of_id`) and flags
 * the original `is_void = 1`. Both are excluded from balances (which filter
 * `is_void = 0`), so the original's effect  including its account balance
 * effect  is cleanly cancelled while the full history is preserved for audit.
 *
 * Returns the newly created reversal row.
 */
export async function voidTransaction(
  id: string,
  createdBy: string = DEFAULT_USER
): Promise<TransactionRow> {
  const db = await getDatabase();
  const original = await getTransaction(id);
  if (!original) throw new Error(`voidTransaction: transaction ${id} not found`);
  if (original.is_void === 1) throw new Error(`voidTransaction: ${id} is already void`);
  if (original.void_of_id) throw new Error(`voidTransaction: cannot void a reversal row`);

  const reversalId = uuid();
  const reversalDir: TxnDirection = original.direction === 'IN' ? 'OUT' : 'IN';

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO transactions
         (id, created_at, created_by, company_id, direction, amount, date, account_id, project_id, plot_id,
          phase, category_id, party_id, counterparty_name, pay_type, transfer_id, udhaar_id,
          labor_id, investor_id, description, doc_id, is_void, void_of_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      reversalId,
      nowISO(),
      createdBy,
      original.company_id,
      reversalDir,
      original.amount,
      nowISO().slice(0, 10),
      original.account_id,
      original.project_id,
      original.plot_id,
      original.phase,
      original.category_id,
      original.party_id,
      original.counterparty_name,
      original.pay_type,
      original.transfer_id,
      original.udhaar_id,
      original.labor_id,
      original.investor_id,
      `Reversal of ${id}`,
      original.doc_id,
      id
    );
    await tx.runAsync('UPDATE transactions SET is_void = 1 WHERE id = ?', id);
  });

  return getTransaction(reversalId) as Promise<TransactionRow>;
}

/** All live (non-void) transactions for a project, newest first. */
export async function listTransactions(projectId: string): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE project_id = ? AND is_void = 0 ORDER BY date DESC, created_at DESC',
    projectId
  );
}

/** Live transactions on a given date (YYYY-MM-DD) across everything. */
export async function listTransactionsOnDate(date: string): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE date = ? AND is_void = 0 AND company_id = ? ORDER BY created_at DESC',
    date,
    requireCompanyId()
  );
}

/** Live transactions posted against an account, newest first (its ledger). */
export async function listAccountTransactions(
  accountId: string,
  limit?: number
): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    `SELECT * FROM transactions WHERE account_id = ? AND is_void = 0
     ORDER BY date DESC, created_at DESC ${limit ? 'LIMIT ' + Math.floor(limit) : ''}`,
    accountId
  );
}

/** Live transactions for a plot (seller payments + plot expenses), newest first. */
export async function listPlotTransactions(plotId: string): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE plot_id = ? AND is_void = 0 ORDER BY date DESC, created_at DESC',
    plotId
  );
}

/** Live transactions for one phase of a project, newest first. */
export async function listProjectPhaseTransactions(
  projectId: string,
  phase: TxnPhase
): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    `SELECT * FROM transactions WHERE project_id = ? AND phase = ? AND is_void = 0
     ORDER BY date DESC, created_at DESC`,
    projectId,
    phase
  );
}

/** The most recent live transactions across everything (dashboard feed). */
export async function listRecentTransactions(limit = 20): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    `SELECT * FROM transactions WHERE is_void = 0 AND company_id = ?
     ORDER BY date DESC, created_at DESC LIMIT ?`,
    requireCompanyId(),
    Math.floor(limit)
  );
}

export interface CategoryTotal {
  category_id: string | null;
  direction: TxnDirection;
  total: number;
}

export interface ProjectTotals {
  totalIn: number;
  totalOut: number;
  net: number;
  byCategory: CategoryTotal[];
}

/** Money in/out + per-category breakdown for a project (excludes voided rows). */
export async function getProjectTotals(projectId: string): Promise<ProjectTotals> {
  const db = await getDatabase();

  const sums = await db.getFirstAsync<{ totalIn: number; totalOut: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN direction = 'IN'  THEN amount ELSE 0 END), 0) AS totalIn,
       COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) AS totalOut
     FROM transactions WHERE project_id = ? AND is_void = 0`,
    projectId
  );

  const byCategory = await db.getAllAsync<CategoryTotal>(
    `SELECT category_id, direction, COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE project_id = ? AND is_void = 0
     GROUP BY category_id, direction
     ORDER BY total DESC`,
    projectId
  );

  const totalIn = sums?.totalIn ?? 0;
  const totalOut = sums?.totalOut ?? 0;
  return { totalIn, totalOut, net: totalIn - totalOut, byCategory };
}
