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
