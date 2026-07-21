import { getDatabase } from '../database';
import {
  type BookingStatus,
  DEFAULT_USER,
  type MaterialBookingRow,
  type MaterialDeliveryRow,
  type TransactionRow,
} from '../schema';
import { nowISO, uuid } from '../uuid';
import { categoryIdByName } from './categories';
import { requireCompanyId } from './companies';
import { assertProjectActive } from './guards';
import { addTransaction, applyTransactionPatch, getTransaction, insertTransaction, LimitExceededError, type SQLiteExecutor, voidTransaction } from './transactions';

/**
 * MATERIAL BOOKINGS — order material ahead (5000 bricks @ Rs 10), then track
 * two independent balances until both close:
 *   qty:   booked − delivered  = still to RECEIVE
 *   money: total  − paid       = still to PAY
 * Deliveries are plain rows; payments are normal OUT transactions tagged with
 * `booking_id` (so they hit the account, the ledgers, and the project cost
 * like any other cash). Everything derived, nothing double-stored.
 */

export interface NewBooking {
  itemName: string;
  qty: number;
  rate: number;
  unit?: string | null;
  projectId?: string | null;
  partyId?: string | null;
  supplierName?: string | null;
  createdBy?: string;
}

export async function createBooking(input: NewBooking): Promise<MaterialBookingRow> {
  if (input.qty <= 0) throw new Error('createBooking: qty must be positive');
  if (input.rate < 0) throw new Error('createBooking: rate cannot be negative');
  if (input.projectId) await assertProjectActive(input.projectId);
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO material_bookings
       (id, created_at, created_by, company_id, project_id, party_id, supplier_name, item_name, unit, qty, rate, total, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    requireCompanyId(),
    input.projectId ?? null,
    input.partyId ?? null,
    input.supplierName ?? null,
    input.itemName,
    input.unit ?? null,
    input.qty,
    input.rate,
    input.qty * input.rate
  );
  return (await db.getFirstAsync<MaterialBookingRow>(
    'SELECT * FROM material_bookings WHERE id = ?',
    id
  ))!;
}

export interface BookingPatch {
  itemName: string;
  qty: number;
  rate: number;
  unit?: string | null;
  projectId?: string | null;
  partyId?: string | null;
  supplierName?: string | null;
}

/**
 * Edit the booking record itself (item, qty, rate, supplier, project). Guarded
 * so it can't contradict what already happened: the new quantity can't drop
 * below what's been received, and the new order value can't drop below what's
 * already been paid. The project can only change while the booking has no
 * activity (deliveries/payments post cost against the current project).
 */
export async function updateBooking(id: string, patch: BookingPatch): Promise<void> {
  if (patch.qty <= 0) throw new Error('updateBooking: qty must be positive');
  if (patch.rate < 0) throw new Error('updateBooking: rate cannot be negative');

  const s = await getBookingSummary(id);
  if (s.booking.status === 'CANCELLED') throw new Error('updateBooking: cannot edit a cancelled booking');
  if (patch.qty < s.qtyReceived - 0.001) throw new LimitExceededError(s.qtyReceived, patch.qty);

  const total = patch.qty * patch.rate;
  if (total < s.paid - 0.001) throw new LimitExceededError(s.paid, total);

  const hasActivity = s.qtyReceived > 0.001 || s.paid > 0.001;
  const nextProjectId = hasActivity ? s.booking.project_id : patch.projectId ?? null;
  if (nextProjectId && nextProjectId !== s.booking.project_id) await assertProjectActive(nextProjectId);

  const db = await getDatabase();
  await db.runAsync(
    `UPDATE material_bookings
       SET item_name = ?, unit = ?, qty = ?, rate = ?, total = ?, project_id = ?, party_id = ?, supplier_name = ?
     WHERE id = ?`,
    patch.itemName,
    patch.unit ?? null,
    patch.qty,
    patch.rate,
    total,
    nextProjectId,
    patch.partyId ?? null,
    patch.supplierName ?? null,
    id
  );
  await refreshStatus(id);
}

export interface BookingSummary {
  booking: MaterialBookingRow;
  /** Σ delivered qty. */
  qtyReceived: number;
  /** qty − received: what the supplier still owes in material. */
  qtyRemaining: number;
  /** Σ live payments to the supplier for this booking. */
  paid: number;
  /** total − paid: what we still owe in money. */
  payRemaining: number;
  /** Name of the project this booking belongs to (null = general/no project). */
  projectName: string | null;
}

async function summarize(booking: MaterialBookingRow): Promise<BookingSummary> {
  const db = await getDatabase();
  const recv = await db.getFirstAsync<{ s: number }>(
    'SELECT COALESCE(SUM(qty), 0) AS s FROM material_deliveries WHERE booking_id = ?',
    booking.id
  );
  const paid = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS s FROM transactions
     WHERE booking_id = ? AND direction = 'OUT' AND is_void = 0`,
    booking.id
  );
  const project = booking.project_id
    ? await db.getFirstAsync<{ name: string }>(
        'SELECT name FROM projects WHERE id = ?',
        booking.project_id
      )
    : null;
  const qtyReceived = recv?.s ?? 0;
  const paidTotal = paid?.s ?? 0;
  const qtyRemaining = Math.max(0, booking.qty - qtyReceived);
  const payRemaining = Math.max(0, booking.total - paidTotal);

  // Status is DERIVED (except CANCELLED, which the user sets and sticks): a
  // booking is CLOSED once material AND money are both settled. Deriving it here
  // keeps the shown status correct even after a payment is voided — the stored
  // column is only a best-effort hint for SQL ordering.
  const cancelled = booking.status === 'CANCELLED';
  const status: BookingStatus = cancelled ? 'CANCELLED' : qtyRemaining <= 0.001 && payRemaining <= 0.001 ? 'CLOSED' : 'OPEN';

  return {
    booking: { ...booking, status },
    qtyReceived,
    qtyRemaining,
    paid: paidTotal,
    payRemaining,
    projectName: project?.name ?? null,
  };
}

export async function getBookingSummary(id: string): Promise<BookingSummary> {
  const db = await getDatabase();
  const booking = await db.getFirstAsync<MaterialBookingRow>(
    'SELECT * FROM material_bookings WHERE id = ?',
    id
  );
  if (!booking) throw new Error(`getBookingSummary: booking ${id} not found`);
  return summarize(booking);
}

/** All bookings for the company (OPEN first, newest first), with balances. */
export async function listBookingSummaries(): Promise<BookingSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<MaterialBookingRow>(
    'SELECT * FROM material_bookings WHERE company_id = ? ORDER BY created_at DESC',
    requireCompanyId()
  );
  const list = await Promise.all(rows.map(summarize));
  // Sort on the DERIVED status (OPEN first) so a payment-void that reopens a
  // booking floats it back up regardless of the stale stored column.
  return list.sort((a, b) => (a.booking.status === 'OPEN' ? 0 : 1) - (b.booking.status === 'OPEN' ? 0 : 1));
}

export async function listDeliveries(bookingId: string): Promise<MaterialDeliveryRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<MaterialDeliveryRow>(
    'SELECT * FROM material_deliveries WHERE booking_id = ? ORDER BY date DESC, created_at DESC',
    bookingId
  );
}

/** Live supplier payments for a booking, newest first. */
export async function listBookingPayments(bookingId: string): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    `SELECT * FROM transactions WHERE booking_id = ? AND is_void = 0
     ORDER BY date DESC, created_at DESC`,
    bookingId
  );
}

/** Refresh the stored OPEN/CLOSED hint (never touches a CANCELLED booking). */
async function refreshStatus(bookingId: string): Promise<void> {
  const db = await getDatabase();
  const b = await db.getFirstAsync<MaterialBookingRow>('SELECT * FROM material_bookings WHERE id = ?', bookingId);
  if (!b || b.status === 'CANCELLED') return;
  const s = await getBookingSummary(bookingId);
  const done = s.qtyRemaining <= 0.001 && s.payRemaining <= 0.001;
  await db.runAsync('UPDATE material_bookings SET status = ? WHERE id = ?', done ? 'CLOSED' : 'OPEN', bookingId);
}

/** Close a booking early — the supplier won't deliver/settle the rest. */
export async function cancelBooking(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE material_bookings SET status = 'CANCELLED' WHERE id = ?", id);
}

export interface DeliveryInput {
  bookingId: string;
  /** Delivered qty, in the booking's PRIMARY unit (caller normalizes). */
  qty: number;
  date: string;
  /** Project that RECEIVED the material (null/undefined = the booking's project). */
  projectId?: string | null;
  note?: string | null;
  createdBy?: string;
}

/** Validate a delivery against the booking summary (shared by both paths). */
function assertDeliverable(s: BookingSummary, qty: number, date: string): void {
  if (qty <= 0) throw new Error('addDelivery: qty must be positive');
  if (qty > s.qtyRemaining + 0.001) throw new LimitExceededError(s.qtyRemaining, qty);
  if (date < s.booking.created_at.slice(0, 10)) {
    throw new Error('addDelivery: date is before the booking was created');
  }
}

/**
 * Insert the delivery row and, when it goes to a DIFFERENT project than the
 * booking, the paired cash-less cost-transfer (value = qty × rate): an OUT on
 * the receiving project and a netting IN on the booking's project, both under
 * "Material Booking", linked by `transferId`. Runs inside the caller's tx.
 * `materialCatId` is pre-resolved outside the tx (find-or-create can't nest).
 */
async function insertDeliveryRows(
  tx: SQLiteExecutor,
  s: BookingSummary,
  input: DeliveryInput,
  xfer: { transferId: string; materialCatId: string; receivingName: string; sourceName: string } | null
): Promise<void> {
  await tx.runAsync(
    `INSERT INTO material_deliveries (id, created_at, created_by, booking_id, date, qty, project_id, transfer_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uuid(),
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.bookingId,
    input.date,
    input.qty,
    input.projectId ?? null,
    xfer?.transferId ?? null,
    input.note ?? null
  );

  if (!xfer) return;
  const receiving = input.projectId ?? s.booking.project_id!;
  const value = input.qty * s.booking.rate;

  // Cost lands on the RECEIVING project (cash-less OUT — no account), with a
  // self-explanatory record: item, supplier, and where it came from.
  await insertTransaction(tx, {
    direction: 'OUT',
    amount: value,
    date: input.date,
    projectId: receiving,
    phase: 'CONSTRUCTION',
    categoryId: xfer.materialCatId,
    bookingId: input.bookingId,
    qty: input.qty,
    counterpartyName: s.booking.supplier_name,
    description: xfer.sourceName ? `${s.booking.item_name} (from ${xfer.sourceName})` : s.booking.item_name,
    transferId: xfer.transferId,
    createdBy: input.createdBy,
  });

  // Credit removes it from the BOOKING's project (only if it had one), so its
  // construction breakdown nets down — recorded as "sent to <receiving>".
  if (s.booking.project_id) {
    await insertTransaction(tx, {
      direction: 'IN',
      amount: value,
      date: input.date,
      projectId: s.booking.project_id,
      phase: 'CONSTRUCTION',
      categoryId: xfer.materialCatId,
      bookingId: input.bookingId,
      description: `${s.booking.item_name} (to ${xfer.receivingName})`,
      transferId: xfer.transferId,
      createdBy: input.createdBy,
    });
  }
}

/** Resolve the cross-project transfer context (names + ids) before the tx. */
async function resolveXfer(
  s: BookingSummary,
  input: DeliveryInput
): Promise<{ transferId: string; materialCatId: string; receivingName: string; sourceName: string } | null> {
  if (!isCrossProject(s, input.projectId)) return null;
  const receiving = input.projectId ?? s.booking.project_id!;
  return {
    transferId: uuid(),
    materialCatId: await categoryIdByName('Material Booking', 'EXPENSE', 'میٹریل بکنگ', true),
    receivingName: await projectNameOf(receiving),
    sourceName: await projectNameOf(s.booking.project_id),
  };
}

/** True when a delivery goes to a project OTHER than the booking's own (incl.
 *  a general/no-project booking delivered into a project). */
function isCrossProject(s: BookingSummary, receivingProjectId: string | null | undefined): boolean {
  const receiving = receivingProjectId ?? s.booking.project_id ?? null;
  return !!receiving && receiving !== s.booking.project_id;
}

/** Project name for a description (empty string if none). */
async function projectNameOf(id: string | null): Promise<string> {
  if (!id) return '';
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ name: string }>('SELECT name FROM projects WHERE id = ?', id);
  return row?.name ?? '';
}

/**
 * Record material arriving against the booking. Can never receive more than
 * what is still booked, nor be dated before the booking. Delivering to a
 * different project moves the cost there (see `insertDeliveryRows`).
 */
export async function addDelivery(input: DeliveryInput): Promise<void> {
  const s = await getBookingSummary(input.bookingId);
  if (s.booking.project_id) await assertProjectActive(s.booking.project_id);
  assertDeliverable(s, input.qty, input.date);
  if (input.projectId && input.projectId !== s.booking.project_id) await assertProjectActive(input.projectId);

  // Resolve the cross-project transfer BEFORE the exclusive tx (find-or-create
  // + name lookups open their own connections and must not nest).
  const xfer = await resolveXfer(s, input);

  const db = await getDatabase();
  await db.withExclusiveTransactionAsync((tx) => insertDeliveryRows(tx, s, input, xfer));
  await refreshStatus(input.bookingId);
}

/**
 * Receive material AND pay the supplier in ONE atomic write — so a failed
 * payment (insufficient funds / over-limit) can't leave an orphan delivery.
 * Replaces the sheet's previous two-step addDelivery()+payBooking().
 */
export async function receiveAndPay(input: DeliveryInput & { payAmount: number; accountId: string }): Promise<void> {
  const s = await getBookingSummary(input.bookingId);
  if (s.booking.project_id) await assertProjectActive(s.booking.project_id);
  assertDeliverable(s, input.qty, input.date);
  if (input.payAmount <= 0) throw new Error('receiveAndPay: amount must be positive');
  if (input.payAmount > s.payRemaining + 0.001) throw new LimitExceededError(s.payRemaining, input.payAmount);
  if (input.projectId && input.projectId !== s.booking.project_id) await assertProjectActive(input.projectId);

  const xfer = await resolveXfer(s, input);
  const payCatId = await categoryIdByName('Material Booking', 'EXPENSE', 'میٹریل بکنگ', true);

  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await insertDeliveryRows(tx, s, input, xfer);
    // Supplier payment (its own balance guard aborts the whole tx on overdraw).
    await insertTransaction(tx, {
      direction: 'OUT',
      amount: input.payAmount,
      date: input.date,
      accountId: input.accountId,
      projectId: s.booking.project_id,
      phase: s.booking.project_id ? 'CONSTRUCTION' : 'GENERAL',
      categoryId: payCatId,
      partyId: s.booking.party_id,
      counterpartyName: s.booking.supplier_name,
      bookingId: input.bookingId,
      description: input.note ?? s.booking.item_name,
      createdBy: input.createdBy,
    });
  });
  await refreshStatus(input.bookingId);
}

/** Remove a delivery (a wrong entry); voids its cost-transfer legs if any. */
export async function deleteDelivery(deliveryId: string): Promise<void> {
  const db = await getDatabase();
  const d = await db.getFirstAsync<MaterialDeliveryRow>('SELECT * FROM material_deliveries WHERE id = ?', deliveryId);
  if (!d) return;
  if (d.transfer_id) {
    const legs = await db.getAllAsync<{ id: string }>(
      "SELECT id FROM transactions WHERE transfer_id = ? AND is_void = 0",
      d.transfer_id
    );
    for (const leg of legs) await voidTransaction(leg.id);
  }
  await db.runAsync('DELETE FROM material_deliveries WHERE id = ?', deliveryId);
  await refreshStatus(d.booking_id);
}

export interface BookingPaymentInput {
  bookingId: string;
  amount: number;
  date: string;
  accountId: string;
  note?: string | null;
  createdBy?: string;
}

/**
 * Pay the supplier some of the booking value: a normal OUT transaction tagged
 * with the booking (hits the account + project cost when project-linked).
 * VALIDATION: can never pay more than what is still owed on the booking.
 */
export async function payBooking(input: BookingPaymentInput): Promise<void> {
  if (input.amount <= 0) throw new Error('payBooking: amount must be positive');
  const s = await getBookingSummary(input.bookingId);
  if (s.booking.project_id) await assertProjectActive(s.booking.project_id);
  if (input.amount > s.payRemaining + 0.001) {
    throw new LimitExceededError(s.payRemaining, input.amount);
  }
  if (input.date < s.booking.created_at.slice(0, 10)) {
    throw new Error('payBooking: date is before the booking was created');
  }
  const categoryId = await categoryIdByName('Material Booking', 'EXPENSE', 'میٹریل بکنگ', true);
  await addTransaction({
    direction: 'OUT',
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    projectId: s.booking.project_id,
    phase: s.booking.project_id ? 'CONSTRUCTION' : 'GENERAL',
    categoryId,
    partyId: s.booking.party_id,
    counterpartyName: s.booking.supplier_name,
    bookingId: input.bookingId,
    description: input.note ?? `${s.booking.item_name}`,
    createdBy: input.createdBy,
  });
  await refreshStatus(input.bookingId);
}

export interface BookingPaymentPatch {
  amount?: number;
  date?: string;
  accountId?: string;
  note?: string | null;
}

/**
 * Edit a supplier payment IN PLACE. The linked `booking_id` makes it off-limits
 * to the generic `updateTransaction`, so this re-checks the booking-specific
 * rule (can't pay more than is owed, this row's own amount freed) and then
 * applies the shared patch (which re-runs the account overdraw guard).
 */
export async function updateBookingPayment(id: string, patch: BookingPaymentPatch): Promise<void> {
  const t = await getTransaction(id);
  if (!t || t.is_void === 1) throw new Error(`updateBookingPayment: ${id} not found`);
  if (!t.booking_id) throw new Error('updateBookingPayment: not a booking payment');

  const s = await getBookingSummary(t.booking_id);
  const amount = patch.amount ?? t.amount;
  // Owed excluding this row = current remaining + what this row already pays.
  const maxAllowed = s.payRemaining + t.amount;
  if (amount > maxAllowed + 0.001) throw new LimitExceededError(maxAllowed, amount);
  if ((patch.date ?? t.date) < s.booking.created_at.slice(0, 10)) {
    throw new Error('updateBookingPayment: date is before the booking was created');
  }

  await applyTransactionPatch(t, {
    amount,
    date: patch.date,
    accountId: patch.accountId,
    description: patch.note,
  });
  await refreshStatus(t.booking_id);
}

export interface DeliveryEditInput {
  qty: number;
  date: string;
  /** Receiving project (null = the booking's own project). */
  projectId?: string | null;
  note?: string | null;
  createdBy?: string;
}

/**
 * Edit a delivery IN PLACE (qty / date / destination / note). Because a delivery
 * can carry paired cost-transfer legs, editing = remove-then-re-add: the new
 * values are validated FIRST (against the booking, treating this row's own qty as
 * free capacity) so a bad edit is rejected before anything is removed.
 */
export async function updateDelivery(deliveryId: string, input: DeliveryEditInput): Promise<void> {
  const db = await getDatabase();
  const d = await db.getFirstAsync<MaterialDeliveryRow>('SELECT * FROM material_deliveries WHERE id = ?', deliveryId);
  if (!d) throw new Error(`updateDelivery: ${deliveryId} not found`);

  const s = await getBookingSummary(d.booking_id);
  if (input.qty <= 0) throw new Error('updateDelivery: qty must be positive');
  const remainingExcl = s.qtyRemaining + d.qty; // free this row's qty back
  if (input.qty > remainingExcl + 0.001) throw new LimitExceededError(remainingExcl, input.qty);
  if (input.date < s.booking.created_at.slice(0, 10)) {
    throw new Error('updateDelivery: date is before the booking was created');
  }
  if (s.booking.project_id) await assertProjectActive(s.booking.project_id);
  if (input.projectId && input.projectId !== s.booking.project_id) await assertProjectActive(input.projectId);

  // Validated — replace it (deleteDelivery voids any old cost-transfer legs).
  await deleteDelivery(deliveryId);
  await addDelivery({
    bookingId: d.booking_id,
    qty: input.qty,
    date: input.date,
    projectId: input.projectId ?? null,
    note: input.note ?? null,
    createdBy: input.createdBy,
  });
}
