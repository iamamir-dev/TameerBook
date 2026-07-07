import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';

/**
 * expo-sqlite access. A single shared connection is opened lazily; migrations
 * + default seeding run once via `initDatabase()` (called from App on launch).
 */

const DATABASE_NAME = 'tameerbook.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/** Open (once) and return the shared database connection. */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync(DATABASE_NAME);
  return dbInstance;
}

/** Run migrations + seed defaults. Idempotent  safe on every launch. */
export async function initDatabase(): Promise<void> {
  const db = await getDatabase();
  await runMigrations(db);
}
