import { getDatabase } from '../database';
import { DEFAULT_USER, type PartyRow, type PaymentMode } from '../schema';
import { nowISO, uuid } from '../uuid';
import { addTransaction } from './transactions';

/** Well-known category used to mark udhaar repayments (kept out of normal spend). */
const UDHAAR_PAYMENT_EN = 'Udhaar Payment';

/** Find (or create) the special "Udhaar Payment" category id. */
async function udhaarPaymentCategoryId(): Promise<string> {
  const db = await getDatabase();
  const found = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM categories WHERE name_en = ? LIMIT 1',
    UDHAAR_PAYMENT_EN
  );
  if (found) return found.id;
  const id = uuid();
  await db.runAsync(
    `INSERT INTO categories (id, created_at, created_by, parent_id, name_en, name_ur, type, icon)
     VALUES (?, ?, ?, NULL, ?, ?, 'EXPENSE', 'investor')`,
    id,
    nowISO(),
    DEFAULT_USER,
    UDHAAR_PAYMENT_EN,
    'ادھار کی واپسی'
  );
  return id;
}

export interface SupplierPayable extends PartyRow {
  /** Total taken on udhaar (CREDIT expenses). */
  credit: number;
  /** Total repaid via udhaar payments. */
  paid: number;
  /** Outstanding payable = credit − paid. */
  payable: number;
}

/**
 * Net outstanding payable to a party:
 *   Σ(CREDIT expenses) − Σ(udhaar repayments).
 * A CREDIT expense (mode=CREDIT) and a repayment (category = Udhaar Payment,
 * paid by cash/bank) never overlap, so the two sums are clean.
 */
export async function getPayable(partyId: string): Promise<number> {
  const db = await getDatabase();
  const catId = await udhaarPaymentCategoryId();
  const row = await db.getFirstAsync<{ credit: number; paid: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN mode = 'CREDIT'   THEN amount ELSE 0 END), 0) AS credit,
       COALESCE(SUM(CASE WHEN category_id = ?   THEN amount ELSE 0 END), 0) AS paid
     FROM transactions
     WHERE party_id = ? AND direction = 'OUT' AND is_void = 0`,
    catId,
    partyId
  );
  return (row?.credit ?? 0) - (row?.paid ?? 0);
}

/** Every party that has taken udhaar, with their outstanding payable. */
export async function listSupplierPayables(): Promise<SupplierPayable[]> {
  const db = await getDatabase();
  const catId = await udhaarPaymentCategoryId();
  const rows = await db.getAllAsync<PartyRow & { credit: number; paid: number }>(
    `SELECT p.*,
       COALESCE(SUM(CASE WHEN t.mode = 'CREDIT' THEN t.amount ELSE 0 END), 0) AS credit,
       COALESCE(SUM(CASE WHEN t.category_id = ? THEN t.amount ELSE 0 END), 0) AS paid
     FROM parties p
     JOIN transactions t ON t.party_id = p.id AND t.direction = 'OUT' AND t.is_void = 0
     GROUP BY p.id
     HAVING credit > 0
     ORDER BY (credit - paid) DESC`,
    catId
  );
  return rows.map((r) => ({ ...r, payable: r.credit - r.paid }));
}

export interface UdhaarPaymentInput {
  partyId: string;
  amount: number;
  date: string;
  /** Real payment mode (CREDIT is coerced to CASH — a repayment leaves cash). */
  mode: PaymentMode;
  createdBy?: string;
}

/**
 * Record a repayment to a supplier: an OUT transaction tagged with the
 * Udhaar Payment category, which reduces that party's payable. The project is
 * inferred from the supplier's most recent CREDIT expense.
 */
export async function recordUdhaarPayment(input: UdhaarPaymentInput): Promise<void> {
  const db = await getDatabase();
  const catId = await udhaarPaymentCategoryId();
  const src = await db.getFirstAsync<{ project_id: string }>(
    `SELECT project_id FROM transactions
     WHERE party_id = ? AND direction = 'OUT' AND mode = 'CREDIT' AND is_void = 0
     ORDER BY date DESC LIMIT 1`,
    input.partyId
  );
  if (!src) throw new Error('recordUdhaarPayment: no udhaar found for this party');

  await addTransaction({
    projectId: src.project_id,
    direction: 'OUT',
    categoryId: catId,
    amount: input.amount,
    date: input.date,
    mode: input.mode === 'CREDIT' ? 'CASH' : input.mode,
    partyId: input.partyId,
    description: 'Udhaar payment',
    createdBy: input.createdBy,
  });
}
