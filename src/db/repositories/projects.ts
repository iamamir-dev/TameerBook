import { getDatabase } from '../database';
import {
  DEFAULT_MILESTONES,
  DEFAULT_USER,
  type ProjectRow,
  type ProjectStatus,
} from '../schema';
import { nowISO, uuid } from '../uuid';
import { requireCompanyId } from './companies';
import { assertPlotIncludable, linkPlotToProject } from './plots';
import { getSaleSummary } from './sales';
import { getProjectTotals } from './transactions';

export interface NewProject {
  name: string;
  /** The plot this project builds on (linked + backfilled on create). */
  plotId?: string | null;
  startDate?: string | null;
  status?: ProjectStatus;
  donationPct?: number | null;
  createdBy?: string;
}

/**
 * Create a project  optionally including a plot (links both ways and pulls
 * the plot's transaction history into the project)  and seed its 9 standard
 * construction milestones so progress tracking works out of the box.
 */
export async function createProject(
  input: NewProject,
  opts: { withDefaultMilestones?: boolean } = {}
): Promise<ProjectRow> {
  // Construction "steps"/milestones are retired: projects no longer seed them
  // and nothing in the UI shows them. Callers may still opt in for legacy tests.
  const { withDefaultMilestones = false } = opts;
  const db = await getDatabase();
  const id = uuid();
  const createdAt = nowISO();
  const createdBy = input.createdBy ?? DEFAULT_USER;

  if (input.plotId) await assertPlotIncludable(input.plotId, id);

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO projects (id, created_at, created_by, company_id, name, plot_id, start_date, status, donation_pct)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      id,
      createdAt,
      createdBy,
      requireCompanyId(),
      input.name,
      input.startDate ?? createdAt.slice(0, 10),
      input.status ?? 'ACTIVE',
      input.donationPct ?? null
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

    // Same transaction: a project is never committed without its plot link.
    if (input.plotId) await linkPlotToProject(tx, input.plotId, id);
  });

  return getProject(id) as Promise<ProjectRow>;
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<ProjectRow>('SELECT * FROM projects WHERE id = ?', id);
}

export async function listProjects(): Promise<ProjectRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<ProjectRow>(
    'SELECT * FROM projects WHERE company_id = ? ORDER BY created_at DESC',
    requireCompanyId()
  );
}

export async function setProjectStatus(id: string, status: ProjectStatus): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE projects SET status = ? WHERE id = ?', status, id);
}

export interface CompletionWarnings {
  /** Wages still owed to workers on this project. */
  laborOutstanding: number;
  /** What the buyer still owes on the sale (0 when no sale). */
  saleOutstanding: number;
}

/**
 * Loose ends worth confirming before a manual completion. Completing with
 * either is ALLOWED (real projects end messy) — the UI lists them in the
 * confirm dialog so the choice is deliberate.
 */
export async function getCompletionWarnings(projectId: string): Promise<CompletionWarnings> {
  const db = await getDatabase();
  const labor = await db.getFirstAsync<{ accrued: number; paid: number }>(
    `SELECT
       COALESCE((SELECT SUM(la.wage_accrued) FROM labor_attendance la
         JOIN project_laborers pl ON pl.id = la.project_laborer_id
         WHERE pl.project_id = ?), 0) AS accrued,
       COALESCE((SELECT SUM(t.amount) FROM transactions t
         WHERE t.project_id = ? AND t.labor_id IS NOT NULL
           AND t.direction = 'OUT' AND t.is_void = 0), 0) AS paid`,
    projectId,
    projectId
  );
  const sale = await getSaleSummary(projectId);
  return {
    laborOutstanding: Math.max(0, (labor?.accrued ?? 0) - (labor?.paid ?? 0)),
    saleOutstanding: Math.max(0, sale.outstanding),
  };
}

/**
 * Manually close a project WITHOUT a settlement (kept the building, sold
 * outside the app, abandoned). No capital moves — the summary freezes as-is.
 * Settlement remains the full path for profit/loss distribution.
 */
export async function markProjectCompleted(id: string): Promise<void> {
  const db = await getDatabase();
  const project = await getProject(id);
  if (!project) throw new Error(`markProjectCompleted: project ${id} not found`);
  if (project.status !== 'ACTIVE') {
    throw new Error(`markProjectCompleted: project is ${project.status}, not ACTIVE`);
  }
  await db.runAsync("UPDATE projects SET status = 'COMPLETED' WHERE id = ?", id);
}

/** Per-project donation % override (null = use the Settings default). */
export async function setProjectDonationPct(id: string, pct: number | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE projects SET donation_pct = ? WHERE id = ?', pct, id);
}

export interface ProjectSummary {
  project: ProjectRow;
  progressPercent: number;
  totalIn: number;
  totalOut: number;
  /** Cost breakdown (plot / construction / sale / total) for the list card. */
  cost: ProjectCost;
  /** Sale agreed price (0 if no sale yet). */
  saleDeal: number;
  /** Money received from the buyer so far. */
  saleReceived: number;
}

/**
 * Lifecycle progress 0100 from the project's REAL phases (not construction
 * steps): plot secured → building → listed for sale → sold. Completed = 100.
 * This replaces the retired milestone checklist as the card progress bar.
 */
function lifecyclePercent(
  project: ProjectRow,
  cost: ProjectCost,
  sale: { agreed: number; received: number; outstanding: number }
): number {
  if (project.status === 'COMPLETED') return 100;
  let pct = 0;
  if (project.plot_id || cost.plotCost > 0) pct = 25; // plot secured
  if (cost.constructionCost > 0) pct = 50; // building underway
  if (sale.agreed > 0) pct = 75; // listed for sale
  if (sale.received > 0 && sale.outstanding <= 0.001) pct = 90; // sold, awaiting settlement
  return pct;
}

/** Project + its live progress, money totals, and cost breakdown (for cards). */
export async function getProjectSummary(id: string): Promise<ProjectSummary | null> {
  const project = await getProject(id);
  if (!project) return null;
  const [totals, cost, sale] = await Promise.all([
    getProjectTotals(id),
    getProjectCost(id),
    getSaleSummary(id),
  ]);
  const agreed = sale.sale?.agreed_price ?? 0;
  return {
    project,
    progressPercent: lifecyclePercent(project, cost, {
      agreed,
      received: sale.receiptsTotal,
      outstanding: sale.outstanding,
    }),
    totalIn: totals.totalIn,
    totalOut: totals.totalOut,
    cost,
    saleDeal: agreed,
    saleReceived: sale.receiptsTotal,
  };
}

/** All projects with summaries, newest first. */
export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const projects = await listProjects();
  const summaries = await Promise.all(projects.map((p) => getProjectSummary(p.id)));
  return summaries.filter((s): s is ProjectSummary => s !== null);
}

export interface ProjectCost {
  plotCost: number;
  constructionCost: number;
  saleCost: number;
  /** plot + construction + sale  what the whole project has cost so far. */
  totalCost: number;
}

/**
 * The project's cost story: plot (seller payments + plot expenses) +
 * construction (cash spend + accrued labor) + sale-side expenses.
 * Computed phase-by-phase so the three cards and the total always agree.
 */
export async function getProjectCost(projectId: string): Promise<ProjectCost> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ plotCost: number; saleCost: number; constructionCash: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN phase = 'PLOT' THEN amount ELSE 0 END), 0) AS plotCost,
       COALESCE(SUM(CASE WHEN phase = 'SALE' THEN amount ELSE 0 END), 0) AS saleCost,
       COALESCE(SUM(CASE WHEN phase = 'CONSTRUCTION' AND labor_id IS NULL THEN amount ELSE 0 END), 0) AS constructionCash
     FROM transactions
     WHERE project_id = ? AND direction = 'OUT' AND is_void = 0`,
    projectId
  );
  const labor = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(la.wage_accrued), 0) AS s
     FROM project_laborers pl
     LEFT JOIN labor_attendance la ON la.project_laborer_id = pl.id
     WHERE pl.project_id = ?`,
    projectId
  );

  const plotCost = row?.plotCost ?? 0;
  const saleCost = row?.saleCost ?? 0;
  const constructionCost = (row?.constructionCash ?? 0) + (labor?.s ?? 0);
  return { plotCost, constructionCost, saleCost, totalCost: plotCost + constructionCost + saleCost };
}
