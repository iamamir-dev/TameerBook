import { describe, expect, it } from 'vitest';

import {
  CRORE,
  digitsOnly,
  formatPakistaniGrouping,
  formatQty,
  formatRupees,
  LAKH,
  toReadableAmount,
} from './money';

describe('digitsOnly', () => {
  it('strips everything except digits', () => {
    expect(digitsOnly('Rs 1,23,456.78')).toBe('12345678');
    expect(digitsOnly('abc')).toBe('');
    expect(digitsOnly('')).toBe('');
  });
});

describe('formatPakistaniGrouping', () => {
  it('groups the last 3 digits then pairs (lakh/crore system)', () => {
    expect(formatPakistaniGrouping(2_500_000)).toBe('25,00,000');
    expect(formatPakistaniGrouping(12_345_678)).toBe('1,23,45,678');
    expect(formatPakistaniGrouping(1_000)).toBe('1,000');
  });

  it('leaves 3 or fewer digits ungrouped', () => {
    expect(formatPakistaniGrouping(0)).toBe('0');
    expect(formatPakistaniGrouping(999)).toBe('999');
  });

  it('accepts digit strings and drops leading zeros', () => {
    expect(formatPakistaniGrouping('0012345')).toBe('12,345');
    expect(formatPakistaniGrouping('000')).toBe('0');
    expect(formatPakistaniGrouping('')).toBe('');
  });

  it('uses the absolute integer part of numbers', () => {
    expect(formatPakistaniGrouping(-2_500_000)).toBe('25,00,000');
    expect(formatPakistaniGrouping(1234.99)).toBe('1,234');
  });
});

describe('formatQty', () => {
  it('keeps fractional units visible (unlike money truncation)', () => {
    expect(formatQty(10.6)).toBe('10.6');
    expect(formatQty(0.6)).toBe('0.6');
    expect(formatQty(0.25)).toBe('0.25');
    expect(formatQty(0.05)).toBe('0.05');
  });

  it('groups the whole part and drops trailing/zero decimals', () => {
    expect(formatQty(10)).toBe('10');
    expect(formatQty(1_234.5)).toBe('1,234.5');
    expect(formatQty(0)).toBe('0');
    expect(formatQty(2_500_000)).toBe('25,00,000');
  });

  it('handles negatives', () => {
    expect(formatQty(-3.5)).toBe('-3.5');
  });
});

describe('toReadableAmount', () => {
  it('labels lakhs and crores', () => {
    expect(toReadableAmount(2_500_000)).toBe('25 Lakh');
    expect(toReadableAmount(12_300_000)).toBe('1.2 Crore');
    expect(toReadableAmount(LAKH)).toBe('1 Lakh');
    expect(toReadableAmount(CRORE)).toBe('1 Crore');
  });

  it('labels thousands with K and passes small values through', () => {
    expect(toReadableAmount(8_000)).toBe('8K');
    expect(toReadableAmount(999)).toBe('999');
    expect(toReadableAmount(0)).toBe('0');
  });

  it('uses the provided localized words', () => {
    expect(toReadableAmount(2_500_000, 'Lakh (ur)', 'Crore (ur)')).toBe('25 Lakh (ur)');
  });

  it('uses the absolute value for negatives', () => {
    expect(toReadableAmount(-2_500_000)).toBe('25 Lakh');
  });
});

describe('formatRupees', () => {
  it('prefixes Rs and groups Pakistani-style', () => {
    expect(formatRupees(2_500_000)).toBe('Rs 25,00,000');
    expect(formatRupees(0)).toBe('Rs 0');
  });
});
