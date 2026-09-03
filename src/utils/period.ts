import dayjs from 'dayjs';

/** Preset date windows for the money filters (Vyapar-style period picker). */
export const PERIODS = ['today', 'week', 'month', 'quarter', 'year', 'all'] as const;
export type PeriodKind = (typeof PERIODS)[number] | 'custom';

export interface DateRange {
  /** Inclusive ISO day (YYYY-MM-DD); null = unbounded (All time). */
  start: string | null;
  end: string | null;
}

/**
 * The inclusive date window for a preset, anchored on `todayIso` (YYYY-MM-DD).
 * Weeks start Monday (site work runs Mon–Sat); quarters are calendar quarters.
 * Pure — unit-tested; the screen re-derives it whenever the preset changes.
 */
export function periodRange(kind: Exclude<PeriodKind, 'custom'>, todayIso: string): DateRange {
  const d = dayjs(todayIso);
  switch (kind) {
    case 'today':
      return { start: todayIso, end: todayIso };
    case 'week': {
      // dayjs day(): 0 = Sunday … 6 = Saturday → Monday-based offset.
      const offset = (d.day() + 6) % 7;
      const start = d.subtract(offset, 'day');
      return { start: start.format('YYYY-MM-DD'), end: start.add(6, 'day').format('YYYY-MM-DD') };
    }
    case 'month':
      return { start: d.startOf('month').format('YYYY-MM-DD'), end: d.endOf('month').format('YYYY-MM-DD') };
    case 'quarter': {
      const qStartMonth = Math.floor(d.month() / 3) * 3;
      const start = d.month(qStartMonth).startOf('month');
      return { start: start.format('YYYY-MM-DD'), end: start.add(2, 'month').endOf('month').format('YYYY-MM-DD') };
    }
    case 'year':
      return { start: d.startOf('year').format('YYYY-MM-DD'), end: d.endOf('year').format('YYYY-MM-DD') };
    case 'all':
      return { start: null, end: null };
  }
}

/** True when the ISO day falls inside the (inclusive, possibly open) range. */
export function inRange(day: string, range: DateRange): boolean {
  if (range.start && day < range.start) return false;
  if (range.end && day > range.end) return false;
  return true;
}
