/**
 * Compact rupee labels for chart axes and bar ends: 12.5L, 3.2Cr, 45K.
 * Pure + unit-tested.
 */
const trim = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

export function shortRupees(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1e7) return `${sign}${trim(Math.round((abs / 1e7) * 10) / 10)}Cr`;
  if (abs >= 1e5) return `${sign}${trim(Math.round((abs / 1e5) * 10) / 10)}L`;
  if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}K`;
  return `${sign}${Math.round(abs)}`;
}
