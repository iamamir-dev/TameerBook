import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';

/**
 * expo-sqlite access. A single shared connection is opened lazily; migrations
 * + default seeding run once via `initDatabase()` (called from App on launch).
 */

const DATABASE_NAME = 'tameerbook.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

/** Open (once) and return the shared database connection. */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  // Concurrent first callers share one open (avoids double-opening the file).
  opening ??= (async () => {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    // Per-connection setting: without this, FK constraints are only enforced
    // on the launch that ran the v7 migration and are silently off ever after.
    await db.execAsync('PRAGMA foreign_keys = ON');
    dbInstance = db;
    return db;
  })();
  return opening;
}

/** Run migrations + seed defaults. Idempotent  safe on every launch. */
export async function initDatabase(): Promise<void> {
  const db = await getDatabase();
  await runMigrations(db);
}
