import { getDatabase } from '../database';
import type { ProjectStatus } from '../schema';

/**
 * Cross-repository validation guards. Kept in their own module (importing only
 * the database) so labor/sales/investors can guard against writes on a closed
 * project without importing projects.ts (which imports them back).
 */

/** Thrown when a write targets a project that is no longer ACTIVE. */
export class ProjectClosedError extends Error {
  constructor(public readonly projectId: string, public readonly status: ProjectStatus) {
    super('PROJECT_CLOSED');
    this.name = 'ProjectClosedError';
  }
}

/** True when an error from a save action is the closed-project guard. */
export function isProjectClosed(e: unknown): e is ProjectClosedError {
  return e instanceof Error && e.message === 'PROJECT_CLOSED';
}

/**
 * Every mutating flow on a project (expenses, investors, labor, sale receipts)
 * calls this first: a COMPLETED/CANCELLED project is read-only.
 */
export async function assertProjectActive(projectId: string): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ status: ProjectStatus }>(
    'SELECT status FROM projects WHERE id = ?',
    projectId
  );
  if (!row) throw new Error(`assertProjectActive: project ${projectId} not found`);
  if (row.status !== 'ACTIVE') throw new ProjectClosedError(projectId, row.status);
}
