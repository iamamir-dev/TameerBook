import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CATEGORIES, DEFAULT_USER, MIGRATIONS } from './schema';
import { nowISO, uuid } from './uuid';

/**
 * Apply any pending migrations using SQLite's `PRAGMA user_version` as the
 * applied-version marker, then seed defaults. Safe to call on every launch:
 * already-applied migrations are skipped, and seeding is idempotent.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    // Run DDL directly (not inside an explicit transaction): the schema sets
    // `PRAGMA journal_mode = WAL`, which is rejected inside a transaction.
    await db.execAsync(migration.sql);
    // PRAGMA can't be parameterized; version is an integer literal we control.
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }

  await seedDefaults(db);
}

/** Insert the default expense/income categories once (when none exist yet). */
export async function seedDefaults(db: SQLiteDatabase): Promise<void> {
  const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM categories');
  if ((count?.c ?? 0) > 0) return;

  const createdAt = nowISO();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const cat of DEFAULT_CATEGORIES) {
      await tx.runAsync(
        `INSERT INTO categories (id, created_at, created_by, parent_id, name_en, name_ur, type, icon)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
        uuid(),
        createdAt,
        DEFAULT_USER,
        cat.name_en,
        cat.name_ur,
        cat.type,
        cat.icon
      );
    }
  });
}
