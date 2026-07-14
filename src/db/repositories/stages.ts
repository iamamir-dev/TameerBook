import { getDatabase } from '../database';
import { DEFAULT_USER, type StageModule, type StageRow } from '../schema';
import { nowISO, uuid } from '../uuid';

/**
 * User-manageable display statuses (Settings → Statuses). These are labels the
 * builder pins on a project/plot card ("Under Construction", "Possession") —
 * separate from the internal lifecycle enums that drive business rules.
 */

/** Thrown when deleting a status still pinned on a project/plot. */
export class StageInUseError extends Error {
  constructor(public readonly count: number) {
    super('STAGE_IN_USE');
    this.name = 'StageInUseError';
  }
}
export function isStageInUse(e: unknown): e is StageInUseError {
  return e instanceof Error && e.message === 'STAGE_IN_USE';
}

export async function listStages(module: StageModule): Promise<StageRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<StageRow>(
    'SELECT * FROM stages WHERE module = ? ORDER BY sort_order, name_en',
    module
  );
}

export async function addStage(module: StageModule, name: string): Promise<StageRow> {
  const clean = name.trim();
  if (!clean) throw new Error('addStage: name is required');
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO stages (id, created_at, created_by, module, name_en, name_ur, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, 999)`,
    id,
    nowISO(),
    DEFAULT_USER,
    module,
    clean,
    clean
  );
  return (await db.getFirstAsync<StageRow>('SELECT * FROM stages WHERE id = ?', id))!;
}

export async function updateStage(id: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error('updateStage: name is required');
  const db = await getDatabase();
  await db.runAsync('UPDATE stages SET name_en = ?, name_ur = ? WHERE id = ?', clean, clean, id);
}

export async function deleteStage(id: string): Promise<void> {
  const db = await getDatabase();
  const used = await db.getFirstAsync<{ c: number }>(
    `SELECT (SELECT COUNT(*) FROM projects WHERE stage_id = ?) +
            (SELECT COUNT(*) FROM plots WHERE stage_id = ?) AS c`,
    id,
    id
  );
  if ((used?.c ?? 0) > 0) throw new StageInUseError(used?.c ?? 0);
  await db.runAsync('DELETE FROM stages WHERE id = ?', id);
}

/** Persist a new display order (drag-to-reorder): sort_order = position. */
export async function reorderStages(orderedIds: string[]): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.runAsync('UPDATE stages SET sort_order = ? WHERE id = ?', i, orderedIds[i]);
    }
  });
}

/** Pin/clear the display status on a project. */
export async function setProjectStage(projectId: string, stageId: string | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE projects SET stage_id = ? WHERE id = ?', stageId, projectId);
}

/** Pin/clear the display status on a plot. */
export async function setPlotStage(plotId: string, stageId: string | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE plots SET stage_id = ? WHERE id = ?', stageId, plotId);
}
