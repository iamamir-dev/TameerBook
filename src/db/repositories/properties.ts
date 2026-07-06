import { getDatabase } from '../database';
import {
  DEFAULT_USER,
  type PaymentMode,
  type PropertyPaymentRow,
  type PropertyPaymentType,
  type PropertyRow,
  type SizeUnit,
} from '../schema';
import { nowISO, uuid } from '../uuid';

export interface NewProperty {
  projectId: string;
  society?: string | null;
  block?: string | null;
  plotNo?: string | null;
  sizeValue?: number | null;
  sizeUnit?: SizeUnit | null;
  agreedPrice?: number | null;
  sellerName?: string | null;
  sellerCnic?: string | null;
  sellerPhone?: string | null;
  transferDate?: string | null;
  createdBy?: string;
}

export async function addProperty(input: NewProperty): Promise<PropertyRow> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO properties
       (id, created_at, created_by, project_id, society, block, plot_no, size_value, size_unit,
        agreed_price, seller_name, seller_cnic, seller_phone, transfer_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.projectId,
    input.society ?? null,
    input.block ?? null,
    input.plotNo ?? null,
    input.sizeValue ?? null,
    input.sizeUnit ?? null,
    input.agreedPrice ?? null,
    input.sellerName ?? null,
    input.sellerCnic ?? null,
    input.sellerPhone ?? null,
    input.transferDate ?? null
  );
  return (await db.getFirstAsync<PropertyRow>('SELECT * FROM properties WHERE id = ?', id))!;
}

export async function listProperties(projectId: string): Promise<PropertyRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<PropertyRow>(
    'SELECT * FROM properties WHERE project_id = ? ORDER BY created_at',
    projectId
  );
}

export interface NewPropertyPayment {
  propertyId: string;
  type: PropertyPaymentType;
  amount: number;
  date: string;
  mode: PaymentMode;
  docId?: string | null;
  createdBy?: string;
}

export async function addPropertyPayment(input: NewPropertyPayment): Promise<PropertyPaymentRow> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO property_payments (id, created_at, created_by, property_id, type, amount, date, mode, doc_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.propertyId,
    input.type,
    input.amount,
    input.date,
    input.mode,
    input.docId ?? null
  );
  return (await db.getFirstAsync<PropertyPaymentRow>(
    'SELECT * FROM property_payments WHERE id = ?',
    id
  ))!;
}

export async function listPropertyPayments(propertyId: string): Promise<PropertyPaymentRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<PropertyPaymentRow>(
    'SELECT * FROM property_payments WHERE property_id = ? ORDER BY date',
    propertyId
  );
}
