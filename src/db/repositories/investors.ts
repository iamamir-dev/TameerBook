import { getDatabase } from '../database';
import {
  DEFAULT_USER,
  type InvestorRow,
  type InvestorStatus,
  type ProjectInvestorRow,
  type ProjectInvestorStatus,
} from '../schema';
import { nowISO, uuid } from '../uuid';

export interface NewInvestor {
  name: string;
  cnic?: string | null;
  phone?: string | null;
  photoUri?: string | null;
  bankInfo?: string | null;
  status?: InvestorStatus;
  createdBy?: string;
}

export async function addInvestor(input: NewInvestor): Promise<InvestorRow> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO investors (id, created_at, created_by, name, cnic, phone, photo_uri, bank_info, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.name,
    input.cnic ?? null,
    input.phone ?? null,
    input.photoUri ?? null,
    input.bankInfo ?? null,
    input.status ?? 'ACTIVE'
  );
  return (await db.getFirstAsync<InvestorRow>('SELECT * FROM investors WHERE id = ?', id))!;
}

export async function listInvestors(): Promise<InvestorRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<InvestorRow>('SELECT * FROM investors ORDER BY name');
}

export async function getInvestor(id: string): Promise<InvestorRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<InvestorRow>('SELECT * FROM investors WHERE id = ?', id);
}

export interface NewProjectInvestor {
  projectId: string;
  investorId: string;
  committedAmount: number;
  profitPct?: number | null;
  status?: ProjectInvestorStatus;
  joinedAt?: string | null;
  createdBy?: string;
}

/** Link an investor to a project (their participation record). */
export async function addProjectInvestor(input: NewProjectInvestor): Promise<ProjectInvestorRow> {
  const db = await getDatabase();
  const id = uuid();
  const createdAt = nowISO();
  await db.runAsync(
    `INSERT INTO project_investors
       (id, created_at, created_by, project_id, investor_id, committed_amount, profit_pct, status, joined_at, exited_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    id,
    createdAt,
    input.createdBy ?? DEFAULT_USER,
    input.projectId,
    input.investorId,
    input.committedAmount,
    input.profitPct ?? null,
    input.status ?? 'ACTIVE',
    input.joinedAt ?? createdAt
  );
  return (await db.getFirstAsync<ProjectInvestorRow>(
    'SELECT * FROM project_investors WHERE id = ?',
    id
  ))!;
}

export async function listProjectInvestors(projectId: string): Promise<ProjectInvestorRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<ProjectInvestorRow>(
    'SELECT * FROM project_investors WHERE project_id = ? ORDER BY created_at',
    projectId
  );
}

/** The participation row linking an investor to a project, or null. */
export async function getProjectInvestor(
  projectId: string,
  investorId: string
): Promise<ProjectInvestorRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<ProjectInvestorRow>(
    'SELECT * FROM project_investors WHERE project_id = ? AND investor_id = ? LIMIT 1',
    projectId,
    investorId
  );
}

/** Update a participation's profit share % (the one editable Musharakah field). */
export async function setProjectInvestorProfitPct(id: string, profitPct: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE project_investors SET profit_pct = ? WHERE id = ?', profitPct, id);
}

export interface InvestorParticipation extends ProjectInvestorRow {
  projectName: string;
}

/** An investor's participations (not yet settled), with project names. */
export async function listInvestorParticipations(investorId: string): Promise<InvestorParticipation[]> {
  const db = await getDatabase();
  return db.getAllAsync<InvestorParticipation>(
    `SELECT pi.*, COALESCE(pr.name, '') AS projectName
     FROM project_investors pi
     JOIN projects pr ON pr.id = pi.project_id
     WHERE pi.investor_id = ? AND pi.status != 'SETTLED'
     ORDER BY pi.created_at DESC`,
    investorId
  );
}

export async function setProjectInvestorStatus(
  id: string,
  status: ProjectInvestorStatus,
  exitedAt: string | null = null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE project_investors SET status = ?, exited_at = ? WHERE id = ?',
    status,
    exitedAt,
    id
  );
}
