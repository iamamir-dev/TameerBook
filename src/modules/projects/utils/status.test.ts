import { describe, expect, it } from 'vitest';

import type { ProjectStatus, ProjectSummary } from '@/db';

import { projectStatusMeta } from './status';

function summary(over: {
  status?: ProjectStatus;
  settledAt?: string | null;
  constructionCost?: number;
  saleDeal?: number;
  saleReceived?: number;
}): ProjectSummary {
  const constructionCost = over.constructionCost ?? 0;
  return {
    project: { status: over.status ?? 'ACTIVE', settled_at: over.settledAt ?? null } as ProjectSummary['project'],
    progressPercent: 0,
    totalIn: 0,
    totalOut: 0,
    cost: { plotCost: 0, constructionCost, saleCost: 0, totalCost: constructionCost },
    saleDeal: over.saleDeal ?? 0,
    saleReceived: over.saleReceived ?? 0,
  };
}

describe('projectStatusMeta', () => {
  it('Cancelled wins over everything', () => {
    expect(projectStatusMeta(summary({ status: 'CANCELLED', saleReceived: 999, saleDeal: 999 }))).toEqual({
      tone: 'danger',
      labelKey: 'statusCancelled',
    });
  });

  it('Completed + settled → Settled; unsettled → Completed', () => {
    expect(projectStatusMeta(summary({ status: 'COMPLETED', settledAt: '2026-01-01' })).labelKey).toBe('statusSettled');
    expect(projectStatusMeta(summary({ status: 'COMPLETED', settledAt: null })).labelKey).toBe('statusDone');
  });

  it('On hold', () => {
    expect(projectStatusMeta(summary({ status: 'ON_HOLD' }))).toEqual({ tone: 'gold', labelKey: 'statusOnHold' });
  });

  it('active + fully received → Sold', () => {
    expect(projectStatusMeta(summary({ saleDeal: 1000, saleReceived: 1000 })).labelKey).toBe('plotSold');
  });

  it('active + listed (deal set, not fully received) → For sale', () => {
    expect(projectStatusMeta(summary({ saleDeal: 1000, saleReceived: 400 })).labelKey).toBe('statusForSale');
  });

  it('active + building (construction spend, no sale) → Construction', () => {
    expect(projectStatusMeta(summary({ constructionCost: 500 })).labelKey).toBe('statusConstruction');
  });

  it('active + nothing yet → Planning', () => {
    expect(projectStatusMeta(summary({})).labelKey).toBe('statusPlanning');
  });

  it('every branch yields a valid stage tone', () => {
    const tones = new Set(['primary', 'accent', 'gold', 'success', 'danger']);
    const cases: Parameters<typeof summary>[0][] = [
      { status: 'CANCELLED' },
      { status: 'COMPLETED', settledAt: '2026-01-01' },
      { status: 'ON_HOLD' },
      { saleDeal: 1000, saleReceived: 1000 },
      { saleDeal: 1000 },
      { constructionCost: 5 },
      {},
    ];
    for (const c of cases) expect(tones.has(projectStatusMeta(summary(c)).tone)).toBe(true);
  });
});
