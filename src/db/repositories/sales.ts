import { getDatabase } from '../database';
import {
  DEFAULT_USER,
  type PaymentMode,
  type SaleReceiptRow,
  type SaleRow,
} from '../schema';
import { nowISO, uuid } from '../uuid';
import { addTransaction } from './transactions';

export interface NewSale {
  projectId: string;
  agreedPrice: number;
  buyerPartyId?: string | null;
  completedAt?: string | null;
  createdBy?: string;
}

export async function createSale(input: NewSale): Promise<SaleRow> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO sales (id, created_at, created_by, project_id, buyer_party_id, agreed_price, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.projectId,
    input.buyerPartyId ?? null,
    input.agreedPrice,
    input.completedAt ?? null
  );
  return (await db.getFirstAsync<SaleRow>('SELECT * FROM sales WHERE id = ?', id))!;
}

export async function listSales(projectId: string): Promise<SaleRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<SaleRow>(
    'SELECT * FROM sales WHERE project_id = ? ORDER BY created_at DESC',
    projectId
  );
}

export async function completeSale(id: string, completedAt: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE sales SET completed_at = ? WHERE id = ?', completedAt, id);
}

export interface NewSaleReceipt {
  saleId: string;
  amount: number;
  date: string;
  mode: PaymentMode;
  docId?: string | null;
  createdBy?: string;
}

export async function addSaleReceipt(input: NewSaleReceipt): Promise<SaleReceiptRow> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO sale_receipts (id, created_at, created_by, sale_id, amount, date, mode, doc_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.saleId,
    input.amount,
    input.date,
    input.mode,
    input.docId ?? null
  );
  return (await db.getFirstAsync<SaleReceiptRow>('SELECT * FROM sale_receipts WHERE id = ?', id))!;
}

export async function listSaleReceipts(saleId: string): Promise<SaleReceiptRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<SaleReceiptRow>(
    'SELECT * FROM sale_receipts WHERE sale_id = ? ORDER BY date',
    saleId
  );
}

/** The project's single sale, or null. */
export async function getProjectSale(projectId: string): Promise<SaleRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<SaleRow>(
    'SELECT * FROM sales WHERE project_id = ? ORDER BY created_at LIMIT 1',
    projectId
  );
}

/** Create or update the project's sale (buyer + agreed price). */
export async function upsertSale(
  projectId: string,
  data: { buyerPartyId?: string | null; agreedPrice: number }
): Promise<SaleRow> {
  const db = await getDatabase();
  const existing = await getProjectSale(projectId);
  if (existing) {
    await db.runAsync(
      'UPDATE sales SET buyer_party_id = ?, agreed_price = ? WHERE id = ?',
      data.buyerPartyId ?? null,
      data.agreedPrice,
      existing.id
    );
    return (await db.getFirstAsync<SaleRow>('SELECT * FROM sales WHERE id = ?', existing.id))!;
  }
  return createSale({ projectId, agreedPrice: data.agreedPrice, buyerPartyId: data.buyerPartyId ?? null });
}

export interface SaleSummary {
  sale: SaleRow | null;
  receipts: SaleReceiptRow[];
  receiptsTotal: number;
  outstanding: number;
}

/** Sale + receipts + outstanding (agreed price − received). */
export async function getSaleSummary(projectId: string): Promise<SaleSummary> {
  const sale = await getProjectSale(projectId);
  if (!sale) return { sale: null, receipts: [], receiptsTotal: 0, outstanding: 0 };
  const receipts = await listSaleReceipts(sale.id);
  const receiptsTotal = receipts.reduce((s, r) => s + r.amount, 0);
  return { sale, receipts, receiptsTotal, outstanding: sale.agreed_price - receiptsTotal };
}

/** Seller-side cost (Dealer Commission / 236C / etc.) as an expense transaction. */
export async function addSaleCost(input: {
  projectId: string;
  name: string;
  amount: number;
  date: string;
  mode: PaymentMode;
}): Promise<void> {
  const db = await getDatabase();
  const SALE_COSTS_EN = 'Sale Costs';
  let cat = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM categories WHERE name_en = ? LIMIT 1',
    SALE_COSTS_EN
  );
  if (!cat) {
    const id = uuid();
    await db.runAsync(
      `INSERT INTO categories (id, created_at, created_by, parent_id, name_en, name_ur, type, icon)
       VALUES (?, ?, ?, NULL, ?, ?, 'EXPENSE', 'receipt')`,
      id,
      nowISO(),
      DEFAULT_USER,
      SALE_COSTS_EN,
      'فروخت کے اخراجات'
    );
    cat = { id };
  }
  await addTransaction({
    projectId: input.projectId,
    direction: 'OUT',
    categoryId: cat.id,
    amount: input.amount,
    date: input.date,
    mode: input.mode,
    description: input.name,
  });
}
