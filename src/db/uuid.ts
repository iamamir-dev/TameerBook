/**
 * RFC4122-ish v4 UUID generator.
 *
 * Uses Math.random  sufficient for local primary keys in an offline app.
 * (No native module needed, so it stays Expo Go compatible. Swap for
 * expo-crypto's randomUUID later if cryptographic strength is ever required.)
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Current timestamp as an ISO string  the app's canonical stored format. */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Today's date as a LOCAL 'YYYY-MM-DD'. Attendance/receipts are marked in the
 * user's local day (via `utils/date.todayISO`), so repo "is this today?" checks
 * MUST use the local date too — `nowISO().slice(0,10)` is UTC and drifts a day
 * in +offset zones (e.g. PKT before 5am), desyncing the today's-status lookup.
 */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
