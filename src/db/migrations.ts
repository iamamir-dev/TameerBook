import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CATEGORIES, DEFAULT_STAGES, DEFAULT_USER, MIGRATIONS } from './schema';
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
    // `PRAGMA journal_mode = WAL` (v7) is rejected inside a transaction, so
    // that migration runs bare. Everything else runs atomically WITH its
    // user_version bump: a mid-migration failure rolls back cleanly instead
    // of leaving a half-applied schema that re-runs (and breaks) next launch.
    if (/journal_mode/i.test(migration.sql)) {
      await db.execAsync(migration.sql);
      // PRAGMA can't be parameterized; version is an integer literal we control.
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    } else {
      await db.execAsync('BEGIN IMMEDIATE');
      try {
        await db.execAsync(migration.sql);
        await db.execAsync(`PRAGMA user_version = ${migration.version}`);
        await db.execAsync('COMMIT');
      } catch (e) {
        await db.execAsync('ROLLBACK');
        throw e;
      }
    }
  }

  await seedDefaults(db);
}

/**
 * Insert the default expense/income categories once (when none exist yet).
 * Accounts are seeded PER COMPANY by `createCompany`.
 */
export async function seedDefaults(db: SQLiteDatabase): Promise<void> {
  const createdAt = nowISO();

  const catCount = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM categories');
  if ((catCount?.c ?? 0) === 0) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      // Two passes so a child's parent_id resolves to a real, inserted id:
      // top-level headings first, then their sub-categories.
      const idByName = new Map<string, string>();
      const insert = async (cat: (typeof DEFAULT_CATEGORIES)[number], parentId: string | null) => {
        const id = uuid();
        idByName.set(cat.name_en, id);
        await tx.runAsync(
          `INSERT INTO categories (id, created_at, created_by, parent_id, name_en, name_ur, type, icon, is_system, default_unit)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id,
          createdAt,
          DEFAULT_USER,
          parentId,
          cat.name_en,
          cat.name_ur,
          cat.type,
          cat.icon,
          cat.system ? 1 : 0,
          cat.unit ?? null
        );
      };
      for (const cat of DEFAULT_CATEGORIES) if (!cat.parent) await insert(cat, null);
      for (const cat of DEFAULT_CATEGORIES) if (cat.parent) await insert(cat, idByName.get(cat.parent) ?? null);
    });
  }

  const stageCount = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM stages');
  if ((stageCount?.c ?? 0) === 0) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      for (let i = 0; i < DEFAULT_STAGES.length; i++) {
        const st = DEFAULT_STAGES[i];
        await tx.runAsync(
          `INSERT INTO stages (id, created_at, created_by, module, name_en, name_ur, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          uuid(), createdAt, DEFAULT_USER, st.module, st.name_en, st.name_ur, i
        );
      }
    });
  }
}
