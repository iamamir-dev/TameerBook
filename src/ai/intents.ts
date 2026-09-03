import { periodRange, type DateRange } from '@/utils/period';

import { coerceDraft, type Draft } from './drafts';

/**
 * The QUESTION catalogue. The model never writes SQL: it picks one of these
 * intents and fills its parameters with NAMES from the user's own data, and
 * `runner.ts` answers it with existing repository queries. Pure + unit-tested.
 */

export const PERIOD_KINDS = ['today', 'yesterday', 'week', 'month', 'lastMonth', 'quarter', 'year', 'all'] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];
export type Period = { kind: PeriodKind } | { kind: 'custom'; start: string; end: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function shiftDay(iso: string, days: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive date window for a period, anchored on `todayIso`. */
export function periodToRange(p: Period, todayIso: string): DateRange {
  switch (p.kind) {
    case 'custom':
      return { start: p.start, end: p.end };
    case 'yesterday': {
      const y = shiftDay(todayIso, -1);
      return { start: y, end: y };
    }
    case 'lastMonth': {
      const first = `${todayIso.slice(0, 7)}-01`;
      const lastDayPrev = shiftDay(first, -1);
      return { start: `${lastDayPrev.slice(0, 7)}-01`, end: lastDayPrev };
    }
    default:
      return periodRange(p.kind, todayIso);
  }
}

export function coercePeriod(raw: unknown, fallback: PeriodKind = 'month'): Period {
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (o.kind === 'custom' && typeof o.start === 'string' && typeof o.end === 'string' && ISO_DAY.test(o.start) && ISO_DAY.test(o.end)) {
      return o.start <= o.end ? { kind: 'custom', start: o.start, end: o.end } : { kind: 'custom', start: o.end, end: o.start };
    }
    if (typeof o.kind === 'string' && (PERIOD_KINDS as readonly string[]).includes(o.kind)) return { kind: o.kind as PeriodKind };
  }
  if (typeof raw === 'string' && (PERIOD_KINDS as readonly string[]).includes(raw)) return { kind: raw as PeriodKind };
  return { kind: fallback };
}

export const INTENT_TYPES = [
  'spend_by_category',
  'spend_summary',
  'project_status',
  'worker_balance',
  'party_history',
  'udhaar_balance',
  'account_balance',
  'plot_status',
  'investor_status',
  'sale_status',
  'purchase_orders',
  'insights',
  'company_overview',
  'list_entities',
  'report',
  'expense_breakdown',
  'cashflow_chart',
  'recent_entries',
  'top_suppliers',
  'pnl',
] as const;
export type IntentType = (typeof INTENT_TYPES)[number];

export type Intent =
  | { type: 'spend_by_category'; category: string; project?: string; period: Period }
  | { type: 'spend_summary'; project?: string; period: Period }
  | { type: 'project_status'; project?: string }
  | { type: 'worker_balance'; worker?: string }
  | { type: 'party_history'; party: string; period: Period }
  | { type: 'udhaar_balance'; person?: string }
  | { type: 'account_balance'; account?: string }
  | { type: 'plot_status'; plot?: string }
  | { type: 'investor_status'; investor?: string }
  | { type: 'sale_status'; project?: string }
  | { type: 'purchase_orders'; status: PoStatusFilter }
  | { type: 'insights' }
  | { type: 'company_overview' }
  | { type: 'list_entities'; entity: EntityKind }
  /** Open one of the app's PDF reports (or a project's own report). */
  | { type: 'report'; report: ReportKind; project?: string }
  /** Spend by category as a bar chart. */
  | { type: 'expense_breakdown'; project?: string; period: Period }
  /** Money in vs out per month as columns. */
  | { type: 'cashflow_chart'; months: number }
  | { type: 'recent_entries'; period: Period }
  | { type: 'top_suppliers' }
  | { type: 'pnl' };

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Things the user can ask to be LISTED by name (no money attached). */
export const ENTITY_KINDS = ['projects', 'plots', 'workers', 'suppliers', 'investors', 'accounts', 'materials'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

/** How the user wants purchase orders filtered. */
export const PO_STATUS_FILTERS = ['pending', 'delivered', 'unpaid', 'open', 'all'] as const;
export type PoStatusFilter = (typeof PO_STATUS_FILTERS)[number];

/** The app's PDF reports (Settings → Reports) plus a project's own report. */
export const REPORT_KINDS = ['summary', 'pnl', 'cashflow', 'expense', 'investment', 'roi', 'accounts', 'project'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

/** Screens the assistant may OPEN on request ("add a new project"). */
export const OPEN_SCREENS = [
  'NewProject',
  'NewPlot',
  'NewPurchaseOrder',
  'QuickEntry',
  'Transfer',
  'Labor',
  'Udhaar',
  'Bookings',
  'Cash',
  'Accounts',
  'Reports',
  'Categories',
  'Settings',
  'Projects',
  'Plots',
  'Investors',
] as const;
export type OpenScreen = (typeof OPEN_SCREENS)[number];

/** Validate + coerce a raw model object into an `Intent` (null = not usable). */
export function coerceIntent(raw: unknown): Intent | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const rawType = o.type;
  if (typeof rawType !== 'string' || !(INTENT_TYPES as readonly string[]).includes(rawType)) return null;
  const type = rawType as IntentType;
  switch (type) {
    case 'spend_by_category': {
      const category = str(o.category);
      if (!category) return null;
      return { type, category, project: str(o.project), period: coercePeriod(o.period) };
    }
    case 'spend_summary':
      return { type, project: str(o.project), period: coercePeriod(o.period) };
    case 'project_status':
      return { type, project: str(o.project) };
    case 'worker_balance':
      return { type, worker: str(o.worker) };
    case 'party_history': {
      const party = str(o.party);
      if (!party) return null;
      return { type, party, period: coercePeriod(o.period, 'all') };
    }
    case 'udhaar_balance':
      return { type, person: str(o.person) };
    case 'account_balance':
      return { type, account: str(o.account) };
    case 'plot_status':
      return { type, plot: str(o.plot) };
    case 'investor_status':
      return { type, investor: str(o.investor) };
    case 'sale_status':
      return { type, project: str(o.project) };
    case 'purchase_orders': {
      const raw = str(o.status)?.toLowerCase();
      const status: PoStatusFilter = raw && (PO_STATUS_FILTERS as readonly string[]).includes(raw) ? (raw as PoStatusFilter) : o.openOnly === false ? 'all' : 'open';
      return { type, status };
    }
    case 'recent_entries':
      return { type, period: coercePeriod(o.period, 'week') };
    case 'list_entities': {
      const entity = str(o.entity);
      if (!entity || !(ENTITY_KINDS as readonly string[]).includes(entity)) return null;
      return { type, entity: entity as EntityKind };
    }
    case 'report': {
      const report = str(o.report);
      if (!report || !(REPORT_KINDS as readonly string[]).includes(report)) return null;
      return { type, report: report as ReportKind, project: str(o.project) };
    }
    case 'expense_breakdown':
      return { type, project: str(o.project), period: coercePeriod(o.period) };
    case 'cashflow_chart': {
      const m = typeof o.months === 'number' ? o.months : Number(o.months);
      return { type, months: Number.isFinite(m) && m >= 2 && m <= 12 ? Math.round(m) : 6 };
    }
    case 'insights':
    case 'company_overview':
    case 'top_suppliers':
    case 'pnl':
      return { type };
  }
}

/** What the router model returns: a question, a draft entry, or plain talk. */
export type RouterResult =
  | { kind: 'question'; intent: Intent }
  | { kind: 'draft'; draft: Draft }
  | { kind: 'open'; screen: OpenScreen }
  | { kind: 'chat'; reply: string };

/** Parse the router's JSON into a `RouterResult` (null = unusable shape). */
export function parseRouterOutput(raw: unknown): RouterResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === 'question') {
    const intent = coerceIntent(o.intent);
    return intent ? { kind: 'question', intent } : null;
  }
  if (o.kind === 'draft') {
    const draft = coerceDraft(o.draft);
    return draft ? { kind: 'draft', draft } : null;
  }
  if (o.kind === 'open' && typeof o.screen === 'string' && (OPEN_SCREENS as readonly string[]).includes(o.screen)) {
    return { kind: 'open', screen: o.screen as OpenScreen };
  }
  if (o.kind === 'chat' && typeof o.reply === 'string' && o.reply.trim()) return { kind: 'chat', reply: o.reply.trim() };
  // Lenient: a bare intent or draft object without the wrapper.
  const intent = coerceIntent(o);
  if (intent) return { kind: 'question', intent };
  const draft = coerceDraft(o);
  if (draft) return { kind: 'draft', draft };
  return null;
}
