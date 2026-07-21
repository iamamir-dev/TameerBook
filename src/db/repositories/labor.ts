import { getDatabase } from '../database';
import {
  DEFAULT_USER,
  type AttendanceStatus,
  type LaborAttendanceRow,
  type LaborerRow,
  type ProjectLaborerRow,
} from '../schema';
import { nowISO, todayLocalISO, uuid } from '../uuid';
import { categoryIdByName } from './categories';
import { requireCompanyId } from './companies';
import { assertProjectActive } from './guards';
import { addTransaction, applyTransactionPatch, getTransaction, LimitExceededError } from './transactions';

/**
 * Thrown when a worker already earned a dihari on ANOTHER project that day —
 * one worker, one paid day, no double-earning across projects.
 */
export class AttendanceConflictError extends Error {
  constructor(
    public readonly laborerId: string,
    public readonly date: string,
    /** Name of the project that already holds the day. */
    public readonly conflictingProjectName: string
  ) {
    super('ATTENDANCE_CONFLICT');
    this.name = 'AttendanceConflictError';
  }
}

/** True when an error from a save action is the one-project-per-day guard. */
export function isAttendanceConflict(e: unknown): e is AttendanceConflictError {
  return e instanceof Error && e.message === 'ATTENDANCE_CONFLICT';
}

/** Thrown when a paid day (FULL/HALF) is marked before a dihari rate is set. */
export class WageNotSetError extends Error {
  constructor() {
    super('WAGE_NOT_SET');
    this.name = 'WageNotSetError';
  }
}
export function isWageNotSet(e: unknown): e is WageNotSetError {
  return e instanceof Error && e.message === 'WAGE_NOT_SET';
}

/** Thrown when attendance is marked for a worker no longer on the project. */
export class WorkerInactiveError extends Error {
  constructor() {
    super('WORKER_INACTIVE');
    this.name = 'WorkerInactiveError';
  }
}
export function isWorkerInactive(e: unknown): e is WorkerInactiveError {
  return e instanceof Error && e.message === 'WORKER_INACTIVE';
}

/* -------------------------------------------------------------------------- */
/*  Laborers (reusable workers)                                               */
/* -------------------------------------------------------------------------- */

export interface NewLaborer {
  name: string;
  phone?: string | null;
  cnic?: string | null;
  photoUri?: string | null;
  createdBy?: string;
}

export async function addLaborer(input: NewLaborer): Promise<LaborerRow> {
  const name = input.name.trim();
  if (!name) throw new Error('addLaborer: name is required');
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO laborers (id, created_at, created_by, company_id, name, phone, cnic, photo_uri, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    requireCompanyId(),
    name,
    input.phone ?? null,
    input.cnic ?? null,
    input.photoUri ?? null
  );
  return (await getLaborer(id))!;
}

export async function getLaborer(id: string): Promise<LaborerRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<LaborerRow>('SELECT * FROM laborers WHERE id = ?', id);
}

export async function listLaborers(): Promise<LaborerRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<LaborerRow>(
    "SELECT * FROM laborers WHERE status = 'ACTIVE' AND company_id = ? ORDER BY name ASC",
    requireCompanyId()
  );
}

/* -------------------------------------------------------------------------- */
/*  Project attachment (per-project daily wage)                               */
/* -------------------------------------------------------------------------- */

export interface AttachLaborerInput {
  projectId: string;
  laborerId: string;
  /** The dihari (daily wage) agreed for THIS project. */
  dailyWage: number;
  createdBy?: string;
}

/** Attach a worker to a project with the agreed dihari. */
export async function attachLaborerToProject(input: AttachLaborerInput): Promise<ProjectLaborerRow> {
  const db = await getDatabase();
  await assertProjectActive(input.projectId);
  const existing = await db.getFirstAsync<ProjectLaborerRow>(
    "SELECT * FROM project_laborers WHERE project_id = ? AND laborer_id = ? AND status = 'ACTIVE'",
    input.projectId,
    input.laborerId
  );
  if (existing) return existing;

  // A previously-removed worker returns on their old row (with the new wage)
  // so one worker never holds two participation rows on the same project.
  const inactive = await db.getFirstAsync<ProjectLaborerRow>(
    "SELECT * FROM project_laborers WHERE project_id = ? AND laborer_id = ? AND status = 'INACTIVE' ORDER BY created_at DESC LIMIT 1",
    input.projectId,
    input.laborerId
  );
  if (inactive) {
    await db.runAsync(
      "UPDATE project_laborers SET status = 'ACTIVE', daily_wage = ?, joined_at = ? WHERE id = ?",
      input.dailyWage,
      nowISO().slice(0, 10),
      inactive.id
    );
    return (await getProjectLaborer(inactive.id))!;
  }

  const id = uuid();
  await db.runAsync(
    `INSERT INTO project_laborers (id, created_at, created_by, project_id, laborer_id, daily_wage, status, joined_at)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.projectId,
    input.laborerId,
    input.dailyWage,
    nowISO().slice(0, 10)
  );
  return (await db.getFirstAsync<ProjectLaborerRow>(
    'SELECT * FROM project_laborers WHERE id = ?',
    id
  ))!;
}

export async function getProjectLaborer(id: string): Promise<ProjectLaborerRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<ProjectLaborerRow>('SELECT * FROM project_laborers WHERE id = ?', id);
}

/** Change the agreed dihari going forward (past accruals keep their snapshot). */
export async function setLaborerWage(projectLaborerId: string, dailyWage: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE project_laborers SET daily_wage = ? WHERE id = ?',
    dailyWage,
    projectLaborerId
  );
}

export async function removeLaborerFromProject(projectLaborerId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE project_laborers SET status = 'INACTIVE' WHERE id = ?",
    projectLaborerId
  );
}

/* -------------------------------------------------------------------------- */
/*  Attendance (accrual  NOT a cash movement)                                */
/* -------------------------------------------------------------------------- */

export interface MarkAttendanceInput {
  projectLaborerId: string;
  date: string;
  status: AttendanceStatus;
  note?: string | null;
  createdBy?: string;
}

/**
 * Wage owed for a day at the given wage/status: full, half, or nothing. HALF is
 * rounded to whole rupees so an odd wage can't leave an unclearable `.5` residue
 * (amounts are entered as integers everywhere).
 */
export function wageForStatus(dailyWage: number, status: AttendanceStatus): number {
  if (status === 'FULL') return dailyWage;
  if (status === 'HALF') return Math.round(dailyWage / 2);
  return 0;
}

/**
 * Mark (or re-mark) a worker's attendance for a day. One row per worker per
 * day  re-marking the same date replaces the previous status. `wage_accrued`
 * snapshots the wage owed for that day so later wage changes don't rewrite
 * history.
 */
export async function markAttendance(input: MarkAttendanceInput): Promise<LaborAttendanceRow> {
  const db = await getDatabase();
  const pl = await getProjectLaborer(input.projectLaborerId);
  if (!pl) throw new Error(`markAttendance: project laborer ${input.projectLaborerId} not found`);
  await assertProjectActive(pl.project_id);

  // A worker removed from the project can't have new attendance logged (V-17).
  if (pl.status !== 'ACTIVE') throw new WorkerInactiveError();
  // A paid day needs a dihari rate first; ABSENT earns nothing so it's fine (V-15).
  if (input.status !== 'ABSENT' && pl.daily_wage <= 0) throw new WageNotSetError();

  // One dihari per day: an earning mark (FULL/HALF) is blocked when the same
  // worker already earned on a DIFFERENT project that date. ABSENT is always
  // allowed — recording an absence earns nothing.
  if (input.status !== 'ABSENT') {
    const conflict = await db.getFirstAsync<{ projectName: string }>(
      `SELECT COALESCE(pr.name, '') AS projectName
       FROM labor_attendance la
       JOIN project_laborers opl ON opl.id = la.project_laborer_id
       JOIN projects pr ON pr.id = opl.project_id
       WHERE opl.laborer_id = ? AND la.date = ? AND la.status != 'ABSENT'
         AND la.project_laborer_id != ?
       LIMIT 1`,
      pl.laborer_id,
      input.date,
      input.projectLaborerId
    );
    if (conflict) {
      throw new AttendanceConflictError(pl.laborer_id, input.date, conflict.projectName);
    }
  }

  const accrued = wageForStatus(pl.daily_wage, input.status);
  const existing = await db.getFirstAsync<LaborAttendanceRow>(
    'SELECT * FROM labor_attendance WHERE project_laborer_id = ? AND date = ?',
    input.projectLaborerId,
    input.date
  );

  if (existing) {
    await db.runAsync(
      'UPDATE labor_attendance SET status = ?, wage_accrued = ?, note = ? WHERE id = ?',
      input.status,
      accrued,
      input.note ?? existing.note,
      existing.id
    );
    return (await db.getFirstAsync<LaborAttendanceRow>(
      'SELECT * FROM labor_attendance WHERE id = ?',
      existing.id
    ))!;
  }

  const id = uuid();
  await db.runAsync(
    `INSERT INTO labor_attendance (id, created_at, created_by, project_laborer_id, date, status, wage_accrued, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.projectLaborerId,
    input.date,
    input.status,
    accrued,
    input.note ?? null
  );
  return (await db.getFirstAsync<LaborAttendanceRow>(
    'SELECT * FROM labor_attendance WHERE id = ?',
    id
  ))!;
}

/** Attendance history for a worker on a project, newest first. */
export async function listAttendance(
  projectLaborerId: string,
  monthPrefix?: string
): Promise<LaborAttendanceRow[]> {
  const db = await getDatabase();
  if (monthPrefix) {
    return db.getAllAsync<LaborAttendanceRow>(
      `SELECT * FROM labor_attendance
       WHERE project_laborer_id = ? AND date LIKE ? ORDER BY date DESC`,
      projectLaborerId,
      `${monthPrefix}%`
    );
  }
  return db.getAllAsync<LaborAttendanceRow>(
    'SELECT * FROM labor_attendance WHERE project_laborer_id = ? ORDER BY date DESC',
    projectLaborerId
  );
}

/* -------------------------------------------------------------------------- */
/*  Payments & balances                                                       */
/* -------------------------------------------------------------------------- */

export interface PayLaborerInput {
  projectLaborerId: string;
  amount: number;
  date: string;
  accountId: string;
  note?: string | null;
  createdBy?: string;
}

/**
 * Pay a worker some of what they're owed: an OUT transaction on the chosen
 * account (category "Labor Payment", linked to the worker + project). Reduces
 * the worker's wage balance. NOT added to construction cost again  the
 * accrued attendance already carries the cost.
 */
export async function payLaborer(input: PayLaborerInput): Promise<void> {
  const pl = await getProjectLaborer(input.projectLaborerId);
  if (!pl) throw new Error(`payLaborer: project laborer ${input.projectLaborerId} not found`);
  if (input.amount <= 0) throw new Error('payLaborer: amount must be positive');

  // VALIDATION: a worker can only be paid what they're owed on this project.
  const { balance } = await getLaborBalance(input.projectLaborerId);
  if (input.amount > balance + 0.001) {
    throw new LimitExceededError(balance, input.amount);
  }

  const laborer = await getLaborer(pl.laborer_id);
  const categoryId = await categoryIdByName('Labor Payment', 'EXPENSE', 'مزدور کی ادائیگی', true);

  await addTransaction({
    direction: 'OUT',
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    projectId: pl.project_id,
    phase: 'CONSTRUCTION',
    categoryId,
    laborId: pl.id,
    counterpartyName: laborer?.name ?? null,
    description: input.note ?? `Labor payment: ${laborer?.name ?? ''}`.trim(),
    createdBy: input.createdBy,
  });
}

export interface LaborPaymentPatch {
  amount?: number;
  date?: string;
  accountId?: string;
  note?: string | null;
}

/**
 * Edit a wage payment IN PLACE. The linked `labor_id` puts it off-limits to the
 * generic `updateTransaction`, so this re-checks the worker-owed cap (freeing
 * this row's own amount back) and applies the shared patch (account overdraw
 * guard). Kept on the SAME participation — reassigning projects isn't allowed.
 */
export async function updateLaborPayment(id: string, patch: LaborPaymentPatch): Promise<void> {
  const t = await getTransaction(id);
  if (!t || t.is_void === 1) throw new Error(`updateLaborPayment: ${id} not found`);
  if (!t.labor_id) throw new Error('updateLaborPayment: not a labor payment');

  const { balance } = await getLaborBalance(t.labor_id);
  const amount = patch.amount ?? t.amount;
  const maxAllowed = balance + t.amount; // owed excluding this row
  if (amount > maxAllowed + 0.001) throw new LimitExceededError(maxAllowed, amount);

  await applyTransactionPatch(t, {
    amount,
    date: patch.date,
    accountId: patch.accountId,
    description: patch.note,
  });
}

export interface LaborBalance {
  /** Σ wage_accrued over all attendance. */
  accrued: number;
  /** Σ Labor Payment transactions to this worker on this project. */
  paid: number;
  /** accrued − paid: what the worker is still owed. */
  balance: number;
  daysFull: number;
  daysHalf: number;
  daysAbsent: number;
}

/** What a worker has earned / been paid / is owed on a project. */
export async function getLaborBalance(projectLaborerId: string): Promise<LaborBalance> {
  const db = await getDatabase();

  const acc = await db.getFirstAsync<{
    accrued: number;
    daysFull: number;
    daysHalf: number;
    daysAbsent: number;
  }>(
    `SELECT COALESCE(SUM(wage_accrued), 0) AS accrued,
       COALESCE(SUM(CASE WHEN status = 'FULL' THEN 1 ELSE 0 END), 0) AS daysFull,
       COALESCE(SUM(CASE WHEN status = 'HALF' THEN 1 ELSE 0 END), 0) AS daysHalf,
       COALESCE(SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END), 0) AS daysAbsent
     FROM labor_attendance WHERE project_laborer_id = ?`,
    projectLaborerId
  );

  const paid = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS s
     FROM transactions
     WHERE labor_id = ? AND direction = 'OUT' AND is_void = 0`,
    projectLaborerId
  );

  const accrued = acc?.accrued ?? 0;
  const paidTotal = paid?.s ?? 0;
  return {
    accrued,
    paid: paidTotal,
    balance: accrued - paidTotal,
    daysFull: acc?.daysFull ?? 0,
    daysHalf: acc?.daysHalf ?? 0,
    daysAbsent: acc?.daysAbsent ?? 0,
  };
}

export interface ProjectLaborerSummary {
  projectLaborer: ProjectLaborerRow;
  laborer: LaborerRow;
  balance: LaborBalance;
  /** Today's attendance mark on THIS project (null = not marked yet). */
  todayStatus: AttendanceStatus | null;
}

/** Every active worker on a project with wage + balance (the labor section). */
export async function listProjectLaborers(projectId: string): Promise<ProjectLaborerSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ProjectLaborerRow>(
    "SELECT * FROM project_laborers WHERE project_id = ? AND status = 'ACTIVE' ORDER BY created_at ASC",
    projectId
  );
  const today = todayLocalISO();
  const out: ProjectLaborerSummary[] = [];
  for (const pl of rows) {
    const laborer = await getLaborer(pl.laborer_id);
    if (!laborer) continue;
    const todayRow = await db.getFirstAsync<{ status: AttendanceStatus }>(
      'SELECT status FROM labor_attendance WHERE project_laborer_id = ? AND date = ?',
      pl.id,
      today
    );
    out.push({
      projectLaborer: pl,
      laborer,
      balance: await getLaborBalance(pl.id),
      todayStatus: todayRow?.status ?? null,
    });
  }
  return out;
}

/**
 * Bulk-mark every ACTIVE worker on a project as FULL for a date (default the
 * caller's local today). Workers with no dihari set, already earning on another
 * project that day (the one-dihari guard), or inactive are skipped — the rest
 * are marked. Returns how many were actually marked. Idempotent: re-running
 * re-affirms FULL for the day.
 */
export async function markAllPresentForProject(projectId: string, date: string): Promise<number> {
  const workers = await listProjectLaborers(projectId);
  let marked = 0;
  for (const w of workers) {
    if (w.projectLaborer.daily_wage <= 0) continue;
    try {
      await markAttendance({ projectLaborerId: w.projectLaborer.id, date, status: 'FULL' });
      marked++;
    } catch (e) {
      // Expected skips: cross-project conflict / inactive / no wage. Re-throw
      // anything genuinely unexpected.
      if (!isAttendanceConflict(e) && !isWorkerInactive(e) && !isWageNotSet(e)) throw e;
    }
  }
  return marked;
}

export interface ProjectLaborTotals {
  /** Total wages accrued (this IS the labor construction cost). */
  accrued: number;
  paid: number;
  outstanding: number;
  workers: number;
}

/* -------------------------------------------------------------------------- */
/*  Worker khata  the worker-centric view across ALL projects                 */
/* -------------------------------------------------------------------------- */

export interface LaborerTotals extends LaborerRow {
  /** Σ wage_accrued across every project participation. */
  earned: number;
  /** Σ labor payments across every project participation. */
  taken: number;
  /** earned − taken: what the worker is owed overall. */
  balance: number;
  /** Number of projects they are (or were) attached to. */
  projects: number;
}

/** Every active worker with their cross-project earned/taken/balance (Labor home). */
export async function listLaborersWithTotals(): Promise<LaborerTotals[]> {
  const db = await getDatabase();
  return db.getAllAsync<LaborerTotals>(
    `SELECT l.*,
       COALESCE((SELECT SUM(la.wage_accrued) FROM labor_attendance la
         JOIN project_laborers pl ON pl.id = la.project_laborer_id
         WHERE pl.laborer_id = l.id), 0) AS earned,
       COALESCE((SELECT SUM(t.amount) FROM transactions t
         JOIN project_laborers pl ON pl.id = t.labor_id
         WHERE pl.laborer_id = l.id AND t.direction = 'OUT' AND t.is_void = 0), 0) AS taken,
       COALESCE((SELECT SUM(la.wage_accrued) FROM labor_attendance la
         JOIN project_laborers pl ON pl.id = la.project_laborer_id
         WHERE pl.laborer_id = l.id), 0)
       - COALESCE((SELECT SUM(t.amount) FROM transactions t
         JOIN project_laborers pl ON pl.id = t.labor_id
         WHERE pl.laborer_id = l.id AND t.direction = 'OUT' AND t.is_void = 0), 0) AS balance,
       (SELECT COUNT(*) FROM project_laborers pl WHERE pl.laborer_id = l.id) AS projects
     FROM laborers l
     WHERE l.status = 'ACTIVE' AND l.company_id = ?
     ORDER BY l.name ASC`,
    requireCompanyId()
  );
}

export interface LaborerProjectParticipation {
  projectLaborer: ProjectLaborerRow;
  projectName: string;
  projectStatus: string;
  balance: LaborBalance;
  /** Today's attendance on this project (null = not marked yet). */
  todayStatus: AttendanceStatus | null;
}

/** One history line in a worker's khata: an attendance accrual or a payment. */
export interface LaborerKhataEntry {
  date: string;
  projectName: string;
  kind: 'ATTENDANCE' | 'PAYMENT';
  /** FULL/HALF/ABSENT for attendance rows. */
  attendanceStatus: AttendanceStatus | null;
  /** Positive accrual for attendance, positive payment amount for payments. */
  amount: number;
  /** Which participation this row belongs to (for editing either kind). */
  projectLaborerId: string;
  /** The backing OUT transaction id — payments only (for edit in place). */
  txnId: string | null;
  /** The attendance row id — attendance only (for re-mark editing). */
  attendanceId: string | null;
  /** Payment description / attendance note. */
  note: string | null;
}

export interface LaborerKhata {
  laborer: LaborerRow;
  totals: { earned: number; taken: number; balance: number };
  /** Their participations (active first), each with its own per-project balance. */
  participations: LaborerProjectParticipation[];
  /** Unified attendance + payment history across projects, newest first. */
  history: LaborerKhataEntry[];
}

/** The worker's full khata across all projects (the Labor detail screen). */
export async function getLaborerKhata(laborerId: string): Promise<LaborerKhata> {
  const db = await getDatabase();
  const laborer = await getLaborer(laborerId);
  if (!laborer) throw new Error(`getLaborerKhata: laborer ${laborerId} not found`);

  const pls = await db.getAllAsync<ProjectLaborerRow & { projectName: string; projectStatus: string }>(
    `SELECT pl.*, COALESCE(pr.name, '') AS projectName, pr.status AS projectStatus
     FROM project_laborers pl
     JOIN projects pr ON pr.id = pl.project_id
     WHERE pl.laborer_id = ?
     ORDER BY pl.status ASC, pl.created_at DESC`,
    laborerId
  );

  const today = todayLocalISO();
  const participations: LaborerProjectParticipation[] = [];
  for (const pl of pls) {
    const { projectName, projectStatus, ...row } = pl;
    const todayRow = await db.getFirstAsync<{ status: AttendanceStatus }>(
      'SELECT status FROM labor_attendance WHERE project_laborer_id = ? AND date = ?',
      pl.id,
      today
    );
    participations.push({
      projectLaborer: row,
      projectName,
      projectStatus,
      balance: await getLaborBalance(pl.id),
      todayStatus: todayRow?.status ?? null,
    });
  }

  const history = await db.getAllAsync<LaborerKhataEntry>(
    `SELECT la.date, COALESCE(pr.name, '') AS projectName, 'ATTENDANCE' AS kind,
            la.status AS attendanceStatus, la.wage_accrued AS amount,
            pl.id AS projectLaborerId, NULL AS txnId, la.id AS attendanceId, la.note AS note
     FROM labor_attendance la
     JOIN project_laborers pl ON pl.id = la.project_laborer_id
     JOIN projects pr ON pr.id = pl.project_id
     WHERE pl.laborer_id = ?
     UNION ALL
     SELECT t.date, COALESCE(pr.name, '') AS projectName, 'PAYMENT' AS kind,
            NULL AS attendanceStatus, t.amount AS amount,
            pl.id AS projectLaborerId, t.id AS txnId, NULL AS attendanceId, t.description AS note
     FROM transactions t
     JOIN project_laborers pl ON pl.id = t.labor_id
     JOIN projects pr ON pr.id = pl.project_id
     WHERE pl.laborer_id = ? AND t.direction = 'OUT' AND t.is_void = 0
     ORDER BY date DESC`,
    laborerId,
    laborerId
  );

  const earned = participations.reduce((s, p) => s + p.balance.accrued, 0);
  const taken = participations.reduce((s, p) => s + p.balance.paid, 0);
  return {
    laborer,
    totals: { earned, taken, balance: earned - taken },
    participations,
    history,
  };
}

/** Project-wide labor totals for the construction summary. */
export async function getProjectLaborTotals(projectId: string): Promise<ProjectLaborTotals> {
  const db = await getDatabase();
  const acc = await db.getFirstAsync<{ s: number; w: number }>(
    `SELECT COALESCE(SUM(la.wage_accrued), 0) AS s, COUNT(DISTINCT pl.id) AS w
     FROM project_laborers pl
     LEFT JOIN labor_attendance la ON la.project_laborer_id = pl.id
     WHERE pl.project_id = ?`,
    projectId
  );
  const paid = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS s
     FROM transactions
     WHERE project_id = ? AND direction = 'OUT' AND is_void = 0 AND labor_id IS NOT NULL`,
    projectId
  );
  const accrued = acc?.s ?? 0;
  const paidTotal = paid?.s ?? 0;
  return {
    accrued,
    paid: paidTotal,
    outstanding: accrued - paidTotal,
    workers: acc?.w ?? 0,
  };
}
