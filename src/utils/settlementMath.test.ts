import { describe, expect, it } from 'vitest';

import {
  allocateProportional,
  computeDistribution,
  equalPctFill,
  OWNER_PARTICIPANT_ID,
  ownershipPctFill,
  type ParticipantInput,
} from './settlementMath';

/** Fixture mirrors the in-app DB test: investors 200 + 300, owner residual 500. */
const P: ParticipantInput[] = [
  { id: 'amir', name: 'Amir', capital: 200, isOwner: false },
  { id: 'bilal', name: 'Bilal', capital: 300, isOwner: false },
  { id: OWNER_PARTICIPANT_ID, name: 'Owner', capital: 500, isOwner: true },
];

const sum = (ns: number[]) => Math.round(ns.reduce((s, n) => s + n, 0) * 100) / 100;

describe('allocateProportional', () => {
  it('always sums exactly to the target', () => {
    const parts = allocateProportional(100, [1, 1, 1]);
    expect(sum(parts)).toBe(100);
  });
  it('zero weights → all to fallback', () => {
    expect(allocateProportional(50, [0, 0], 1)).toEqual([0, 50]);
  });
});

describe('ownership rule (default)', () => {
  it('splits distributable by capital; sadaqah slices restore gross', () => {
    const r = computeDistribution({ participants: P, net: 500, donationPct: 10, rule: { kind: 'ownership' } });
    expect(r.errors).toHaveLength(0);
    expect(r.totalDonation).toBe(50);
    expect(r.distributable).toBe(450);
    // capital ratio 20/30/50 → 90/135/225 net; gross = +10/15/25 sadaqah slices
    expect(r.rows.map((x) => x.profitOrLoss)).toEqual([100, 150, 250]);
    expect(r.rows.map((x) => x.donation)).toEqual([10, 15, 25]);
    expect(r.rows.map((x) => x.payout)).toEqual([290, 435, 725]);
    expect(sum(r.rows.map((x) => x.profitOrLoss))).toBe(500);
  });
});

describe('agreedPct rule', () => {
  it('reproduces the legacy 20/30/50 numbers', () => {
    const r = computeDistribution({
      participants: P,
      net: 500,
      donationPct: 10,
      rule: { kind: 'agreedPct', pctById: { amir: 20, bilal: 30, [OWNER_PARTICIPANT_ID]: 50 } },
    });
    expect(r.errors).toHaveLength(0);
    expect(r.rows.map((x) => x.profitOrLoss)).toEqual([100, 150, 250]);
    expect(r.rows.map((x) => x.payout)).toEqual([290, 435, 725]);
  });
  it('rejects a sum that is not 100', () => {
    const r = computeDistribution({
      participants: P,
      net: 500,
      donationPct: 0,
      rule: { kind: 'agreedPct', pctById: { amir: 20, bilal: 30, [OWNER_PARTICIPANT_ID]: 40 } },
    });
    expect(r.errors.some((e) => e.code === 'PCT_SUM_NOT_100')).toBe(true);
  });
});

describe('ownerFirst rule (the builder-share model)', () => {
  it('owner takes the cut of FULL net; remainder splits by capital incl owner; charity per person', () => {
    const r = computeDistribution({ participants: P, net: 500, donationPct: 10, rule: { kind: 'ownerFirst', ownerPct: 40 } });
    // owner cut 200; remainder 300 → 60/90/150 (+200 owner) = 60/90/350 gross
    expect(r.errors).toHaveLength(0);
    expect(r.rows.map((x) => x.profitOrLoss)).toEqual([60, 90, 350]);
    expect(r.rows.map((x) => x.donation)).toEqual([6, 9, 35]);
    expect(r.totalDonation).toBe(50);
    expect(sum(r.rows.map((x) => x.profitOrLoss))).toBe(500);
  });

  it('charity opt-out: that person keeps their charity portion', () => {
    const r = computeDistribution({
      participants: P,
      net: 500,
      donationPct: 10,
      donationOptOutById: { amir: true },
      rule: { kind: 'ownership' },
    });
    expect(r.rows.map((x) => x.donation)).toEqual([0, 15, 25]);
    expect(r.totalDonation).toBe(40);
    expect(r.rows[0].payout).toBe(300); // 200 capital + 100 full share
  });
});

describe('prefReturn rule (pehla munafa)', () => {
  it('flat: investors get their % on capital, owner keeps the rest', () => {
    const r = computeDistribution({ participants: P, net: 500, donationPct: 0, rule: { kind: 'prefReturn', mode: 'flat', pct: 10, months: 0 } });
    // owed 20/30 → owner 450? distributable=500 → owner 450
    expect(r.rows.map((x) => x.profitOrLoss)).toEqual([20, 30, 450]);
  });
  it('perMonth multiplies by months', () => {
    const r = computeDistribution({ participants: P, net: 500, donationPct: 0, rule: { kind: 'prefReturn', mode: 'perMonth', pct: 2, months: 5 } });
    expect(r.rows.map((x) => x.profitOrLoss)).toEqual([20, 30, 450]);
  });
  it('profit smaller than the promise → proportional to owed, owner 0', () => {
    const r = computeDistribution({ participants: P, net: 30, donationPct: 0, rule: { kind: 'prefReturn', mode: 'flat', pct: 10, months: 0 } });
    expect(r.rows.map((x) => x.profitOrLoss)).toEqual([12, 18, 0]);
  });
});

describe('manual rule', () => {
  it('accepts exact amounts and flags mismatch', () => {
    const ok = computeDistribution({
      participants: P,
      net: 500,
      donationPct: 0,
      rule: { kind: 'manual', amountById: { amir: 100, bilal: 100, [OWNER_PARTICIPANT_ID]: 300 } },
    });
    expect(ok.errors).toHaveLength(0);
    const bad = computeDistribution({
      participants: P,
      net: 500,
      donationPct: 0,
      rule: { kind: 'manual', amountById: { amir: 100 } },
    });
    expect(bad.errors.some((e) => e.code === 'AMOUNT_SUM_MISMATCH')).toBe(true);
  });
});

describe('loss path (rule-independent, Shariah)', () => {
  it('splits −200 by capital regardless of the rule; no sadaqah', () => {
    const r = computeDistribution({
      participants: P,
      net: -200,
      donationPct: 10,
      rule: { kind: 'ownerFirst', ownerPct: 90 },
    });
    expect(r.rows.map((x) => x.profitOrLoss)).toEqual([-40, -60, -100]);
    expect(r.totalDonation).toBe(0);
    expect(r.rows.map((x) => x.payout)).toEqual([160, 240, 400]);
  });
});

describe('edges', () => {
  it('owner-only project → everything to owner', () => {
    const solo: ParticipantInput[] = [{ id: OWNER_PARTICIPANT_ID, name: 'Owner', capital: 1000, isOwner: true }];
    const r = computeDistribution({ participants: solo, net: 300, donationPct: 0, rule: { kind: 'ownership' } });
    expect(r.rows[0].profitOrLoss).toBe(300);
  });
  it('zero capital → profit to owner, no division by zero', () => {
    const zero: ParticipantInput[] = [
      { id: 'a', name: 'A', capital: 0, isOwner: false },
      { id: OWNER_PARTICIPANT_ID, name: 'Owner', capital: 0, isOwner: true },
    ];
    const r = computeDistribution({ participants: zero, net: 100, donationPct: 0, rule: { kind: 'ownership' } });
    expect(r.rows.map((x) => x.profitOrLoss)).toEqual([0, 100]);
  });
  it('fill helpers sum to exactly 100', () => {
    expect(sum(Object.values(equalPctFill(['a', 'b', 'c'])))).toBe(100);
    expect(sum(Object.values(ownershipPctFill(P)))).toBe(100);
  });
});
