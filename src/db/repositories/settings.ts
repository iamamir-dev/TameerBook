import { getDatabase } from '../database';

/**
 * Persisted app settings as a tiny key/value store (`app_settings` table).
 * The in-memory settings store (`useSettingsStore`) hydrates from here on
 * launch and writes back through `saveSetting` on every change, so preferences
 * (language, dark mode, default investor profit %) survive relaunches.
 */

/** Read every persisted setting as a plain `{ key: value }` map. */
export async function loadSettings(): Promise<Record<string, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM app_settings'
  );
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

/** Upsert a single setting (value is stored as text). */
export async function saveSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value
  );
}
