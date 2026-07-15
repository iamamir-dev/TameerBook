/**
 * Input masks for Pakistani identity/contact fields. Each takes whatever the
 * user typed (digits, dashes, spaces — anything), keeps only the digits, and
 * re-inserts the separators as they type, so the field always reads the way it
 * does on the physical document. The formatted string (with dashes) is what we
 * store — it's human-readable and idempotent to re-format.
 */

export type MaskType = 'cnic' | 'phone';

/** CNIC: 13 digits → `#####-#######-#` (e.g. 31101-3446982-5). */
export function formatCnic(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

/** PK phone: up to 11 digits → `####-#######` (e.g. 0300-1234567). */
export function formatPhone(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 4) return d;
  return `${d.slice(0, 4)}-${d.slice(4)}`;
}

/** Apply the named mask; returns the input unchanged if the mask is unknown. */
export function applyMask(type: MaskType, input: string): string {
  return type === 'cnic' ? formatCnic(input) : formatPhone(input);
}

/** Bare digits behind a masked value (for length checks / validation). */
export function maskDigits(input: string): string {
  return input.replace(/\D/g, '');
}
