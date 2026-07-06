import { getDatabase } from '../database';
import { type MilestoneRow, type MilestoneStatus } from '../schema';

export async function listMilestones(projectId: string): Promise<MilestoneRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<MilestoneRow>(
    'SELECT * FROM milestones WHERE project_id = ? ORDER BY sequence',
    projectId
  );
}

export async function setMilestoneStatus(
  id: string,
  status: MilestoneStatus,
  completedDate: string | null = null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE milestones SET status = ?, completed_date = ? WHERE id = ?',
    status,
    status === 'DONE' ? completedDate : null,
    id
  );
}

export interface ProjectProgress {
  /** Weighted completion 0–100 (sum of pct_weight for DONE milestones). */
  percent: number;
  done: number;
  total: number;
}

/** Weighted construction progress for a project from its milestones. */
export async function getProjectProgress(projectId: string): Promise<ProjectProgress> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ percent: number; done: number; total: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'DONE' THEN pct_weight ELSE 0 END), 0) AS percent,
       COALESCE(SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END), 0) AS done,
       COUNT(*) AS total
     FROM milestones WHERE project_id = ?`,
    projectId
  );
  return {
    percent: row?.percent ?? 0,
    done: row?.done ?? 0,
    total: row?.total ?? 0,
  };
}
