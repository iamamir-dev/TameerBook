import { describe, expect, it } from 'vitest';

import { computeInvestorStanding } from './investorMath';

describe('computeInvestorStanding', () => {
  it('all cash staked, no profit → available 0', () => {
    const s = computeInvestorStanding({ receivedCash: 200, paidOutCash: 0, realizedProfit: 0, netStaked: 200 });
    expect(s).toMatchObject({ invested: 200, profit: 0, total: 200, staked: 200, available: 0 });
  });

  it('idle cash not yet staked shows as available', () => {
    const s = computeInvestorStanding({ receivedCash: 37500, paidOutCash: 0, realizedProfit: 0, netStaked: 32500 });
    expect(s.available).toBe(5000);
  });

  it('settled project (no payout): capital returned + profit → total 300, all available', () => {
    // received 200, profit 100, capital returned (netStaked 0), nothing paid out
    const s = computeInvestorStanding({ receivedCash: 200, paidOutCash: 0, realizedProfit: 100, netStaked: 0 });
    expect(s.total).toBe(300);
    expect(s.available).toBe(300);
  });

  it('reinvesting the balance moves it from available to staked, total unchanged', () => {
    const s = computeInvestorStanding({ receivedCash: 200, paidOutCash: 0, realizedProfit: 100, netStaked: 300 });
    expect(s.total).toBe(300);
    expect(s.available).toBe(0);
  });

  it('fully paid out (capital + profit as cash) → total 0', () => {
    const s = computeInvestorStanding({ receivedCash: 200, paidOutCash: 300, realizedProfit: 100, netStaked: 0 });
    expect(s.total).toBe(0);
    expect(s.available).toBe(0);
  });

  it('available never goes negative', () => {
    const s = computeInvestorStanding({ receivedCash: 100, paidOutCash: 0, realizedProfit: 0, netStaked: 500 });
    expect(s.available).toBe(0);
  });

  it('realized loss reduces total', () => {
    const s = computeInvestorStanding({ receivedCash: 200, paidOutCash: 0, realizedProfit: -50, netStaked: 0 });
    expect(s.total).toBe(150);
    expect(s.available).toBe(150);
  });
});
