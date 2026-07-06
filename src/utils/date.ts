import dayjs from 'dayjs';

/**
 * Date helpers. Per the UX rules, entry forms default the date to TODAY so a
 * non-technical user never has to open a date picker for the common case.
 */

/** ISO date string for today (yyyy-mm-dd) — the default for new entries. */
export const todayISO = (): string => dayjs().format('YYYY-MM-DD');

/** Friendly display date, e.g. "6 Jun 2026". */
export const formatDisplayDate = (iso: string): string => dayjs(iso).format('D MMM YYYY');

/** Short time, e.g. "3:45 PM" — used on today's entry rows. */
export const formatTime = (iso: string): string => dayjs(iso).format('h:mm A');

/** True if the given ISO date is today. */
export const isToday = (iso: string): boolean => dayjs(iso).isSame(dayjs(), 'day');
