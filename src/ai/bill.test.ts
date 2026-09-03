import { describe, expect, it } from 'vitest';

import { billToMaterialPrefill, billToPurchaseOrderPrefill, coerceBill } from './bill';
import type { WorldNames } from './drafts';

const world: WorldNames = {
  projects: [],
  plots: [],
  accounts: [],
  categories: [
    { id: 'c0', name: 'Materials', type: 'EXPENSE', unit: null, parentId: null },
    { id: 'c1', name: 'Cement', alt: ['سیمنٹ'], type: 'EXPENSE', unit: 'bori', parentId: 'c0' },
    { id: 'c2', name: 'Bajri', type: 'EXPENSE', unit: 'ft', parentId: 'c0' },
  ],
  parties: [{ id: 'p1', name: 'Akram Traders' }],
  workers: [],
  investors: [],
};

describe('coerceBill', () => {
  it('keeps named items, derives missing amounts and rates', () => {
    const b = coerceBill({
      supplier: 'Akram Traders',
      date: '2026-09-01',
      items: [
        { item: 'Cement', qty: 50, rate: 1200 },
        { item: 'Bajri', qty: 100, amount: 8000 },
        { item: '', qty: 3 },
        { name: 'Sariya', amount: '45,000' },
      ],
      confidence: 'high',
    })!;
    expect(b.items).toHaveLength(3);
    expect(b.items[0].amount).toBe(60000);
    expect(b.items[1].rate).toBe(80);
    expect(b.items[2]).toMatchObject({ item: 'Sariya', amount: 45000 });
    expect(b.total).toBe(113000);
    expect(b.confidence).toBe('high');
  });
  it('defaults confidence and drops a bad date', () => {
    const b = coerceBill({ items: [{ item: 'Cement', qty: 1, rate: 1 }], date: '1/9/26', confidence: 'sure' })!;
    expect(b.confidence).toBe('low');
    expect(b.date).toBeUndefined();
  });
  it('returns null for junk', () => {
    expect(coerceBill('x')).toBeNull();
  });
});

describe('bill → prefills', () => {
  const bill = coerceBill({ supplier: 'akram', items: [{ item: 'cement', qty: 50, rate: 1200 }, { item: 'Marble', qty: 20, rate: 900 }] })!;
  it('single line → material prefill with matched category + supplier', () => {
    const one = { ...bill, items: bill.items.slice(0, 1) };
    expect(billToMaterialPrefill(one, world, 'pr1')).toEqual({
      categoryId: 'c1',
      itemName: undefined,
      qty: 50,
      rate: 1200,
      amount: 60000,
      partyId: 'p1',
      projectId: 'pr1',
      date: undefined,
    });
  });
  it('multi line → purchase order prefill, unknown items keep their text', () => {
    const po = billToPurchaseOrderPrefill(bill, world, 'pr1');
    expect(po.partyId).toBe('p1');
    expect(po.supplierName).toBeUndefined();
    expect(po.items).toEqual([
      { categoryId: 'c1', name: 'Cement', qty: 50, rate: 1200 },
      { categoryId: null, name: 'Marble', qty: 20, rate: 900 },
    ]);
  });
});
