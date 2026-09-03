import { describe, expect, it } from 'vitest';

import { shortRupees } from './shortRupees';

describe('shortRupees', () => {
  it('uses Pakistani units', () => {
    expect(shortRupees(0)).toBe('0');
    expect(shortRupees(950)).toBe('950');
    expect(shortRupees(45_000)).toBe('45K');
    expect(shortRupees(1_250_000)).toBe('12.5L');
    expect(shortRupees(100_000)).toBe('1L');
    expect(shortRupees(38_070_0683 / 10)).toBe('3.8Cr');
    expect(shortRupees(-200_000)).toBe('−2L');
  });
});
