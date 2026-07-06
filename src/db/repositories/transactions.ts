import { getDatabase } from '../database';
import {
  DEFAULT_USER,
  type PaymentMode,
  type TransactionRow,
  type TxnDirection,
} from '../schema';
import { nowISO, uuid } from '../uuid';

export interface NewTransaction {
  projectId: string;
  direction: TxnDirection;
  amount: number;
  date: string;
  mode: PaymentMode;
  categoryId?: string | null;
  partyId?: string | null;
  description?: string | null;
  docId?: string | null;
  createdBy?: string;
}

/**
 * Append a transaction. The ledger is APPEND-ONLY — there is intentionally no
 * update or delete function. Corrections go through `voidTransaction`.
 */
export async function addTransaction(input: NewTransaction): Promise<TransactionRow> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO transactions
       (id, created_at, created_by, project_id, direction, category_id, amount, date, mode,
        party_id, description, doc_id, is_void, void_of_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.projectId,
    input.direction,
    input.categoryId ?? null,
    input.amount,
    input.date,
    input.mode,
    input.partyId ?? null,
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
 * (opposite direction, linked via `void_of_id`) and flags the original
 * `is_void = 1`. Both are excluded from balances (which filter `is_void = 0`),
 * so the original's effect is cleanly cancelled while the full history — and
 * the reversal link — is preserved for audit.
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
         (id, created_at, created_by, project_id, direction, category_id, amount, date, mode,
          party_id, description, doc_id, is_void, void_of_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      reversalId,
      nowISO(),
      createdBy,
      original.project_id,
      reversalDir,
      original.category_id,
      original.amount,
      nowISO(),
      original.mode,
      original.party_id,
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

/** Live transactions on a given date (YYYY-MM-DD) across all projects. */
export async function listTransactionsOnDate(date: string): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE date = ? AND is_void = 0 ORDER BY created_at DESC',
    date
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

export interface CashBankBalance {
  cash: number;
  bank: number;
  jazzcash: number;
  total: number;
}

/**
 * Net balance by payment mode across all (or one project's) live transactions:
 * money IN minus money OUT for each of CASH / BANK / JAZZCASH.
 */
export async function getCashBankBalance(projectId?: string): Promise<CashBankBalance> {
  const db = await getDatabase();
  const where = projectId ? 'WHERE is_void = 0 AND project_id = ?' : 'WHERE is_void = 0';
  const params = projectId ? [projectId] : [];

  const row = await db.getFirstAsync<{ cash: number; bank: number; jazzcash: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN mode = 'CASH'     THEN sign * amount ELSE 0 END), 0) AS cash,
       COALESCE(SUM(CASE WHEN mode = 'BANK'     THEN sign * amount ELSE 0 END), 0) AS bank,
       COALESCE(SUM(CASE WHEN mode = 'JAZZCASH' THEN sign * amount ELSE 0 END), 0) AS jazzcash
     FROM (
       SELECT mode, amount, CASE WHEN direction = 'IN' THEN 1 ELSE -1 END AS sign
       FROM transactions ${where}
     )`,
    ...params
  );

  const cash = row?.cash ?? 0;
  const bank = row?.bank ?? 0;
  const jazzcash = row?.jazzcash ?? 0;
  return { cash, bank, jazzcash, total: cash + bank + jazzcash };
}
