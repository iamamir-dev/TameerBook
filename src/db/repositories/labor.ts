import { getDatabase } from '../database';
import {
  DEFAULT_USER,
  type AttendanceStatus,
  type LaborAttendanceRow,
  type LaborerRow,
  type ProjectLaborerRow,
} from '../schema';
import { nowISO, uuid } from '../uuid';
import { categoryIdByName } from './categories';
import { requireCompanyId } from './companies';
import { addTransaction } from './transactions';

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
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO laborers (id, created_at, created_by, company_id, name, phone, cnic, photo_uri, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    requireCompanyId(),
    input.name,
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
  const existing = await db.getFirstAsync<ProjectLaborerRow>(
    "SELECT * FROM project_laborers WHERE project_id = ? AND laborer_id = ? AND status = 'ACTIVE'",
    input.projectId,
    input.laborerId
  );
  if (existing) return existing;

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

/** Wage owed for a day at the given wage/status: full, half, or nothing. */
export function wageForStatus(dailyWage: number, status: AttendanceStatus): number {
  if (status === 'FULL') return dailyWage;
  if (status === 'HALF') return dailyWage / 2;
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
  const laborer = await getLaborer(pl.laborer_id);
  const categoryId = await categoryIdByName('Labor Payment', 'EXPENSE', 'مزدور کی ادائیگی');

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
}

/** Every active worker on a project with wage + balance (the labor section). */
export async function listProjectLaborers(projectId: string): Promise<ProjectLaborerSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ProjectLaborerRow>(
    "SELECT * FROM project_laborers WHERE project_id = ? AND status = 'ACTIVE' ORDER BY created_at ASC",
    projectId
  );
  const out: ProjectLaborerSummary[] = [];
  for (const pl of rows) {
    const laborer = await getLaborer(pl.laborer_id);
    if (!laborer) continue;
    out.push({ projectLaborer: pl, laborer, balance: await getLaborBalance(pl.id) });
  }
  return out;
}

export interface ProjectLaborTotals {
  /** Total wages accrued (this IS the labor construction cost). */
  accrued: number;
  paid: number;
  outstanding: number;
  workers: number;
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
