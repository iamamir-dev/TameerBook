import { describe, expect, it } from 'vitest';

import { inRange, periodRange } from './period';

// 2026-08-29 is a Saturday.
const TODAY = '2026-08-29';

describe('periodRange', () => {
  it('today = the single day', () => {
    expect(periodRange('today', TODAY)).toEqual({ start: TODAY, end: TODAY });
  });

  it('week runs Monday → Sunday around the anchor', () => {
    expect(periodRange('week', TODAY)).toEqual({ start: '2026-08-24', end: '2026-08-30' });
    expect(periodRange('week', '2026-08-24').start).toBe('2026-08-24');
    expect(periodRange('week', '2026-08-30')).toEqual({ start: '2026-08-24', end: '2026-08-30' });
  });

  it('month spans the calendar month', () => {
    expect(periodRange('month', TODAY)).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(periodRange('month', '2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('quarter spans the calendar quarter', () => {
    expect(periodRange('quarter', TODAY)).toEqual({ start: '2026-07-01', end: '2026-09-30' });
    expect(periodRange('quarter', '2026-01-05')).toEqual({ start: '2026-01-01', end: '2026-03-31' });
    expect(periodRange('quarter', '2026-12-31')).toEqual({ start: '2026-10-01', end: '2026-12-31' });
  });

  it('year spans the calendar year; all is unbounded', () => {
    expect(periodRange('year', TODAY)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(periodRange('all', TODAY)).toEqual({ start: null, end: null });
  });
});

describe('inRange', () => {
  const r = { start: '2026-08-01', end: '2026-08-31' };
  it('bounds are inclusive', () => {
    expect(inRange('2026-08-01', r)).toBe(true);
    expect(inRange('2026-08-31', r)).toBe(true);
    expect(inRange('2026-07-31', r)).toBe(false);
    expect(inRange('2026-09-01', r)).toBe(false);
  });
  it('open ranges pass everything on the open side', () => {
    expect(inRange('1999-01-01', { start: null, end: null })).toBe(true);
    expect(inRange('2026-08-05', { start: '2026-08-01', end: null })).toBe(true);
  });
});
