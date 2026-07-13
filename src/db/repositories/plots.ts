import { getDatabase } from '../database';
import {
  DEFAULT_USER,
  type PayType,
  type PlotRow,
  type PlotStatus,
  type SizeUnit,
} from '../schema';
import { nowISO, uuid } from '../uuid';
import { categoryIdByName } from './categories';
import { requireCompanyId } from './companies';
import { addDocument } from './documents';
import { assertProjectActive } from './guards';
import { addTransaction, LimitExceededError } from './transactions';

export interface NewPlot {
  name: string;
  society?: string | null;
  block?: string | null;
  plotNo?: string | null;
  sizeValue?: number | null;
  sizeUnit?: SizeUnit | null;
  /** Price agreed with the seller at deal time. */
  dealPrice: number;
  sellerName?: string | null;
  sellerCnic?: string | null;
  sellerPhone?: string | null;
  transferDeadline?: string | null;
  createdBy?: string;
}

/** Record a purchased plot (standalone  no project needed). */
export async function createPlot(input: NewPlot): Promise<PlotRow> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO plots
       (id, created_at, created_by, company_id, name, society, block, plot_no, size_value, size_unit,
        deal_price, seller_name, seller_cnic, seller_phone, transfer_date, transfer_deadline,
        status, project_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'OWNED', NULL)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    requireCompanyId(),
    input.name,
    input.society ?? null,
    input.block ?? null,
    input.plotNo ?? null,
    input.sizeValue ?? null,
    input.sizeUnit ?? null,
    input.dealPrice,
    input.sellerName ?? null,
    input.sellerCnic ?? null,
    input.sellerPhone ?? null,
    input.transferDeadline ?? null
  );
  return getPlot(id) as Promise<PlotRow>;
}

export async function getPlot(id: string): Promise<PlotRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<PlotRow>('SELECT * FROM plots WHERE id = ?', id);
}

export async function listPlots(status?: PlotStatus): Promise<PlotRow[]> {
  const db = await getDatabase();
  if (status) {
    return db.getAllAsync<PlotRow>(
      'SELECT * FROM plots WHERE status = ? AND company_id = ? ORDER BY created_at DESC',
      status,
      requireCompanyId()
    );
  }
  return db.getAllAsync<PlotRow>(
    'SELECT * FROM plots WHERE company_id = ? ORDER BY created_at DESC',
    requireCompanyId()
  );
}

export async function updatePlot(
  id: string,
  patch: Partial<{
    name: string;
    society: string | null;
    block: string | null;
    plotNo: string | null;
    sizeValue: number | null;
    sizeUnit: SizeUnit | null;
    dealPrice: number;
    sellerName: string | null;
    sellerPhone: string | null;
    transferDate: string | null;
    transferDeadline: string | null;
    status: PlotStatus;
  }>
): Promise<void> {
  const db = await getDatabase();
  const p = await getPlot(id);
  if (!p) throw new Error(`updatePlot: plot ${id} not found`);
  await db.runAsync(
    `UPDATE plots SET name = ?, society = ?, block = ?, plot_no = ?, size_value = ?, size_unit = ?,
       deal_price = ?, seller_name = ?, seller_phone = ?, transfer_date = ?, transfer_deadline = ?, status = ?
     WHERE id = ?`,
    patch.name ?? p.name,
    patch.society !== undefined ? patch.society : p.society,
    patch.block !== undefined ? patch.block : p.block,
    patch.plotNo !== undefined ? patch.plotNo : p.plot_no,
    patch.sizeValue !== undefined ? patch.sizeValue : p.size_value,
    patch.sizeUnit !== undefined ? patch.sizeUnit : p.size_unit,
    patch.dealPrice ?? p.deal_price,
    patch.sellerName !== undefined ? patch.sellerName : p.seller_name,
    patch.sellerPhone !== undefined ? patch.sellerPhone : p.seller_phone,
    patch.transferDate !== undefined ? patch.transferDate : p.transfer_date,
    patch.transferDeadline !== undefined ? patch.transferDeadline : p.transfer_deadline,
    patch.status ?? p.status,
    id
  );
}

/** Delete a plot  blocked if it has any transactions or belongs to a project. */
export async function deletePlot(id: string): Promise<void> {
  const db = await getDatabase();
  const plot = await getPlot(id);
  if (!plot) return;
  if (plot.project_id) throw new Error('deletePlot: plot is part of a project');
  const txns = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM transactions WHERE plot_id = ?',
    id
  );
  if ((txns?.c ?? 0) > 0) throw new Error('deletePlot: plot has transactions');
  await db.runAsync('DELETE FROM plots WHERE id = ?', id);
}

export interface PlotPaymentInput {
  plotId: string;
  payType: PayType;
  amount: number;
  date: string;
  accountId: string;
  note?: string | null;
  receiptUri?: string | null;
  createdBy?: string;
}

/**
 * Pay the seller an instalment of the deal (token / bayana / installment /
 * final): an OUT transaction on the chosen account, tagged to the plot with
 * `phase='PLOT'` and the named `pay_type`, plus an optional receipt document.
 *
 * VALIDATION: the seller can never be paid more than what is still owed on
 * the deal  throws `LimitExceededError` (expenses like tax are separate and
 * go through `addPlotExpense`).
 */
export async function addPlotPayment(input: PlotPaymentInput): Promise<void> {
  const plot = await getPlot(input.plotId);
  if (!plot) throw new Error(`addPlotPayment: plot ${input.plotId} not found`);
  if (input.amount <= 0) throw new Error('addPlotPayment: amount must be positive');
  // A plot inside a COMPLETED project is read-only (V-7).
  if (plot.project_id) await assertProjectActive(plot.project_id);

  const summary = await getPlotSummary(input.plotId);
  if (input.amount > summary.remaining + 0.001) {
    throw new LimitExceededError(summary.remaining, input.amount);
  }

  const categoryId = await categoryIdByName('Plot Payment', 'EXPENSE', 'پلاٹ کی ادائیگی');

  const txn = await addTransaction({
    direction: 'OUT',
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    plotId: input.plotId,
    projectId: plot.project_id, // flows into the project if already included
    phase: 'PLOT',
    categoryId,
    payType: input.payType,
    counterpartyName: plot.seller_name,
    description: input.note ?? null,
    createdBy: input.createdBy,
  });

  if (input.receiptUri) {
    await addDocument({
      entityType: 'transaction',
      entityId: txn.id,
      label: 'photoReceipt',
      fileUri: input.receiptUri,
    });
  }
}

export interface PlotExpenseInput {
  plotId: string;
  categoryId: string;
  amount: number;
  date: string;
  accountId: string;
  note?: string | null;
  receiptUri?: string | null;
  createdBy?: string;
}

/**
 * A plot-side expense (tax, transfer fee, naqsha, …): an OUT transaction on
 * the chosen account tagged to the plot. Adds ON TOP of the deal price.
 */
export async function addPlotExpense(input: PlotExpenseInput): Promise<void> {
  const plot = await getPlot(input.plotId);
  if (!plot) throw new Error(`addPlotExpense: plot ${input.plotId} not found`);
  // A plot inside a COMPLETED project is read-only (V-7).
  if (plot.project_id) await assertProjectActive(plot.project_id);

  const txn = await addTransaction({
    direction: 'OUT',
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    plotId: input.plotId,
    projectId: plot.project_id,
    phase: 'PLOT',
    categoryId: input.categoryId,
    description: input.note ?? null,
    createdBy: input.createdBy,
  });

  if (input.receiptUri) {
    await addDocument({
      entityType: 'transaction',
      entityId: txn.id,
      label: 'photoReceipt',
      fileUri: input.receiptUri,
    });
  }
}

export interface PlotSummary {
  plot: PlotRow;
  dealPrice: number;
  /** Σ "Plot Payment" instalments to the seller. */
  paidToSeller: number;
  /** Deal price minus what has been paid to the seller. */
  remaining: number;
  /** Σ other PLOT-phase OUT (tax, transfer fee, …). */
  expenses: number;
  /** Everything spent on the plot so far: paidToSeller + expenses. */
  totalCost: number;
  /** Standalone sale: agreed price with the buyer (0 = not for sale). */
  salePrice: number;
  /** Σ live buyer receipts on the standalone sale. */
  saleReceived: number;
  /** salePrice − saleReceived. */
  saleOutstanding: number;
  /** saleReceived − totalCost once a sale exists (the flip's profit story). */
  saleProfit: number;
}

/**
 * The plot card math, exactly as the owner reads it:
 *   deal 1000 → token 50  → paid 50,  remaining 950
 *             → bayana 200 → paid 250, remaining 750
 *   tax 100 → expenses 100; totalCost = paid + expenses.
 */
export async function getPlotSummary(plotId: string): Promise<PlotSummary> {
  const db = await getDatabase();
  const plot = await getPlot(plotId);
  if (!plot) throw new Error(`getPlotSummary: plot ${plotId} not found`);

  const row = await db.getFirstAsync<{ paid: number; expenses: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN c.name_en = 'Plot Payment' THEN t.amount ELSE 0 END), 0) AS paid,
       COALESCE(SUM(CASE WHEN c.name_en IS NULL OR c.name_en <> 'Plot Payment' THEN t.amount ELSE 0 END), 0) AS expenses
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.plot_id = ? AND t.direction = 'OUT' AND t.is_void = 0`,
    plotId
  );
  const sold = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(t.amount), 0) AS s
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.plot_id = ? AND t.direction = 'IN' AND t.is_void = 0 AND c.name_en = 'Plot Sale'`,
    plotId
  );

  const paidToSeller = row?.paid ?? 0;
  const expenses = row?.expenses ?? 0;
  const totalCost = paidToSeller + expenses;
  const salePrice = plot.sale_price ?? 0;
  const saleReceived = sold?.s ?? 0;
  return {
    plot,
    dealPrice: plot.deal_price,
    paidToSeller,
    remaining: Math.max(0, plot.deal_price - paidToSeller),
    expenses,
    totalCost,
    salePrice,
    saleReceived,
    saleOutstanding: Math.max(0, salePrice - saleReceived),
    saleProfit: salePrice > 0 ? saleReceived - totalCost : 0,
  };
}

/**
 * STANDALONE PLOT SALE — a plot can be flipped WITHOUT ever joining a
 * project: agree a price with a buyer, then receive instalments (below).
 * Blocked for plots inside projects (their sale goes through the project).
 */
export async function setPlotSale(input: {
  plotId: string;
  salePrice: number;
  buyerName?: string | null;
}): Promise<void> {
  const plot = await getPlot(input.plotId);
  if (!plot) throw new Error(`setPlotSale: plot ${input.plotId} not found`);
  if (plot.project_id) throw new Error('setPlotSale: plot belongs to a project — sell via the project');
  if (input.salePrice <= 0) throw new Error('setPlotSale: sale price must be positive');
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE plots SET sale_price = ?, buyer_name = ? WHERE id = ?',
    input.salePrice,
    input.buyerName ?? plot.buyer_name,
    input.plotId
  );
}

/**
 * Buyer money for a standalone plot sale: an IN transaction on the chosen
 * account (category "Plot Sale"), tagged to the plot. When the full price has
 * arrived the plot flips to SOLD — it can never be offered to a project again.
 * VALIDATION: the buyer can never pay more than what is still outstanding.
 */
export async function addPlotSaleReceipt(input: {
  plotId: string;
  amount: number;
  date: string;
  accountId: string;
  payType?: PayType | null;
  createdBy?: string;
}): Promise<void> {
  if (input.amount <= 0) throw new Error('addPlotSaleReceipt: amount must be positive');
  const summary = await getPlotSummary(input.plotId);
  const { plot } = summary;
  if (plot.project_id) throw new Error('addPlotSaleReceipt: plot belongs to a project');
  if (!plot.sale_price) throw new Error('addPlotSaleReceipt: set the sale price first');
  if (input.amount > summary.saleOutstanding + 0.001) {
    throw new LimitExceededError(summary.saleOutstanding, input.amount);
  }

  const categoryId = await categoryIdByName('Plot Sale', 'INCOME', 'Plot ki farokht');
  await addTransaction({
    direction: 'IN',
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    plotId: input.plotId,
    phase: 'SALE',
    categoryId,
    payType: input.payType ?? null,
    counterpartyName: plot.buyer_name,
    createdBy: input.createdBy,
  });

  // Fully received → the plot is SOLD.
  if (summary.saleReceived + input.amount >= plot.sale_price - 0.001) {
    const db = await getDatabase();
    await db.runAsync("UPDATE plots SET status = 'SOLD' WHERE id = ?", input.plotId);
  }
}

/** All plots with their summaries, newest first (the Plots list). */
export async function listPlotSummaries(status?: PlotStatus): Promise<PlotSummary[]> {
  const plots = await listPlots(status);
  return Promise.all(plots.map((p) => getPlotSummary(p.id)));
}

/**
 * Include a plot in a project: link both ways, flip status, and backfill
 * `project_id` onto the plot's existing transactions so project-level expense
 * sums (settlement, totals) automatically include the plot's history.
 */
export async function includePlotInProject(plotId: string, projectId: string): Promise<void> {
  const db = await getDatabase();
  await assertPlotIncludable(plotId, projectId);
  await db.withExclusiveTransactionAsync(async (tx) => {
    await linkPlotToProject(tx, plotId, projectId);
  });
}

/** Thrown when a plot is already claimed by another project (or sold). */
export class PlotUnavailableError extends Error {
  constructor(public readonly plotId: string) {
    super('PLOT_UNAVAILABLE');
    this.name = 'PlotUnavailableError';
  }
}

/** True when an error from a save action is the plot-availability guard. */
export function isPlotUnavailable(e: unknown): e is PlotUnavailableError {
  return e instanceof Error && e.message === 'PLOT_UNAVAILABLE';
}

/** Validate that a plot exists and isn't already claimed by another project. */
export async function assertPlotIncludable(plotId: string, projectId: string): Promise<void> {
  const plot = await getPlot(plotId);
  if (!plot) throw new Error(`includePlotInProject: plot ${plotId} not found`);
  if (plot.status === 'SOLD' || (plot.project_id && plot.project_id !== projectId)) {
    throw new PlotUnavailableError(plotId);
  }
}

/**
 * The link/backfill writes behind `includePlotInProject`, runnable inside an
 * already-open transaction (used by `createProject` so project + plot link
 * commit atomically). Callers validate with `assertPlotIncludable` first.
 */
export async function linkPlotToProject(
  tx: { runAsync: (sql: string, ...params: (string | number | null)[]) => Promise<unknown> },
  plotId: string,
  projectId: string
): Promise<void> {
  await tx.runAsync(
    "UPDATE plots SET project_id = ?, status = 'IN_PROJECT' WHERE id = ?",
    projectId,
    plotId
  );
  await tx.runAsync('UPDATE projects SET plot_id = ? WHERE id = ?', plotId, projectId);
  await tx.runAsync('UPDATE transactions SET project_id = ? WHERE plot_id = ?', projectId, plotId);
}

export interface TransferDeadlineRow {
  plot_id: string;
  plot_name: string;
  project_id: string | null;
  transfer_deadline: string;
}

/** Plots with a transfer deadline set (deadline reminders / home warning). */
export async function listTransferDeadlines(): Promise<TransferDeadlineRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransferDeadlineRow>(
    `SELECT id AS plot_id, name AS plot_name, project_id, transfer_deadline
     FROM plots WHERE transfer_deadline IS NOT NULL AND transfer_date IS NULL AND company_id = ?
     ORDER BY transfer_deadline ASC`,
    requireCompanyId()
  );
}
