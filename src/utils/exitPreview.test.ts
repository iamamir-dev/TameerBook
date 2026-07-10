import { describe, expect, it } from 'vitest';

import {
  computeExitPreview,
  type ExitParticipantInput,
  type ExitShareInput,
} from './exitPreview';

/** Two partners: Ali 600 (60%), Bilal 400 (40%). Ali is leaving. */
const shares: ExitShareInput[] = [
  { projectInvestorId: 'pi-ali', name: 'Ali', capital: 600 },
  { projectInvestorId: 'pi-bilal', name: 'Bilal', capital: 400 },
];
const pis: ExitParticipantInput[] = [
  { id: 'pi-ali', profit_pct: 50 },
  { id: 'pi-bilal', profit_pct: 30 },
];

const base = {
  shares,
  pis,
  leaverPiId: 'pi-ali',
  portion: 0,
  buyerPiId: null,
  newInvestorName: '',
  ownerLabel: 'Owner',
  buyerFallbackLabel: 'New investor',
};

const row = <T extends { name: string }>(rows: T[], name: string): T =>
  rows.find((r) => r.name === name)!;

describe('computeExitPreview', () => {
  it('returns the current split unchanged until a leaver and scenario are chosen', () => {
    const { before, after } = computeExitPreview({ ...base, leaverPiId: null, scenario: null });
    expect(before).toEqual(after);
    expect(row(before, 'Ali').ownership).toBeCloseTo(60);
    expect(row(before, 'Bilal').ownership).toBeCloseTo(40);
  });

  it('PARTNER_BUY moves the capital and profit % onto the buyer', () => {
    const { after } = computeExitPreview({ ...base, scenario: 'PARTNER_BUY', buyerPiId: 'pi-bilal' });
    expect(row(after, 'Ali')).toMatchObject({ capital: 0, pct: 0, ownership: 0 });
    expect(row(after, 'Bilal')).toMatchObject({ capital: 1000, pct: 80 });
    expect(row(after, 'Bilal').ownership).toBeCloseTo(100);
  });

  it('NEW_INVESTOR appends the buyer with the leaver stake and %', () => {
    const { after } = computeExitPreview({ ...base, scenario: 'NEW_INVESTOR', newInvestorName: 'Chaudhry' });
    expect(row(after, 'Chaudhry')).toMatchObject({ capital: 600, pct: 50 });
    expect(row(after, 'Chaudhry').ownership).toBeCloseTo(60);
    expect(row(after, 'Ali').ownership).toBe(0);
  });

  it('NEW_INVESTOR falls back to the placeholder label when unnamed', () => {
    const { after } = computeExitPreview({ ...base, scenario: 'NEW_INVESTOR' });
    expect(row(after, 'New investor').capital).toBe(600);
  });

  it('OWNER_BUY appends the owner row instead', () => {
    const { after } = computeExitPreview({ ...base, scenario: 'OWNER_BUY' });
    expect(row(after, 'Owner')).toMatchObject({ capital: 600, pct: 50 });
  });

  it('PARTIAL removes only the portion and keeps the leaver profit %', () => {
    const { after } = computeExitPreview({ ...base, scenario: 'PARTIAL', portion: 200 });
    expect(row(after, 'Ali')).toMatchObject({ capital: 400, pct: 50 });
    expect(row(after, 'Ali').ownership).toBeCloseTo(50);
    expect(row(after, 'Bilal').ownership).toBeCloseTo(50);
  });

  it('COMMITTED_UNPAID cancels the stake — capital leaves the pool entirely', () => {
    const { after } = computeExitPreview({ ...base, scenario: 'COMMITTED_UNPAID' });
    expect(row(after, 'Ali')).toMatchObject({ capital: 0, pct: 0 });
    expect(row(after, 'Bilal').ownership).toBeCloseTo(100);
  });

  it('never produces negative capital when the portion exceeds the stake', () => {
    const { after } = computeExitPreview({ ...base, scenario: 'PARTIAL', portion: 10_000 });
    expect(row(after, 'Ali').capital).toBe(0);
  });

  it('the before column is never mutated by the scenario', () => {
    const { before } = computeExitPreview({ ...base, scenario: 'PARTNER_BUY', buyerPiId: 'pi-bilal' });
    expect(row(before, 'Ali')).toMatchObject({ capital: 600 });
    expect(row(before, 'Ali').ownership).toBeCloseTo(60);
  });
});
