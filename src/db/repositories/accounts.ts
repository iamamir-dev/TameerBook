import { getDatabase } from '../database';
import { DEFAULT_USER, type AccountRow, type AccountType } from '../schema';
import { nowISO, uuid } from '../uuid';
import { insertTransaction } from './transactions';
import { categoryIdByName } from './categories';
import { requireCompanyId } from './companies';

export interface NewAccount {
  name: string;
  type: AccountType;
  openingBalance?: number;
  icon?: string | null;
  color?: string | null;
  createdBy?: string;
}

/** Thrown when an account with the same (case-insensitive) name already exists. */
export class DuplicateAccountError extends Error {
  constructor(public readonly existingName: string) {
    super('DUPLICATE_ACCOUNT');
    this.name = 'DuplicateAccountError';
  }
}

/** True when an error from a save action is the duplicate-account guard. */
export function isDuplicateAccount(e: unknown): e is DuplicateAccountError {
  return e instanceof Error && e.message === 'DUPLICATE_ACCOUNT';
}

/**
 * Create an account (a place money lives: bank / cash-in-hand / wallet).
 * VALIDATION: names must be unique (case-insensitive) among active accounts 
 * two "Cash in Hand"s make balances impossible to reason about.
 */
export async function addAccount(input: NewAccount): Promise<AccountRow> {
  const db = await getDatabase();

  const name = input.name.trim();
  if (!name) throw new Error('addAccount: name is required');
  if ((input.openingBalance ?? 0) < 0) throw new Error('addAccount: opening balance cannot be negative');
  const dupe = await db.getFirstAsync<{ name: string }>(
    'SELECT name FROM accounts WHERE is_archived = 0 AND company_id = ? AND LOWER(name) = LOWER(?)',
    requireCompanyId(),
    name
  );
  if (dupe) throw new DuplicateAccountError(dupe.name);

  const id = uuid();
  const order = await db.getFirstAsync<{ m: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS m FROM accounts WHERE company_id = ?',
    requireCompanyId()
  );
  await db.runAsync(
    `INSERT INTO accounts (id, created_at, created_by, company_id, name, type, opening_balance, icon, color, sort_order, is_archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    requireCompanyId(),
    input.name,
    input.type,
    input.openingBalance ?? 0,
    input.icon ?? null,
    input.color ?? null,
    order?.m ?? 0
  );
  return getAccount(id) as Promise<AccountRow>;
}

export async function getAccount(id: string): Promise<AccountRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', id);
}

/** Active (non-archived) accounts in display order. */
export async function listAccounts(): Promise<AccountRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<AccountRow>(
    'SELECT * FROM accounts WHERE is_archived = 0 AND company_id = ? ORDER BY sort_order ASC, created_at ASC',
    requireCompanyId()
  );
}

export async function updateAccount(
  id: string,
  patch: { name?: string; type?: AccountType; openingBalance?: number }
): Promise<void> {
  const db = await getDatabase();
  const existing = await getAccount(id);
  if (!existing) throw new Error(`updateAccount: account ${id} not found`);
  await db.runAsync(
    'UPDATE accounts SET name = ?, type = ?, opening_balance = ? WHERE id = ?',
    patch.name ?? existing.name,
    patch.type ?? existing.type,
    patch.openingBalance ?? existing.opening_balance,
    id
  );
}

/** Hide an account from pickers/dashboard without touching its history. */
export async function archiveAccount(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE accounts SET is_archived = 1 WHERE id = ?', id);
}

/** Derived balance: opening + Σ(IN) − Σ(OUT) over live transactions. */
export async function getAccountBalance(id: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ balance: number }>(
    `SELECT a.opening_balance + COALESCE(SUM(
       CASE WHEN t.direction = 'IN' THEN t.amount
            WHEN t.direction = 'OUT' THEN -t.amount
            ELSE 0 END), 0) AS balance
     FROM accounts a
     LEFT JOIN transactions t ON t.account_id = a.id AND t.is_void = 0
     WHERE a.id = ?
     GROUP BY a.id`,
    id
  );
  return row?.balance ?? 0;
}

export interface AccountWithBalance extends AccountRow {
  balance: number;
}

/** Every active account with its derived balance (dashboard / pickers). */
export async function listAccountsWithBalance(): Promise<AccountWithBalance[]> {
  const db = await getDatabase();
  return db.getAllAsync<AccountWithBalance>(
    `SELECT a.*, a.opening_balance + COALESCE(SUM(
       CASE WHEN t.direction = 'IN' THEN t.amount
            WHEN t.direction = 'OUT' THEN -t.amount
            ELSE 0 END), 0) AS balance
     FROM accounts a
     LEFT JOIN transactions t ON t.account_id = a.id AND t.is_void = 0
     WHERE a.is_archived = 0 AND a.company_id = ?
     GROUP BY a.id
     ORDER BY a.sort_order ASC, a.created_at ASC`,
    requireCompanyId()
  );
}

/** Total money across all active accounts (the dashboard hero number). */
export async function getTotalBalance(): Promise<number> {
  const accounts = await listAccountsWithBalance();
  return accounts.reduce((sum, a) => sum + a.balance, 0);
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string | null;
  createdBy?: string;
}

/**
 * Move money between two accounts: two linked transactions (OUT of `from`,
 * IN to `to`) sharing one `transfer_id`. Neither is income nor expense
 * total balance is unchanged. Both legs post in ONE transaction so a failure
 * can never leave money withdrawn but not deposited.
 */
export async function transferBetween(input: TransferInput): Promise<string> {
  if (input.fromAccountId === input.toAccountId) {
    throw new Error('transferBetween: from and to accounts must differ');
  }
  if (input.amount <= 0) throw new Error('transferBetween: amount must be positive');

  const db = await getDatabase();
  const transferId = uuid();
  const categoryId = await categoryIdByName('Transfer', 'EXPENSE', 'ٹرانسفر', true);
  const common = {
    amount: input.amount,
    date: input.date,
    transferId,
    categoryId,
    description: input.note ?? null,
    createdBy: input.createdBy,
  };
  await db.withExclusiveTransactionAsync(async (tx) => {
    await insertTransaction(tx, { ...common, direction: 'OUT', accountId: input.fromAccountId });
    await insertTransaction(tx, { ...common, direction: 'IN', accountId: input.toAccountId });
  });
  return transferId;
}
