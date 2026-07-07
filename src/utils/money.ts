/**
 * Money helpers using the Pakistani / South-Asian numbering system, where
 * digits are grouped as the last 3 then pairs of 2 (the lakh/crore system):
 *
 *   2500000  -> "25,00,000"   (25 Lakh)
 *   12345678 -> "1,23,45,678" (1.23 Crore)
 *
 * Kept UI-agnostic so AmountInput, StatCard, and AppListRow all format the
 * same way. No currency symbol is hardcoded here  callers add "Rs" via i18n.
 */

const LAKH = 100_000;
const CRORE = 10_000_000;

/** Strip everything except digits  used to read raw typed input. */
export const digitsOnly = (value: string): string => value.replace(/[^0-9]/g, '');

/**
 * Group an integer string the Pakistani way (last 3, then pairs).
 * Accepts a number or a digit string; returns a grouped string with commas.
 */
export const formatPakistaniGrouping = (value: number | string): string => {
  const digits = typeof value === 'number' ? Math.trunc(Math.abs(value)).toString() : digitsOnly(value);
  if (digits.length === 0) return '';
  const trimmed = digits.replace(/^0+(?=\d)/, ''); // drop leading zeros, keep a lone 0
  if (trimmed.length <= 3) return trimmed;

  const last3 = trimmed.slice(-3);
  const rest = trimmed.slice(0, -3);
  // Group the remaining digits in pairs, from the right.
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${grouped},${last3}`;
};

/** Round to at most one decimal, dropping a trailing ".0". */
const trimDecimal = (n: number): string => {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
};

/**
 * Human-friendly magnitude label, e.g. "25 Lakh", "1.2 Crore", "8 Thousand".
 * `lakhWord` / `croreWord` come from i18n so the same logic works in Roman Urdu.
 */
export const toReadableAmount = (
  value: number,
  lakhWord = 'Lakh',
  croreWord = 'Crore'
): string => {
  const abs = Math.abs(value);
  if (abs >= CRORE) return `${trimDecimal(abs / CRORE)} ${croreWord}`;
  if (abs >= LAKH) return `${trimDecimal(abs / LAKH)} ${lakhWord}`;
  if (abs >= 1000) return `${trimDecimal(abs / 1000)}K`;
  return abs.toString();
};

/** Full display amount with the "Rs" prefix, grouped Pakistani-style. */
export const formatRupees = (value: number): string =>
  `Rs ${formatPakistaniGrouping(value)}`;

/** Quick-add chip amounts surfaced in AmountInput. */
export const QUICK_ADD_AMOUNTS = {
  tenK: 10_000,
  fiftyK: 50_000,
  oneLakh: LAKH,
  fiveLakh: 5 * LAKH,
} as const;

export { LAKH, CRORE };
