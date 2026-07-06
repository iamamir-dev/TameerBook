import { getDatabase } from '../database';
import {
  DEFAULT_MILESTONES,
  DEFAULT_USER,
  PROJECT_STAGES,
  type ProfitMethod,
  type ProjectRow,
  type ProjectStage,
  type ProjectStageHistoryRow,
  type ProjectStatus,
} from '../schema';
import { nowISO, uuid } from '../uuid';
import { getProjectProgress } from './milestones';
import { getProjectTotals } from './transactions';

export interface NewProject {
  name: string;
  stage?: ProjectStage;
  startDate?: string | null;
  profitMethod?: ProfitMethod;
  status?: ProjectStatus;
  createdBy?: string;
}

/**
 * Create a project and (by default) seed its 9 standard construction
 * milestones so progress tracking works out of the box.
 */
export async function createProject(
  input: NewProject,
  opts: { withDefaultMilestones?: boolean } = {}
): Promise<ProjectRow> {
  const { withDefaultMilestones = true } = opts;
  const db = await getDatabase();
  const id = uuid();
  const createdAt = nowISO();
  const createdBy = input.createdBy ?? DEFAULT_USER;

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO projects (id, created_at, created_by, name, stage, start_date, profit_method, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      createdAt,
      createdBy,
      input.name,
      input.stage ?? 'TOKEN_PAID',
      input.startDate ?? null,
      input.profitMethod ?? 'SIMPLE',
      input.status ?? 'ACTIVE'
    );

    if (withDefaultMilestones) {
      for (const ms of DEFAULT_MILESTONES) {
        await tx.runAsync(
          `INSERT INTO milestones (id, created_at, created_by, project_id, name, sequence, pct_weight, status, completed_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL)`,
          uuid(),
          createdAt,
          createdBy,
          id,
          ms.name,
          ms.sequence,
          ms.pct_weight
        );
      }
    }
  });

  return getProject(id) as Promise<ProjectRow>;
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<ProjectRow>('SELECT * FROM projects WHERE id = ?', id);
}

export async function listProjects(): Promise<ProjectRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<ProjectRow>('SELECT * FROM projects ORDER BY created_at DESC');
}

/** Advance/set a project's pipeline stage. */
export async function setProjectStage(id: string, stage: ProjectStage): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE projects SET stage = ? WHERE id = ?', stage, id);
}

export async function setProjectStatus(id: string, status: ProjectStatus): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE projects SET status = ? WHERE id = ?', status, id);
}

/** The pipeline stage after `stage`, or null if already at the last stage. */
export function nextStage(stage: ProjectStage): ProjectStage | null {
  const idx = PROJECT_STAGES.indexOf(stage);
  if (idx < 0 || idx >= PROJECT_STAGES.length - 1) return null;
  return PROJECT_STAGES[idx + 1];
}

/**
 * Advance a project to the next pipeline stage and record the transition in
 * `project_stage_history`. Returns the updated project, or null if it is
 * already at the final stage (CLOSED).
 */
export async function moveProjectToNextStage(
  id: string,
  createdBy: string = DEFAULT_USER
): Promise<ProjectRow | null> {
  const project = await getProject(id);
  if (!project) throw new Error(`moveProjectToNextStage: project ${id} not found`);
  const next = nextStage(project.stage);
  if (!next) return null;

  const changedAt = nowISO();
  await db_moveStage(id, project.stage, next, changedAt, createdBy);
  return getProject(id);
}

async function db_moveStage(
  projectId: string,
  from: ProjectStage,
  to: ProjectStage,
  changedAt: string,
  createdBy: string
): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO project_stage_history
         (id, created_at, created_by, project_id, from_stage, to_stage, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      uuid(),
      changedAt,
      createdBy,
      projectId,
      from,
      to,
      changedAt
    );
    await tx.runAsync('UPDATE projects SET stage = ? WHERE id = ?', to, projectId);
  });
}

/**
 * Move a project to a specific stage (not necessarily the next one) and record
 * the transition. No-op if it's already at that stage.
 */
export async function changeProjectStage(
  id: string,
  to: ProjectStage,
  createdBy: string = DEFAULT_USER
): Promise<ProjectRow | null> {
  const project = await getProject(id);
  if (!project) throw new Error(`changeProjectStage: project ${id} not found`);
  if (project.stage === to) return project;
  await db_moveStage(id, project.stage, to, nowISO(), createdBy);
  return getProject(id);
}

export async function listStageHistory(projectId: string): Promise<ProjectStageHistoryRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<ProjectStageHistoryRow>(
    'SELECT * FROM project_stage_history WHERE project_id = ? ORDER BY changed_at DESC',
    projectId
  );
}

export interface ProjectSummary {
  project: ProjectRow;
  progressPercent: number;
  totalIn: number;
  totalOut: number;
}

/** Project + its live progress and money totals (for list/detail cards). */
export async function getProjectSummary(id: string): Promise<ProjectSummary | null> {
  const project = await getProject(id);
  if (!project) return null;
  const [progress, totals] = await Promise.all([
    getProjectProgress(id),
    getProjectTotals(id),
  ]);
  return {
    project,
    progressPercent: progress.percent,
    totalIn: totals.totalIn,
    totalOut: totals.totalOut,
  };
}

/** All projects with summaries, newest first. */
export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const projects = await listProjects();
  const summaries = await Promise.all(projects.map((p) => getProjectSummary(p.id)));
  return summaries.filter((s): s is ProjectSummary => s !== null);
}
