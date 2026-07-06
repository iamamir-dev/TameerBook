import { getDatabase } from '../database';
import {
  type CategoryType,
  DEFAULT_USER,
  type PaymentMode,
  type PropertyPaymentType,
  type PropertyRow,
} from '../schema';
import { nowISO, uuid } from '../uuid';
import { addDocument } from './documents';
import { addTransaction } from './transactions';

const PLOT_PAYMENT_EN = 'Plot Payment';
const TRANSFER_FEE_EN = 'Transfer Fees & Tax';

/** Find a category by English name, creating it if missing. */
async function categoryIdByName(
  nameEn: string,
  nameUr: string,
  type: CategoryType,
  icon: string
): Promise<string> {
  const db = await getDatabase();
  const found = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM categories WHERE name_en = ? LIMIT 1',
    nameEn
  );
  if (found) return found.id;
  const id = uuid();
  await db.runAsync(
    `INSERT INTO categories (id, created_at, created_by, parent_id, name_en, name_ur, type, icon)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
    id,
    nowISO(),
    DEFAULT_USER,
    nameEn,
    nameUr,
    type,
    icon
  );
  return id;
}

export interface AcquisitionSummary {
  agreedPrice: number;
  totalPaid: number;
  remaining: number;
}

/** Agreed price, total paid (sum of property payments) and remaining balance. */
export async function getAcquisitionSummary(propertyId: string): Promise<AcquisitionSummary> {
  const db = await getDatabase();
  const prop = await db.getFirstAsync<PropertyRow>('SELECT * FROM properties WHERE id = ?', propertyId);
  const paid = await db.getFirstAsync<{ s: number }>(
    'SELECT COALESCE(SUM(amount), 0) AS s FROM property_payments WHERE property_id = ?',
    propertyId
  );
  const agreedPrice = prop?.agreed_price ?? 0;
  const totalPaid = paid?.s ?? 0;
  return { agreedPrice, totalPaid, remaining: agreedPrice - totalPaid };
}

export interface AcquisitionPaymentInput {
  propertyId: string;
  projectId: string;
  type: PropertyPaymentType;
  amount: number;
  date: string;
  mode: PaymentMode;
  receiptUri?: string | null;
  createdBy?: string;
}

/**
 * Record an acquisition payment: writes a `property_payments` row AND a
 * matching expense `transaction` (category "Plot Payment") atomically, then
 * attaches the optional receipt photo as a document.
 */
export async function addAcquisitionPayment(input: AcquisitionPaymentInput): Promise<void> {
  const db = await getDatabase();
  const catId = await categoryIdByName(PLOT_PAYMENT_EN, 'پلاٹ کی ادائیگی', 'EXPENSE', 'home');
  const paymentId = uuid();
  const txnId = uuid();
  const createdAt = nowISO();
  const by = input.createdBy ?? DEFAULT_USER;

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO property_payments (id, created_at, created_by, property_id, type, amount, date, mode, doc_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      paymentId,
      createdAt,
      by,
      input.propertyId,
      input.type,
      input.amount,
      input.date,
      input.mode
    );
    await tx.runAsync(
      `INSERT INTO transactions
         (id, created_at, created_by, project_id, direction, category_id, amount, date, mode, party_id, description, doc_id, is_void, void_of_id)
       VALUES (?, ?, ?, ?, 'OUT', ?, ?, ?, ?, NULL, ?, NULL, 0, NULL)`,
      txnId,
      createdAt,
      by,
      input.projectId,
      catId,
      input.amount,
      input.date,
      input.mode,
      input.type
    );
  });

  if (input.receiptUri) {
    await addDocument({
      entityType: 'property_payment',
      entityId: paymentId,
      fileUri: input.receiptUri,
      mime: 'image/jpeg',
    });
  }
}

export async function setTransferDeadline(propertyId: string, deadline: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE properties SET transfer_deadline = ? WHERE id = ?', deadline, propertyId);
}

export async function setTransferDate(propertyId: string, date: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE properties SET transfer_date = ? WHERE id = ?', date, propertyId);
}

export interface TransferFeeInput {
  projectId: string;
  name: string;
  amount: number;
  date: string;
  mode: PaymentMode;
}

/** Record a transfer tax/fee as an expense transaction (Transfer Fees & Tax). */
export async function addTransferFee(input: TransferFeeInput): Promise<void> {
  const catId = await categoryIdByName(TRANSFER_FEE_EN, 'ٹرانسفر فیس و ٹیکس', 'EXPENSE', 'receipt');
  await addTransaction({
    projectId: input.projectId,
    direction: 'OUT',
    categoryId: catId,
    amount: input.amount,
    date: input.date,
    mode: input.mode,
    description: input.name,
  });
}

export interface TransferDeadlineRow {
  propertyId: string;
  projectId: string;
  projectName: string;
  deadline: string;
}

/** All properties that have a transfer deadline set (with their project name). */
export async function listTransferDeadlines(): Promise<TransferDeadlineRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransferDeadlineRow>(
    `SELECT p.id AS propertyId, p.project_id AS projectId,
            COALESCE(pr.name, '') AS projectName, p.transfer_deadline AS deadline
     FROM properties p
     JOIN projects pr ON pr.id = p.project_id
     WHERE p.transfer_deadline IS NOT NULL`
  );
}
