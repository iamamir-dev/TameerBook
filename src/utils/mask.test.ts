import { describe, expect, it } from 'vitest';

import { applyMask, formatCnic, formatPhone, maskDigits } from './mask';

describe('formatCnic', () => {
  it('formats 13 digits as #####-#######-#', () => {
    expect(formatCnic('3110134469825')).toBe('31101-3446982-5');
  });

  it('strips non-digits from any input', () => {
    expect(formatCnic('31101 3446982 5')).toBe('31101-3446982-5');
  });

  it('is idempotent on an already-formatted value', () => {
    expect(formatCnic('31101-3446982-5')).toBe('31101-3446982-5');
  });

  it('formats partial input as you type', () => {
    expect(formatCnic('311')).toBe('311');
    expect(formatCnic('311013')).toBe('31101-3');
    expect(formatCnic('311013446982')).toBe('31101-3446982');
  });

  it('caps at 13 digits', () => {
    expect(formatCnic('311013446982599999')).toBe('31101-3446982-5');
  });
});

describe('formatPhone', () => {
  it('formats a PK mobile as ####-#######', () => {
    expect(formatPhone('03001234567')).toBe('0300-1234567');
  });

  it('is idempotent and strips separators', () => {
    expect(formatPhone('0300-1234567')).toBe('0300-1234567');
  });

  it('formats partial input', () => {
    expect(formatPhone('0300')).toBe('0300');
    expect(formatPhone('03001')).toBe('0300-1');
  });

  it('caps at 11 digits', () => {
    expect(formatPhone('030012345679999')).toBe('0300-1234567');
  });
});

describe('applyMask / maskDigits', () => {
  it('dispatches by mask type', () => {
    expect(applyMask('cnic', '3110134469825')).toBe('31101-3446982-5');
    expect(applyMask('phone', '03001234567')).toBe('0300-1234567');
  });

  it('recovers bare digits behind a masked value', () => {
    expect(maskDigits('31101-3446982-5')).toBe('3110134469825');
  });
});
