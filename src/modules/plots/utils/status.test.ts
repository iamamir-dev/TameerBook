import { describe, expect, it } from 'vitest';

import type { PlotStatus, PlotSummary } from '@/db';

import { plotStatusMeta } from './status';

/** Build a PlotSummary fixture; only the fields the deriver reads matter. */
function summary(over: {
  status?: PlotStatus;
  dealPrice?: number;
  paidToSeller?: number;
  remaining?: number;
  salePrice?: number;
}): PlotSummary {
  const dealPrice = over.dealPrice ?? 0;
  const paidToSeller = over.paidToSeller ?? 0;
  return {
    plot: { status: over.status ?? 'OWNED' } as PlotSummary['plot'],
    projectName: null,
    dealPrice,
    paidToSeller,
    remaining: over.remaining ?? Math.max(0, dealPrice - paidToSeller),
    expenses: 0,
    totalCost: paidToSeller,
    salePrice: over.salePrice ?? 0,
    saleReceived: 0,
    saleOutstanding: 0,
    saleProfit: 0,
  };
}

describe('plotStatusMeta', () => {
  it('SOLD wins over everything (even a still-open deal / listed price)', () => {
    const m = plotStatusMeta(summary({ status: 'SOLD', dealPrice: 1000, remaining: 400, salePrice: 2000 }));
    expect(m).toEqual({ tone: 'gold', labelKey: 'plotSold' });
  });

  it('IN_PROJECT wins over a stale sale price', () => {
    const m = plotStatusMeta(summary({ status: 'IN_PROJECT', salePrice: 2000 }));
    expect(m).toEqual({ tone: 'primary', labelKey: 'plotInProject' });
  });

  it('standalone + listed for sale → For sale (regardless of deal payment)', () => {
    expect(plotStatusMeta(summary({ dealPrice: 1000, paidToSeller: 1000, salePrice: 1500 })).labelKey).toBe('statusForSale');
    expect(plotStatusMeta(summary({ dealPrice: 1000, paidToSeller: 300, salePrice: 1500 })).labelKey).toBe('statusForSale');
  });

  it('deal fully paid (not listed) → Paid up', () => {
    const m = plotStatusMeta(summary({ dealPrice: 1000, paidToSeller: 1000, remaining: 0 }));
    expect(m).toEqual({ tone: 'success', labelKey: 'statusPaidUp' });
  });

  it('treats a sub-rupee remainder as fully paid (epsilon)', () => {
    expect(plotStatusMeta(summary({ dealPrice: 1000, paidToSeller: 999.9995, remaining: 0.0005 })).labelKey).toBe('statusPaidUp');
  });

  it('some of the deal paid → Part paid', () => {
    const m = plotStatusMeta(summary({ dealPrice: 1000, paidToSeller: 300, remaining: 700 }));
    expect(m).toEqual({ tone: 'gold', labelKey: 'statusPartPaid' });
  });

  it('purchase recorded, nothing paid → Owned', () => {
    const m = plotStatusMeta(summary({ dealPrice: 1000, paidToSeller: 0, remaining: 1000 }));
    expect(m).toEqual({ tone: 'accent', labelKey: 'plotOwned' });
  });

  it('zero-deal plot with no payments is Owned, never "Paid up"', () => {
    expect(plotStatusMeta(summary({ dealPrice: 0, paidToSeller: 0, remaining: 0 })).labelKey).toBe('plotOwned');
  });

  it('every branch returns a valid stage tone', () => {
    const tones = new Set(['primary', 'accent', 'gold', 'success', 'danger']);
    const cases: Parameters<typeof summary>[0][] = [
      { status: 'SOLD' },
      { status: 'IN_PROJECT' },
      { dealPrice: 1000, salePrice: 1500 },
      { dealPrice: 1000, paidToSeller: 1000, remaining: 0 },
      { dealPrice: 1000, paidToSeller: 300, remaining: 700 },
      { dealPrice: 1000, paidToSeller: 0, remaining: 1000 },
    ];
    for (const c of cases) expect(tones.has(plotStatusMeta(summary(c)).tone)).toBe(true);
  });
});
