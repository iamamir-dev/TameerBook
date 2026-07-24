import { describe, expect, it } from 'vitest';

import type { TransactionRow } from '@/db';
import { groupTxnActivity } from './bookingBatch';

const txn = (id: string, amount: number, poBatch: string | null): TransactionRow =>
  ({ id, amount, po_batch_id: poBatch, direction: 'OUT', date: '2026-07-23' } as unknown as TransactionRow);

describe('groupTxnActivity', () => {
  it('collapses payments sharing a po_batch_id into one summed group', () => {
    const groups = groupTxnActivity([txn('a', 2800, 'B1'), txn('b', 480, 'B1')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('B1');
    expect(groups[0].total).toBe(3280);
    expect(groups[0].isBatch).toBe(true);
    expect(groups[0].txns).toHaveLength(2);
  });

  it('keeps non-batch transactions separate', () => {
    const groups = groupTxnActivity([txn('a', 500, null), txn('b', 300, null)]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => !g.isBatch)).toBe(true);
  });

  it('treats a lone batched payment as a single (non-batch) row', () => {
    const groups = groupTxnActivity([txn('a', 500, 'B9')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].isBatch).toBe(false);
    expect(groups[0].total).toBe(500);
  });

  it('preserves first-appearance order and interleaves correctly', () => {
    const groups = groupTxnActivity([txn('a', 100, 'B1'), txn('b', 50, null), txn('c', 200, 'B1')]);
    expect(groups.map((g) => g.id)).toEqual(['B1', 'b']);
    expect(groups[0].total).toBe(300);
  });
});
