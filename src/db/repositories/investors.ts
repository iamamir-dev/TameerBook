import { getDatabase } from '../database';
import {
  DEFAULT_USER,
  type InvestorRow,
  type InvestorStatus,
  type ProjectInvestorRow,
  type ProjectInvestorStatus,
} from '../schema';
import { nowISO, uuid } from '../uuid';
import { categoryIdByName } from './categories';
import { requireCompanyId } from './companies';
import { addDocument } from './documents';
import { addTransaction, LimitExceededError } from './transactions';

export interface NewInvestor {
  name: string;
  cnic?: string | null;
  phone?: string | null;
  photoUri?: string | null;
  bankInfo?: string | null;
  /** Total pledged (their stake basis). */
  committedAmount?: number;
  /** How much of the pledge they've handed over so far. */
  givenAmount?: number;
  status?: InvestorStatus;
  createdBy?: string;
}

export async function addInvestor(input: NewInvestor): Promise<InvestorRow> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO investors (id, created_at, created_by, company_id, name, cnic, phone, photo_uri, bank_info, status, committed_amount, given_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    requireCompanyId(),
    input.name,
    input.cnic ?? null,
    input.phone ?? null,
    input.photoUri ?? null,
    input.bankInfo ?? null,
    input.status ?? 'ACTIVE',
    Math.max(0, input.committedAmount ?? 0),
    Math.max(0, input.givenAmount ?? 0)
  );
  return (await db.getFirstAsync<InvestorRow>('SELECT * FROM investors WHERE id = ?', id))!;
}

export async function listInvestors(): Promise<InvestorRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<InvestorRow>(
    'SELECT * FROM investors WHERE company_id = ? ORDER BY name',
    requireCompanyId()
  );
}

export async function getInvestor(id: string): Promise<InvestorRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<InvestorRow>('SELECT * FROM investors WHERE id = ?', id);
}

/**
 * Total actually RECEIVED from an investor so far (Σ their payment
 * transactions) — the "paid" against their committed pledge, exactly like a
 * plot's paid-to-seller against the deal price.
 */
export async function getInvestorReceived(investorId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS s
     FROM transactions WHERE investor_id = ? AND direction = 'IN' AND is_void = 0`,
    investorId
  );
  return row?.s ?? 0;
}

export interface InvestorSummary {
  investor: InvestorRow;
  /** The pledge (their "deal"). */
  committed: number;
  /** Received so far (Σ payments). */
  received: number;
  /** committed − received (still owed). */
  remaining: number;
}

/** Committed / received / remaining for one investor (like a plot summary). */
export async function getInvestorSummary(investorId: string): Promise<InvestorSummary> {
  const investor = await getInvestor(investorId);
  if (!investor) throw new Error(`getInvestorSummary: investor ${investorId} not found`);
  const received = await getInvestorReceived(investorId);
  return {
    investor,
    committed: investor.committed_amount,
    received,
    remaining: Math.max(0, investor.committed_amount - received),
  };
}

export interface InvestorPaymentInput {
  investorId: string;
  amount: number;
  date: string;
  accountId: string;
  receiptUri?: string | null;
  createdBy?: string;
}

/**
 * Record money RECEIVED from an investor: an IN transaction on the chosen
 * account, tagged with `investor_id` (like a plot payment). Can't exceed the
 * remaining pledge — throws `LimitExceededError`.
 */
export async function addInvestorPayment(input: InvestorPaymentInput): Promise<void> {
  const investor = await getInvestor(input.investorId);
  if (!investor) throw new Error(`addInvestorPayment: investor ${input.investorId} not found`);
  if (input.amount <= 0) throw new Error('addInvestorPayment: amount must be positive');

  const received = await getInvestorReceived(input.investorId);
  const remaining = investor.committed_amount - received;
  // Only guard when a pledge is set; allow ad-hoc top-ups when committed is 0.
  if (investor.committed_amount > 0 && input.amount > remaining + 0.001) {
    throw new LimitExceededError(remaining, input.amount);
  }

  const categoryId = await categoryIdByName('Investor Investment', 'INCOME', 'سرمایہ کاری');
  const txn = await addTransaction({
    direction: 'IN',
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    investorId: input.investorId,
    phase: 'GENERAL',
    categoryId,
    counterpartyName: investor.name,
    createdBy: input.createdBy,
  });
  if (input.receiptUri) {
    await addDocument({ entityType: 'transaction', entityId: txn.id, label: 'photoReceipt', fileUri: input.receiptUri });
  }
}

export interface UpdateInvestor {
  name?: string;
  phone?: string | null;
  cnic?: string | null;
  photoUri?: string | null;
  committedAmount?: number;
  givenAmount?: number;
}

/** Edit an investor's identity + pledge details. */
export async function updateInvestor(id: string, patch: UpdateInvestor): Promise<void> {
  const db = await getDatabase();
  const inv = await getInvestor(id);
  if (!inv) throw new Error(`updateInvestor: investor ${id} not found`);
  await db.runAsync(
    'UPDATE investors SET name = ?, phone = ?, cnic = ?, photo_uri = ?, committed_amount = ?, given_amount = ? WHERE id = ?',
    patch.name?.trim() || inv.name,
    patch.phone !== undefined ? patch.phone : inv.phone,
    patch.cnic !== undefined ? patch.cnic : inv.cnic,
    patch.photoUri !== undefined ? patch.photoUri : inv.photo_uri,
    patch.committedAmount !== undefined ? Math.max(0, patch.committedAmount) : inv.committed_amount,
    patch.givenAmount !== undefined ? Math.max(0, patch.givenAmount) : inv.given_amount,
    id
  );
}

/** Thrown when deleting an investor who is still attached to a project. */
export class InvestorInUseError extends Error {
  constructor(public readonly projectCount: number) {
    super('INVESTOR_IN_USE');
    this.name = 'InvestorInUseError';
  }
}

/** True when a delete failed because the investor is used in projects. */
export function isInvestorInUse(e: unknown): e is InvestorInUseError {
  return e instanceof Error && e.message === 'INVESTOR_IN_USE';
}

/**
 * Delete an investor — BLOCKED if they're linked to any project (their capital
 * ledger must stay intact for that project's history). Detach/settle them from
 * every project first.
 */
export async function deleteInvestor(id: string): Promise<void> {
  const db = await getDatabase();
  const used = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM project_investors WHERE investor_id = ?',
    id
  );
  if ((used?.c ?? 0) > 0) throw new InvestorInUseError(used?.c ?? 0);
  await db.runAsync('DELETE FROM investors WHERE id = ?', id);
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
