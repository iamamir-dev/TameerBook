import { getDatabase } from '../database';
import {
  DEFAULT_USER,
  type MaterialBookingRow,
  type MaterialDeliveryRow,
  type TransactionRow,
} from '../schema';
import { nowISO, uuid } from '../uuid';
import { categoryIdByName } from './categories';
import { requireCompanyId } from './companies';
import { assertProjectActive } from './guards';
import { addTransaction, LimitExceededError } from './transactions';

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
  const qtyReceived = recv?.s ?? 0;
  const paidTotal = paid?.s ?? 0;
  return {
    booking,
    qtyReceived,
    qtyRemaining: Math.max(0, booking.qty - qtyReceived),
    paid: paidTotal,
    payRemaining: Math.max(0, booking.total - paidTotal),
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
    `SELECT * FROM material_bookings WHERE company_id = ?
     ORDER BY CASE status WHEN 'OPEN' THEN 0 ELSE 1 END, created_at DESC`,
    requireCompanyId()
  );
  return Promise.all(rows.map(summarize));
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

/** Flip OPEN→CLOSED once material AND money are both settled. */
async function refreshStatus(bookingId: string): Promise<void> {
  const db = await getDatabase();
  const s = await getBookingSummary(bookingId);
  const done = s.qtyRemaining <= 0.001 && s.payRemaining <= 0.001;
  await db.runAsync(
    'UPDATE material_bookings SET status = ? WHERE id = ?',
    done ? 'CLOSED' : 'OPEN',
    bookingId
  );
}

export interface DeliveryInput {
  bookingId: string;
  qty: number;
  date: string;
  note?: string | null;
  createdBy?: string;
}

/**
 * Record material arriving against the booking.
 * VALIDATION: can never receive more than what is still booked.
 */
export async function addDelivery(input: DeliveryInput): Promise<void> {
  if (input.qty <= 0) throw new Error('addDelivery: qty must be positive');
  const s = await getBookingSummary(input.bookingId);
  if (s.booking.project_id) await assertProjectActive(s.booking.project_id);
  if (input.qty > s.qtyRemaining + 0.001) {
    throw new LimitExceededError(s.qtyRemaining, input.qty);
  }
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO material_deliveries (id, created_at, created_by, booking_id, date, qty, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    uuid(),
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.bookingId,
    input.date,
    input.qty,
    input.note ?? null
  );
  await refreshStatus(input.bookingId);
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
  const categoryId = await categoryIdByName('Material Booking', 'EXPENSE', 'Material booking');
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
