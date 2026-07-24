import type { TransactionRow } from '@/db';

/**
 * A run of transactions shown as ONE activity row. Booking payments recorded in
 * the same purchase-order action share a `po_batch_id` and collapse into a
 * single group (its amount is their sum); every other transaction stands alone.
 */
export interface TxnActivityGroup {
  /** Stable key: the shared po_batch_id, or the lone transaction's id. */
  id: string;
  /** The grouped transactions (1+), in original order. */
  txns: TransactionRow[];
  /** Σ amount across the group. */
  total: number;
  /** True when this row represents more than one transaction. */
  isBatch: boolean;
}

/**
 * Collapse booking payments that share a `po_batch_id` into one group, so a
 * multi-item "pay supplier" / "receive & pay" action reads as a single row.
 * Order follows first appearance; non-booking rows are untouched.
 */
export function groupTxnActivity(txns: TransactionRow[]): TxnActivityGroup[] {
  const groups: TxnActivityGroup[] = [];
  const byBatch = new Map<string, TxnActivityGroup>();
  for (const t of txns) {
    const batch = t.po_batch_id;
    if (batch) {
      const existing = byBatch.get(batch);
      if (existing) {
        existing.txns.push(t);
        existing.total += t.amount;
        existing.isBatch = true;
        continue;
      }
      const group: TxnActivityGroup = { id: batch, txns: [t], total: t.amount, isBatch: false };
      byBatch.set(batch, group);
      groups.push(group);
    } else {
      groups.push({ id: t.id, txns: [t], total: t.amount, isBatch: false });
    }
  }
  return groups;
}
