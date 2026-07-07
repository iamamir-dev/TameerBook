import { getDatabase } from '../database';
import { DEFAULT_USER, type CompanyRow } from '../schema';
import { nowISO, uuid } from '../uuid';
import { loadSettings, saveSetting } from './settings';

/**
 * Companies / workspaces. Every ROOT entity is stamped with the ACTIVE
 * company's id and every list query filters by it, so switching companies
 * switches the entire dataset.
 *
 * The active id lives in a module variable (synchronously readable from every
 * repository) and is mirrored to `app_settings` so it survives relaunches.
 * `hydrateActiveCompany()` runs once at startup.
 */

let ACTIVE_COMPANY_ID: string | null = null;

/** The active company id, or null when none exists yet (pre-onboarding). */
export function getActiveCompanyId(): string | null {
  return ACTIVE_COMPANY_ID;
}

/** The active company id  throws when called before onboarding completes. */
export function requireCompanyId(): string {
  if (!ACTIVE_COMPANY_ID) throw new Error('NO_ACTIVE_COMPANY');
  return ACTIVE_COMPANY_ID;
}

/** Switch the whole app to another company (persists across relaunches). */
export async function setActiveCompany(companyId: string): Promise<void> {
  ACTIVE_COMPANY_ID = companyId;
  await saveSetting('activeCompanyId', companyId);
}

/**
 * Resolve the active company at startup: the persisted choice if it still
 * exists, otherwise the first company (covers the v8 backfill's default),
 * otherwise null  which routes the app into onboarding.
 */
export async function hydrateActiveCompany(): Promise<string | null> {
  const companies = await listCompanies();
  if (companies.length === 0) {
    ACTIVE_COMPANY_ID = null;
    return null;
  }
  let persisted: string | undefined;
  try {
    persisted = (await loadSettings()).activeCompanyId;
  } catch {
    /* first launch */
  }
  const chosen = companies.find((c) => c.id === persisted) ?? companies[0];
  ACTIVE_COMPANY_ID = chosen.id;
  if (chosen.id !== persisted) await saveSetting('activeCompanyId', chosen.id);
  return chosen.id;
}

export interface NewCompany {
  name: string;
  ownerName?: string | null;
  phone?: string | null;
  /** Opening cash the company starts with (seeds the default Cash account). */
  openingCash?: number;
  createdBy?: string;
}

/**
 * Create a company, seed its default "Cash in Hand" account (with the opening
 * cash captured during setup), and make it the active company.
 */
export async function createCompany(input: NewCompany): Promise<CompanyRow> {
  const name = input.name.trim();
  if (!name) throw new Error('createCompany: name is required');

  const db = await getDatabase();
  const id = uuid();
  const createdAt = nowISO();
  const by = input.createdBy ?? DEFAULT_USER;

  await db.runAsync(
    `INSERT INTO companies (id, created_at, created_by, name, owner_name, phone)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    createdAt,
    by,
    name,
    input.ownerName?.trim() || null,
    input.phone?.trim() || null
  );

  // Every company starts with a Cash-in-Hand account so entries always have
  // somewhere to post. (Inserted directly  addAccount stamps the ACTIVE
  // company, which may still be a different one at this point.)
  await db.runAsync(
    `INSERT INTO accounts (id, created_at, created_by, company_id, name, type, opening_balance, sort_order, is_archived)
     VALUES (?, ?, ?, ?, 'Cash in Hand', 'CASH', ?, 0, 0)`,
    uuid(),
    createdAt,
    by,
    id,
    Math.max(0, input.openingCash ?? 0)
  );

  await setActiveCompany(id);
  return (await getCompany(id))!;
}

export async function getCompany(id: string): Promise<CompanyRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<CompanyRow>('SELECT * FROM companies WHERE id = ?', id);
}

export async function listCompanies(): Promise<CompanyRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CompanyRow>('SELECT * FROM companies ORDER BY created_at ASC');
}

export async function updateCompany(
  id: string,
  patch: { name?: string; ownerName?: string | null; phone?: string | null }
): Promise<void> {
  const db = await getDatabase();
  const c = await getCompany(id);
  if (!c) throw new Error(`updateCompany: company ${id} not found`);
  await db.runAsync(
    'UPDATE companies SET name = ?, owner_name = ?, phone = ? WHERE id = ?',
    patch.name?.trim() || c.name,
    patch.ownerName !== undefined ? patch.ownerName : c.owner_name,
    patch.phone !== undefined ? patch.phone : c.phone,
    id
  );
}

export interface CompanyAssets {
  /** Σ live balances across the company's accounts. */
  cash: number;
  /** Money invested into unsold plots (seller payments + plot expenses). */
  plotsValue: number;
  /** Construction cost sunk into ACTIVE projects (cash spend + accrued labor). */
  constructionValue: number;
  /** Open udhaar we gave out (they owe us). */
  receivable: number;
  /** cash + plotsValue + constructionValue + receivable. */
  total: number;
}

/**
 * What the company OWNS right now: liquid cash, money sunk into unsold plots
 * and ongoing construction (recoverable through sale), and money out on loan.
 */
export async function getCompanyAssets(companyId?: string): Promise<CompanyAssets> {
  const db = await getDatabase();
  const cid = companyId ?? requireCompanyId();

  const cashRow = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(a.opening_balance), 0) + COALESCE((
       SELECT SUM(CASE WHEN t.direction = 'IN' THEN t.amount ELSE -t.amount END)
       FROM transactions t
       JOIN accounts a2 ON a2.id = t.account_id
       WHERE a2.company_id = ? AND a2.is_archived = 0 AND t.is_void = 0), 0) AS s
     FROM accounts a WHERE a.company_id = ? AND a.is_archived = 0`,
    cid,
    cid
  );

  const plotsRow = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(t.amount), 0) AS s
     FROM transactions t
     JOIN plots p ON p.id = t.plot_id
     WHERE p.company_id = ? AND p.status != 'SOLD'
       AND t.direction = 'OUT' AND t.is_void = 0 AND t.phase = 'PLOT'`,
    cid
  );

  const constructionRow = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE((
       SELECT SUM(t.amount) FROM transactions t
       JOIN projects pr ON pr.id = t.project_id
       WHERE pr.company_id = ? AND pr.status = 'ACTIVE'
         AND t.phase = 'CONSTRUCTION' AND t.direction = 'OUT'
         AND t.is_void = 0 AND t.labor_id IS NULL), 0)
     + COALESCE((
       SELECT SUM(la.wage_accrued) FROM labor_attendance la
       JOIN project_laborers pl ON pl.id = la.project_laborer_id
       JOIN projects pr ON pr.id = pl.project_id
       WHERE pr.company_id = ? AND pr.status = 'ACTIVE'), 0) AS s`,
    cid,
    cid
  );

  const recvRow = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(
       CASE WHEN t.direction = 'OUT' THEN t.amount ELSE -t.amount END), 0) AS s
     FROM transactions t
     JOIN udhaar u ON u.id = t.udhaar_id
     WHERE u.company_id = ? AND u.direction = 'GIVEN' AND t.is_void = 0`,
    cid
  );

  const cash = cashRow?.s ?? 0;
  const plotsValue = plotsRow?.s ?? 0;
  const constructionValue = constructionRow?.s ?? 0;
  const receivable = Math.max(0, recvRow?.s ?? 0);
  return {
    cash,
    plotsValue,
    constructionValue,
    receivable,
    total: cash + plotsValue + constructionValue + receivable,
  };
}
