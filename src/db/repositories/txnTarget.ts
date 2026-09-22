import { getDatabase } from '../database';
import type { TransactionRow } from '../schema';
import { poKeyForBooking } from './bookings';

/**
 * Where a transaction "lives" in a RESTRUCTURED module, so a linked activity row
 * can jump straight to it. Only the restructured modules (Purchase Orders,
 * Investors, Labor) are targeted; everything else returns null.
 */
export type TxnModuleTarget =
  | { kind: 'po'; poId: string }
  | { kind: 'investor'; investorId: string }
  | { kind: 'labor'; laborerId: string };

/** Resolve a transaction's restructured-module page target (null = none). */
export async function resolveTxnModuleTarget(txn: TransactionRow): Promise<TxnModuleTarget | null> {
  if (txn.booking_id) {
    const poId = await poKeyForBooking(txn.booking_id);
    return poId ? { kind: 'po', poId } : null;
  }
  if (txn.investor_id) return { kind: 'investor', investorId: txn.investor_id };
  if (txn.labor_id) {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ laborer_id: string }>(
      'SELECT laborer_id FROM project_laborers WHERE id = ?',
      txn.labor_id
    );
    return row ? { kind: 'labor', laborerId: row.laborer_id } : null;
  }
  return null;
}

/** Batch resolve targets for multiple transactions in at most 2 queries total instead of N. */
export async function batchResolveTxnModuleTargets(
  txns: TransactionRow[]
): Promise<Record<string, TxnModuleTarget>> {
  const result: Record<string, TxnModuleTarget> = {};
  const bookingTxns: { txnId: string; bookingId: string }[] = [];
  const laborTxns: { txnId: string; laborId: string }[] = [];

  for (const t of txns) {
    if (t.investor_id) {
      result[t.id] = { kind: 'investor', investorId: t.investor_id };
    } else if (t.booking_id) {
      bookingTxns.push({ txnId: t.id, bookingId: t.booking_id });
    } else if (t.labor_id) {
      laborTxns.push({ txnId: t.id, laborId: t.labor_id });
    }
  }

  if (bookingTxns.length === 0 && laborTxns.length === 0) {
    return result;
  }

  const db = await getDatabase();

  if (bookingTxns.length > 0) {
    const uniqueBookings = Array.from(new Set(bookingTxns.map((b) => b.bookingId)));
    const placeholders = uniqueBookings.map(() => '?').join(',');
    const rows = await db.getAllAsync<{ id: string; po_id: string | null }>(
      `SELECT id, po_id FROM material_bookings WHERE id IN (${placeholders})`,
      uniqueBookings
    );
    const poMap = new Map<string, string>();
    for (const r of rows) {
      poMap.set(r.id, r.po_id ?? r.id);
    }
    for (const b of bookingTxns) {
      const poId = poMap.get(b.bookingId);
      if (poId) {
        result[b.txnId] = { kind: 'po', poId };
      }
    }
  }

  if (laborTxns.length > 0) {
    const uniqueLabors = Array.from(new Set(laborTxns.map((l) => l.laborId)));
    const placeholders = uniqueLabors.map(() => '?').join(',');
    const rows = await db.getAllAsync<{ id: string; laborer_id: string }>(
      `SELECT id, laborer_id FROM project_laborers WHERE id IN (${placeholders})`,
      uniqueLabors
    );
    const laborMap = new Map<string, string>();
    for (const r of rows) {
      laborMap.set(r.id, r.laborer_id);
    }
    for (const l of laborTxns) {
      const laborerId = laborMap.get(l.laborId);
      if (laborerId) {
        result[l.txnId] = { kind: 'labor', laborerId };
      }
    }
  }

  return result;
}
