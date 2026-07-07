import { getDatabase } from '../database';
import {
  DEFAULT_USER,
  type TransactionRow,
  type UdhaarDirection,
  type UdhaarRow,
  type UdhaarStatus,
} from '../schema';
import { nowISO, uuid } from '../uuid';
import { requireCompanyId } from './companies';
import { addTransaction, LimitExceededError } from './transactions';

/**
 * Udhaar = money lent to (GIVEN) or borrowed from (TAKEN) a person. The person
 * may not exist anywhere else in the app  a free-text name is enough.
 * Money always moves through an account; the outstanding balance is derived
 * from the linked transactions, never stored.
 */

export interface NewUdhaar {
  personName: string;
  partyId?: string | null;
  direction?: UdhaarDirection;
  note?: string | null;
  createdBy?: string;
}

export async function createUdhaar(input: NewUdhaar): Promise<UdhaarRow> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO udhaar (id, created_at, created_by, company_id, person_name, party_id, direction, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    requireCompanyId(),
    input.personName.trim(),
    input.partyId ?? null,
    input.direction ?? 'GIVEN',
    input.note ?? null
  );
  return (await getUdhaar(id))!;
}

export async function getUdhaar(id: string): Promise<UdhaarRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<UdhaarRow>('SELECT * FROM udhaar WHERE id = ?', id);
}

/**
 * Delete an udhaar record ONLY if no money ever moved on it (used to clean up
 * when the first give is blocked by the funds guard). No-op otherwise.
 */
export async function deleteUdhaarIfEmpty(id: string): Promise<void> {
  const db = await getDatabase();
  const txns = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM transactions WHERE udhaar_id = ?',
    id
  );
  if ((txns?.c ?? 0) === 0) await db.runAsync('DELETE FROM udhaar WHERE id = ?', id);
}

/**
 * Outstanding balance of one udhaar:
 *   GIVEN → Σ(OUT: money we handed over) − Σ(IN: money returned to us)
 *   TAKEN → Σ(IN: money we received)     − Σ(OUT: money we paid back)
 * Hits 0 when fully cleared.
 */
export async function getUdhaarBalance(id: string): Promise<number> {
  const db = await getDatabase();
  const u = await getUdhaar(id);
  if (!u) return 0;
  const row = await db.getFirstAsync<{ outSum: number; inSum: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) AS outSum,
       COALESCE(SUM(CASE WHEN direction = 'IN'  THEN amount ELSE 0 END), 0) AS inSum
     FROM transactions WHERE udhaar_id = ? AND is_void = 0`,
    id
  );
  const outSum = row?.outSum ?? 0;
  const inSum = row?.inSum ?? 0;
  return u.direction === 'GIVEN' ? outSum - inSum : inSum - outSum;
}

export interface UdhaarWithBalance extends UdhaarRow {
  given: number;
  returned: number;
  balance: number;
}

/** All udhaar records (optionally filtered by status) with balances, newest first. */
export async function listUdhaar(status?: UdhaarStatus): Promise<UdhaarWithBalance[]> {
  const db = await getDatabase();
  const where = status ? 'WHERE u.company_id = ? AND u.status = ?' : 'WHERE u.company_id = ?';
  const params = status ? [requireCompanyId(), status] : [requireCompanyId()];
  return db.getAllAsync<UdhaarWithBalance>(
    `SELECT u.*,
       COALESCE(SUM(CASE WHEN t.is_void = 0
         AND t.direction = (CASE u.direction WHEN 'GIVEN' THEN 'OUT' ELSE 'IN' END)
         THEN t.amount ELSE 0 END), 0) AS given,
       COALESCE(SUM(CASE WHEN t.is_void = 0
         AND t.direction = (CASE u.direction WHEN 'GIVEN' THEN 'IN' ELSE 'OUT' END)
         THEN t.amount ELSE 0 END), 0) AS returned,
       COALESCE(SUM(CASE WHEN t.is_void = 0 THEN
         (CASE WHEN t.direction = (CASE u.direction WHEN 'GIVEN' THEN 'OUT' ELSE 'IN' END)
               THEN t.amount ELSE -t.amount END) ELSE 0 END), 0) AS balance
     FROM udhaar u
     LEFT JOIN transactions t ON t.udhaar_id = u.id
     ${where}
     GROUP BY u.id
     ORDER BY u.created_at DESC`,
    ...params
  );
}

/** Live (non-void) transactions on one udhaar, newest first (its ledger). */
export async function listUdhaarTransactions(udhaarId: string): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE udhaar_id = ? AND is_void = 0 ORDER BY date DESC, created_at DESC',
    udhaarId
  );
}

export interface UdhaarMoveInput {
  udhaarId: string;
  amount: number;
  date: string;
  accountId: string;
  note?: string | null;
  createdBy?: string;
}

/**
 * Hand money over on an udhaar: for GIVEN this is us lending (OUT of the
 * account); for TAKEN this is us receiving the loan (IN to the account).
 */
export async function giveUdhaar(input: UdhaarMoveInput): Promise<void> {
  const u = await getUdhaar(input.udhaarId);
  if (!u) throw new Error(`giveUdhaar: udhaar ${input.udhaarId} not found`);

  await addTransaction({
    direction: u.direction === 'GIVEN' ? 'OUT' : 'IN',
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    udhaarId: u.id,
    counterpartyName: u.person_name,
    description: input.note ?? null,
    createdBy: input.createdBy,
  });

  await syncStatus(u.id);
}

/**
 * Money coming back on an udhaar: for GIVEN this is repayment to us (IN);
 * for TAKEN this is us paying back (OUT). Marks the record CLEARED when the
 * balance reaches zero.
 */
export async function returnUdhaar(input: UdhaarMoveInput): Promise<void> {
  const u = await getUdhaar(input.udhaarId);
  if (!u) throw new Error(`returnUdhaar: udhaar ${input.udhaarId} not found`);
  if (input.amount <= 0) throw new Error('returnUdhaar: amount must be positive');

  // VALIDATION: more can't come back than is outstanding on this udhaar.
  const balance = await getUdhaarBalance(u.id);
  if (input.amount > balance + 0.001) {
    throw new LimitExceededError(balance, input.amount);
  }

  await addTransaction({
    direction: u.direction === 'GIVEN' ? 'IN' : 'OUT',
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    udhaarId: u.id,
    counterpartyName: u.person_name,
    description: input.note ?? null,
    createdBy: input.createdBy,
  });

  await syncStatus(u.id);
}

/** Keep OPEN/CLEARED in step with the derived balance. */
export async function syncStatus(udhaarId: string): Promise<void> {
  const balance = await getUdhaarBalance(udhaarId);
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE udhaar SET status = ? WHERE id = ?',
    balance <= 0.001 ? 'CLEARED' : 'OPEN',
    udhaarId
  );
}

export interface UdhaarTotals {
  /** Money out on loan to people (they owe us). */
  receivable: number;
  /** Money we borrowed and still owe. */
  payable: number;
}

/** Dashboard totals across all open udhaar. */
export async function getUdhaarTotals(): Promise<UdhaarTotals> {
  const rows = await listUdhaar('OPEN');
  let receivable = 0;
  let payable = 0;
  for (const r of rows) {
    if (r.direction === 'GIVEN') receivable += Math.max(0, r.balance);
    else payable += Math.max(0, r.balance);
  }
  return { receivable, payable };
}
