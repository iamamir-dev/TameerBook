import { describe, expect, it } from 'vitest';

import { formatQty, formatSplitQty, hasSecondary, toPrimaryQty, toSecondaryQty, type UnitDef } from './units';

const KG: UnitDef = { primary: 'kg', secondary: 'g', factor: 1000 };
const BORI: UnitDef = { primary: 'bori', secondary: null, factor: null };
const NONE: UnitDef = { primary: null, secondary: null, factor: null };

describe('formatSplitQty', () => {
  it('splits across primary + secondary units', () => {
    expect(formatSplitQty(10.005, KG)).toBe('10 kg 5 g');
    expect(formatSplitQty(10, KG)).toBe('10 kg');
    expect(formatSplitQty(0.005, KG)).toBe('5 g');
    expect(formatSplitQty(0, KG)).toBe('0 kg');
  });

  it('carries a secondary that rounds up to a full primary', () => {
    expect(formatSplitQty(9.9999, KG)).toBe('10 kg');
  });

  it('shows a plain (decimal) value without a secondary unit', () => {
    expect(formatSplitQty(10.5, BORI)).toBe('10.5 bori');
    expect(formatSplitQty(10, BORI)).toBe('10 bori');
    expect(formatSplitQty(3, NONE)).toBe('3');
  });
});

describe('units', () => {
  it('detects a usable secondary unit', () => {
    expect(hasSecondary(KG)).toBe(true);
    expect(hasSecondary(BORI)).toBe(false);
    expect(hasSecondary({ primary: 'kg', secondary: 'g', factor: 0 })).toBe(false);
  });

  it('converts typed qty to the primary unit', () => {
    expect(toPrimaryQty(50, false, KG)).toBe(50); // typed in kg
    expect(toPrimaryQty(50000, true, KG)).toBe(50); // typed in g
    expect(toPrimaryQty(5, true, BORI)).toBe(5); // no secondary → unchanged
  });

  it('converts primary qty to the secondary unit', () => {
    expect(toSecondaryQty(50, KG)).toBe(50000);
    expect(toSecondaryQty(5, BORI)).toBe(5);
  });

  it('formats qty with the equivalent secondary', () => {
    expect(formatQty(50, KG)).toBe('50 kg (50,000 g)');
    expect(formatQty(5, BORI)).toBe('5 bori');
    expect(formatQty(3, NONE)).toBe('3');
  });
});
