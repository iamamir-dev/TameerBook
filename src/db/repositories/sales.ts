import { getDatabase } from '../database';
import {
  DEFAULT_USER,
  type PayType,
  type SaleReceiptRow,
  type SaleRow,
} from '../schema';
import { nowISO, uuid } from '../uuid';
import { categoryIdByName } from './categories';
import { addDocument } from './documents';
import { assertProjectActive } from './guards';
import { addTransaction, insertTransaction, LimitExceededError } from './transactions';

export interface NewSale {
  projectId: string;
  agreedPrice: number;
  buyerPartyId?: string | null;
  buyerName?: string | null;
  completedAt?: string | null;
  createdBy?: string;
}

export async function createSale(input: NewSale): Promise<SaleRow> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO sales (id, created_at, created_by, project_id, buyer_party_id, buyer_name, agreed_price, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.projectId,
    input.buyerPartyId ?? null,
    input.buyerName ?? null,
    input.agreedPrice,
    input.completedAt ?? null
  );
  return (await db.getFirstAsync<SaleRow>('SELECT * FROM sales WHERE id = ?', id))!;
}

export async function completeSale(id: string, completedAt: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE sales SET completed_at = ? WHERE id = ?', completedAt, id);
}

export interface NewSaleReceipt {
  saleId: string;
  amount: number;
  date: string;
  /** The account the buyer's money landed in. */
  accountId: string;
  /** Named instalment from the buyer (token / bayana / ...). */
  payType?: PayType | null;
  receiptUri?: string | null;
  createdBy?: string;
}

/**
 * Money received from the buyer: writes the sale_receipts row AND posts a
 * matching IN transaction (phase SALE, category "Buyer Receipt") into the
 * chosen account, so revenue actually flows through cash. Settlement revenue
 * reads sale_receipts (transactions' "Buyer Receipt" rows are NOT re-counted).
 */
export async function addSaleReceipt(input: NewSaleReceipt): Promise<SaleReceiptRow> {
  const db = await getDatabase();
  const sale = await db.getFirstAsync<SaleRow>('SELECT * FROM sales WHERE id = ?', input.saleId);
  if (!sale) throw new Error(`addSaleReceipt: sale ${input.saleId} not found`);
  if (input.amount <= 0) throw new Error('addSaleReceipt: amount must be positive');
  await assertProjectActive(sale.project_id);

  // VALIDATION: the buyer can never pay more than what is still outstanding.
  const received = await db.getFirstAsync<{ s: number }>(
    'SELECT COALESCE(SUM(amount), 0) AS s FROM sale_receipts WHERE sale_id = ?',
    input.saleId
  );
  const outstanding = sale.agreed_price - (received?.s ?? 0);
  if (input.amount > outstanding + 0.001) {
    throw new LimitExceededError(outstanding, input.amount);
  }

  const id = uuid();
  const categoryId = await categoryIdByName('Buyer Receipt', 'INCOME', 'خریدار کی رقم');

  // Receipt row + matching cash movement post atomically: a failure can never
  // leave settlement revenue recorded without the money in an account.
  let txnId = '';
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO sale_receipts (id, created_at, created_by, sale_id, amount, date, account_id, pay_type, doc_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      nowISO(),
      input.createdBy ?? DEFAULT_USER,
      input.saleId,
      input.amount,
      input.date,
      input.accountId,
      input.payType ?? null,
      null
    );
    txnId = await insertTransaction(tx, {
      direction: 'IN',
      amount: input.amount,
      date: input.date,
      accountId: input.accountId,
      projectId: sale.project_id,
      phase: 'SALE',
      categoryId,
      payType: input.payType ?? null,
      partyId: sale.buyer_party_id,
      counterpartyName: sale.buyer_name,
      createdBy: input.createdBy,
    });
  });

  if (input.receiptUri) {
    await addDocument({
      entityType: 'transaction',
      entityId: txnId,
      label: 'photoReceipt',
      fileUri: input.receiptUri,
    });
  }

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
  data: { buyerPartyId?: string | null; buyerName?: string | null; agreedPrice: number }
): Promise<SaleRow> {
  const db = await getDatabase();
  const existing = await getProjectSale(projectId);
  if (existing) {
    await db.runAsync(
      'UPDATE sales SET buyer_party_id = ?, buyer_name = ?, agreed_price = ? WHERE id = ?',
      data.buyerPartyId ?? existing.buyer_party_id,
      data.buyerName ?? existing.buyer_name,
      data.agreedPrice,
      existing.id
    );
    return (await db.getFirstAsync<SaleRow>('SELECT * FROM sales WHERE id = ?', existing.id))!;
  }
  return createSale({
    projectId,
    agreedPrice: data.agreedPrice,
    buyerPartyId: data.buyerPartyId ?? null,
    buyerName: data.buyerName ?? null,
  });
}

export interface SaleSummary {
  sale: SaleRow | null;
  receipts: SaleReceiptRow[];
  receiptsTotal: number;
  outstanding: number;
  /** Σ SALE-phase OUT (dealer commission, taxes, …). */
  costs: number;
}

/** Sale + receipts + outstanding (agreed − received) + seller-side costs. */
export async function getSaleSummary(projectId: string): Promise<SaleSummary> {
  const db = await getDatabase();
  const costsRow = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS s
     FROM transactions
     WHERE project_id = ? AND phase = 'SALE' AND direction = 'OUT' AND is_void = 0`,
    projectId
  );
  const costs = costsRow?.s ?? 0;

  const sale = await getProjectSale(projectId);
  if (!sale) return { sale: null, receipts: [], receiptsTotal: 0, outstanding: 0, costs };
  const receipts = await listSaleReceipts(sale.id);
  const receiptsTotal = receipts.reduce((s, r) => s + r.amount, 0);
  return { sale, receipts, receiptsTotal, outstanding: sale.agreed_price - receiptsTotal, costs };
}

/** Seller-side cost (dealer commission / tax / …) as a SALE-phase expense. */
export async function addSaleCost(input: {
  projectId: string;
  name: string;
  amount: number;
  date: string;
  accountId: string;
  createdBy?: string;
}): Promise<void> {
  const categoryId = await categoryIdByName('Sale Cost', 'EXPENSE', 'فروخت کے اخراجات');
  await addTransaction({
    direction: 'OUT',
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    projectId: input.projectId,
    phase: 'SALE',
    categoryId,
    description: input.name,
    createdBy: input.createdBy,
  });
}
