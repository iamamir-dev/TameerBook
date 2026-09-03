import { getDatabase } from '../database';
import { todayLocalISO } from '../uuid';
import {
  INSIGHT_RULES,
  daysBetween,
  isRateOutlier,
  rankInsights,
  severityFor,
  type Insight,
} from '../../utils/insights';
import { requireCompanyId } from './companies';
import { listLaborersWithTotals } from './labor';
import { listTransferDeadlines } from './plots';
import { listUdhaar } from './udhaar';

/**
 * INSIGHTS — the assistant's proactive suggestions, derived entirely from the
 * ledger with SQL (offline, free, no model). Each rule returns zero or more
 * `Insight`s; `listInsights` runs them all and ranks the result. A rule that
 * fails never hides the others.
 *
 * Thresholds live in `INSIGHT_RULES` (src/utils/insights.ts) so policy is
 * readable in one place and unit-tested.
 */

/** Every insight for the active company, most urgent first. */
export async function listInsights(today = todayLocalISO()): Promise<Insight[]> {
  const rules: Array<() => Promise<Insight[]>> = [
    () => workerOwedInsights(today),
    () => duplicateEntryInsights(today),
    () => rateOutlierInsights(),
    () => transferDeadlineInsights(today),
    () => buyerOutstandingInsights(today),
    () => staleUdhaarInsights(today),
    () => poUndeliveredInsights(today),
    () => spendSpikeInsights(today),
  ];
  const settled = await Promise.allSettled(rules.map((r) => r()));
  const all: Insight[] = [];
  for (const s of settled) if (s.status === 'fulfilled') all.push(...s.value);
  return rankInsights(all);
}

/* -------------------------------------------------------------------------- */
/*  Rules                                                                     */
/* -------------------------------------------------------------------------- */

/** Workers owed money for longer than the warning window. */
async function workerOwedInsights(today: string): Promise<Insight[]> {
  const db = await getDatabase();
  const workers = (await listLaborersWithTotals()).filter((w) => w.balance > 0);
  if (workers.length === 0) return [];
  const out: Insight[] = [];
  for (const w of workers) {
    // Age = since the last payment, or since the first paid day if never paid.
    const row = await db.getFirstAsync<{ last_paid: string | null; first_day: string | null }>(
      `SELECT
         (SELECT MAX(t.date) FROM transactions t
            JOIN project_laborers pl ON pl.id = t.labor_id
            WHERE pl.laborer_id = ? AND t.is_void = 0) AS last_paid,
         (SELECT MIN(la.date) FROM labor_attendance la
            JOIN project_laborers pl ON pl.id = la.project_laborer_id
            WHERE pl.laborer_id = ? AND la.wage_accrued > 0) AS first_day`,
      w.id,
      w.id
    );
    const since = row?.last_paid ?? row?.first_day;
    if (!since) continue;
    const days = daysBetween(since, today);
    if (days < INSIGHT_RULES.workerOwedWarnDays) continue;
    out.push({
      id: `workerOwed:${w.id}`,
      kind: 'workerOwed',
      severity: severityFor('workerOwed', days),
      subject: w.name,
      amount: w.balance,
      days,
      target: { screen: 'LaborerDetail', laborerId: w.id },
    });
  }
  return out;
}

/** Two live entries today with the same amount, account, category and party. */
async function duplicateEntryInsights(today: string): Promise<Insight[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ amount: number; n: number; label: string | null }>(
    `SELECT t.amount, COUNT(*) AS n,
            COALESCE(c.name_en, t.description) AS label
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.company_id = ? AND t.date = ? AND t.is_void = 0
       AND t.transfer_id IS NULL AND t.amount > 0
     GROUP BY t.direction, t.amount, t.account_id, t.category_id, t.party_id
     HAVING n > 1`,
    requireCompanyId(),
    today
  );
  return rows.map((r) => ({
    id: `duplicateEntry:${r.label ?? ''}:${r.amount}`,
    kind: 'duplicateEntry' as const,
    severity: severityFor('duplicateEntry'),
    subject: r.label ?? '',
    amount: r.amount,
    target: { screen: 'Cash' as const },
  }));
}

/** Latest material rate per category vs the median of the earlier purchases. */
async function rateOutlierInsights(): Promise<Insight[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ category_id: string; name: string; rate: number; project_id: string | null }>(
    `SELECT t.category_id, c.name_en AS name, t.amount * 1.0 / t.qty AS rate, t.project_id
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.company_id = ? AND t.is_void = 0 AND t.direction = 'OUT'
       AND t.qty IS NOT NULL AND t.qty > 0 AND t.category_id IS NOT NULL
     ORDER BY t.date DESC, t.created_at DESC`,
    requireCompanyId()
  );
  const byCat = new Map<string, { name: string; rates: number[]; projectId: string | null }>();
  for (const r of rows) {
    const e = byCat.get(r.category_id) ?? { name: r.name, rates: [], projectId: r.project_id };
    if (e.rates.length <= INSIGHT_RULES.rateOutlierMinSamples + 2) e.rates.push(r.rate);
    byCat.set(r.category_id, e);
  }
  const out: Insight[] = [];
  for (const [catId, e] of byCat) {
    const [latest, ...earlier] = e.rates;
    const { outlier, usual } = isRateOutlier(latest, earlier);
    if (!outlier) continue;
    out.push({
      id: `rateOutlier:${catId}`,
      kind: 'rateOutlier',
      severity: severityFor('rateOutlier'),
      subject: e.name,
      amount: Math.round(latest),
      reference: Math.round(usual),
      target: e.projectId ? { screen: 'ConstructionDetail', projectId: e.projectId } : { screen: 'Cash' },
    });
  }
  return out;
}

/** Plot transfer deadlines inside the warning window (or overdue). */
async function transferDeadlineInsights(today: string): Promise<Insight[]> {
  const rows = await listTransferDeadlines();
  return rows
    .map((r) => ({ r, days: daysBetween(today, r.transfer_deadline) }))
    .filter(({ days }) => days <= INSIGHT_RULES.deadlineWarnDays)
    .map(({ r, days }) => ({
      id: `transferDeadline:${r.plot_id}`,
      kind: 'transferDeadline' as const,
      severity: severityFor('transferDeadline', days),
      subject: r.plot_name,
      days,
      target: { screen: 'PlotDetail' as const, plotId: r.plot_id },
    }));
}

/** Active projects where the buyer still owes and nothing arrived for a while. */
async function buyerOutstandingInsights(today: string): Promise<Insight[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    project_id: string;
    name: string;
    agreed: number;
    received: number;
    last_receipt: string | null;
    sale_created: string;
  }>(
    `SELECT p.id AS project_id, p.name, s.agreed_price AS agreed,
            COALESCE((SELECT SUM(sr.amount) FROM sale_receipts sr WHERE sr.sale_id = s.id AND sr.is_void = 0), 0) AS received,
            (SELECT MAX(sr.date) FROM sale_receipts sr WHERE sr.sale_id = s.id AND sr.is_void = 0) AS last_receipt,
            s.created_at AS sale_created
     FROM sales s JOIN projects p ON p.id = s.project_id
     WHERE p.company_id = ? AND p.status = 'ACTIVE' AND s.agreed_price > 0`,
    requireCompanyId()
  );
  const out: Insight[] = [];
  for (const r of rows) {
    const outstanding = r.agreed - r.received;
    if (outstanding <= 0) continue;
    const since = r.last_receipt ?? r.sale_created.slice(0, 10);
    const days = daysBetween(since, today);
    if (days < INSIGHT_RULES.buyerQuietDays) continue;
    out.push({
      id: `buyerOutstanding:${r.project_id}`,
      kind: 'buyerOutstanding',
      severity: severityFor('buyerOutstanding'),
      subject: r.name,
      amount: outstanding,
      days,
      target: { screen: 'SaleDetail', projectId: r.project_id },
    });
  }
  return out;
}

/** Money lent out with no repayment for a long time. */
async function staleUdhaarInsights(today: string): Promise<Insight[]> {
  const db = await getDatabase();
  const open = (await listUdhaar('OPEN')).filter((u) => u.direction === 'GIVEN' && u.balance > 0);
  const out: Insight[] = [];
  for (const u of open) {
    const row = await db.getFirstAsync<{ last: string | null }>(
      'SELECT MAX(date) AS last FROM transactions WHERE udhaar_id = ? AND is_void = 0',
      u.id
    );
    const since = row?.last ?? u.created_at.slice(0, 10);
    const days = daysBetween(since, today);
    if (days < INSIGHT_RULES.udhaarStaleDays) continue;
    out.push({
      id: `staleUdhaar:${u.id}`,
      kind: 'staleUdhaar',
      severity: severityFor('staleUdhaar'),
      subject: u.person_name,
      amount: u.balance,
      days,
      target: { screen: 'UdhaarDetail', udhaarId: u.id },
    });
  }
  return out;
}

/** Open purchase orders with nothing delivered after the grace window. */
async function poUndeliveredInsights(today: string): Promise<Insight[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; po_number: string | null; supplier: string | null; created: string; total: number }>(
    `SELECT COALESCE(b.po_id, b.id) AS key, b.po_number, b.supplier_name AS supplier,
            MIN(b.created_at) AS created, SUM(b.total) AS total
     FROM material_bookings b
     WHERE b.company_id = ? AND b.status = 'OPEN'
       AND NOT EXISTS (SELECT 1 FROM material_deliveries d WHERE d.booking_id = b.id)
     GROUP BY COALESCE(b.po_id, b.id)`,
    requireCompanyId()
  );
  const out: Insight[] = [];
  for (const r of rows) {
    const days = daysBetween(r.created.slice(0, 10), today);
    if (days < INSIGHT_RULES.poUndeliveredDays) continue;
    out.push({
      id: `poUndelivered:${r.key}`,
      kind: 'poUndelivered',
      severity: severityFor('poUndelivered'),
      subject: [r.po_number, r.supplier].filter(Boolean).join(' · ') || r.key,
      amount: r.total,
      days,
      target: { screen: 'PurchaseOrderDetail', poId: r.key },
    });
  }
  return out;
}

/** Construction spend this month-to-date vs last month to the same day. */
async function spendSpikeInsights(today: string): Promise<Insight[]> {
  const db = await getDatabase();
  const day = today.slice(8, 10);
  const thisStart = `${today.slice(0, 7)}-01`;
  const prev = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 2, 1));
  const prevPrefix = prev.toISOString().slice(0, 7);
  const prevStart = `${prevPrefix}-01`;
  const prevEnd = `${prevPrefix}-${day}`;
  const rows = await db.getAllAsync<{ project_id: string; name: string; cur: number; last: number }>(
    `SELECT p.id AS project_id, p.name,
       COALESCE(SUM(CASE WHEN t.date >= ? AND t.date <= ? THEN t.amount END), 0) AS cur,
       COALESCE(SUM(CASE WHEN t.date >= ? AND t.date <= ? THEN t.amount END), 0) AS last
     FROM projects p
     JOIN transactions t ON t.project_id = p.id AND t.is_void = 0 AND t.direction = 'OUT'
       AND t.phase = 'CONSTRUCTION' AND t.labor_id IS NULL
     WHERE p.company_id = ? AND p.status = 'ACTIVE'
     GROUP BY p.id`,
    thisStart,
    today,
    prevStart,
    prevEnd,
    requireCompanyId()
  );
  return rows
    .filter((r) => r.last > 0 && r.cur >= INSIGHT_RULES.spendSpikeFloor && r.cur >= r.last * INSIGHT_RULES.spendSpikeRatio)
    .map((r) => ({
      id: `spendSpike:${r.project_id}`,
      kind: 'spendSpike' as const,
      severity: severityFor('spendSpike'),
      subject: r.name,
      amount: r.cur,
      reference: r.last,
      target: { screen: 'ConstructionDetail' as const, projectId: r.project_id },
    }));
}

/* -------------------------------------------------------------------------- */
/*  Smart defaults                                                            */
/* -------------------------------------------------------------------------- */

export interface LastRate {
  rate: number;
  qty: number;
  date: string;
  partyName: string | null;
}

/**
 * The most recent unit rate paid for a material (amount ÷ qty), preferring the
 * same supplier when one is given. Powers the "last rate" hint on entry forms.
 */
export async function getLastMaterialRate(categoryId: string, partyId?: string | null): Promise<LastRate | null> {
  const db = await getDatabase();
  const sql = (withParty: boolean) =>
    `SELECT t.amount * 1.0 / t.qty AS rate, t.qty, t.date, pa.name AS partyName
     FROM transactions t LEFT JOIN parties pa ON pa.id = t.party_id
     WHERE t.company_id = ? AND t.is_void = 0 AND t.direction = 'OUT'
       AND t.category_id = ? AND t.qty IS NOT NULL AND t.qty > 0 ${withParty ? 'AND t.party_id = ?' : ''}
     ORDER BY t.date DESC, t.created_at DESC LIMIT 1`;
  const cid = requireCompanyId();
  const row =
    (partyId ? await db.getFirstAsync<LastRate>(sql(true), cid, categoryId, partyId) : null) ??
    (await db.getFirstAsync<LastRate>(sql(false), cid, categoryId));
  return row ? { ...row, rate: Math.round(row.rate) } : null;
}
