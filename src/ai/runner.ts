import {
  getCashFlow,
  getCompanyAssets,
  getConstructionSummary,
  getInvestorSummary,
  getProjectCapitalSummary,
  getProjectSummary,
  getLaborerKhata,
  getSaleSummary,
  listAccountsWithBalance,
  listAllCompanyTransactions,
  listInsights,
  listInvestorsWithCapital,
  listLaborersWithTotals,
  listPlotSummaries,
  listProjectLaborers,
  listProjectSummaries,
  listPurchaseOrders,
  listUdhaar,
  getUdhaarTotals,
  getPnl,
  getTopSuppliers,
  type TransactionRow,
} from '@/db';
import { t, type TranslationKey } from '@/i18n';
import { formatDisplayDate } from '@/utils/date';
import { describeInsight } from '@/utils/insights';
import { insightLabels } from '@/utils/insightLabels';
import { formatQty, formatRupees } from '@/utils/money';
import { inRange, type DateRange } from '@/utils/period';

import type { CategoryNamed } from './drafts';
import { matchName, type Named } from './match';
import { periodToRange, type Intent, type Period } from './intents';
import type { World } from './prompts';

/**
 * Answers an `Intent` with EXISTING repository queries. This is the whole
 * reason the model never writes SQL: every number here comes from the same
 * functions the screens use, so the assistant can never disagree with the
 * app. Returns display-ready data plus one sentence to speak.
 */

export interface AnswerRow {
  id: string;
  title: string;
  /** ISO day shown under the title unless `subtitle` overrides it. */
  date: string;
  subtitle?: string;
  amount: number;
  direction: 'in' | 'out';
  typeLabel?: string;
}

export type AnswerTarget =
  | { screen: 'Cash' | 'Labor' | 'Udhaar' | 'Bookings' | 'Accounts' | 'Reports' | 'Investors' | 'Plots' }
  | { screen: 'ProjectDetail'; projectId: string }
  | { screen: 'ConstructionDetail'; projectId: string }
  | { screen: 'SaleDetail'; projectId: string }
  | { screen: 'LaborerDetail'; laborerId: string }
  | { screen: 'PlotDetail'; plotId: string }
  | { screen: 'InvestorProfile'; investorId: string }
  | { screen: 'UdhaarDetail'; udhaarId: string }
  | { screen: 'PurchaseOrderDetail'; poId: string }
  | { screen: 'Report'; type: 'summary' | 'pnl' | 'cashflow' | 'expense' | 'investment' | 'roi' | 'accounts' };

/** A small chart drawn inside the answer card. */
/** A month grid: ISO date → status, plus the counts the legend shows. */
export interface AnswerCalendar {
  /** YYYY-MM */
  month: string;
  days: Record<string, 'FULL' | 'HALF' | 'ABSENT'>;
  full: number;
  half: number;
  absent: number;
}

export type AnswerChart =
  | { kind: 'bars'; items: { label: string; value: number }[] }
  | { kind: 'columns'; groups: { label: string; values: [number, number] }[]; legend: [string, string] };

/** A names-only line (no money): "Wapda Town B-103 · Active". */
export interface AnswerListItem {
  id: string;
  title: string;
  subtitle?: string;
}

export interface Answer {
  title: string;
  /** The one big number. */
  headline?: string;
  /** Small line under the headline. */
  sub?: string;
  rows: AnswerRow[];
  /** Compact names-only list (used instead of `rows` for list questions). */
  list?: AnswerListItem[];
  /** Optional chart above the rows. */
  chart?: AnswerChart;
  /** One month of attendance, drawn as a calendar (worker_attendance). */
  calendar?: AnswerCalendar;
  /** Grouped rows for detail reports (rendered as titled groups). */
  sections?: { title: string; rows: AnswerRow[] }[];
  /** Open `target` immediately (the user asked for the thing itself, e.g. a PDF). */
  autoOpen?: boolean;
  /** One plain sentence — the bubble text and what gets read aloud. */
  speak: string;
  /** Where "Open" goes. */
  target?: AnswerTarget;
}

const MAX_ROWS = 25;
const money = formatRupees;

const PERIOD_KEY: Record<Exclude<Period['kind'], 'custom'>, TranslationKey> = {
  today: 'today',
  yesterday: 'yesterday',
  week: 'thisWeek',
  month: 'thisMonth',
  lastMonth: 'lastMonthLabel',
  quarter: 'thisQuarter',
  year: 'thisYear',
  all: 'allTime',
};

export function periodLabel(p: Period): string {
  return p.kind === 'custom' ? `${formatDisplayDate(p.start)} – ${formatDisplayDate(p.end)}` : t(PERIOD_KEY[p.kind]);
}

const catLabel = (c: CategoryNamed | undefined, w: World): string =>
  c ? (w.language === 'ur' && c.alt?.[0] ? c.alt[0] : c.name) : '';

const pick = <T extends Named>(q: string | undefined, list: readonly T[]): T | undefined =>
  q ? matchName(q, list)?.item : undefined;

/** Category + all its children (asking for "Materials" sums every material). */
function categoryFamily(c: CategoryNamed, w: World): Set<string> {
  const ids = new Set<string>([c.id]);
  for (const k of w.categories) if (k.parentId === c.id) ids.add(k.id);
  return ids;
}

function txnRow(x: TransactionRow, w: World): AnswerRow {
  const cat = w.categories.find((c) => c.id === x.category_id);
  const party = w.parties.find((p) => p.id === x.party_id)?.name ?? x.counterparty_name ?? '';
  return {
    id: x.id,
    title: x.description || catLabel(cat, w) || party || t('noCategory'),
    date: x.date,
    amount: x.amount,
    direction: x.direction === 'IN' ? 'in' : 'out',
    typeLabel: party || catLabel(cat, w) || undefined,
  };
}

async function liveTxns(range: DateRange): Promise<TransactionRow[]> {
  const all = await listAllCompanyTransactions();
  return all.filter((x) => x.transfer_id === null && inRange(x.date, range));
}

const none = (title: string): Answer => ({ title, rows: [], speak: t('noResultsLabel') });

/** Run one intent → one answer. */
export async function runIntent(intent: Intent, w: World): Promise<Answer> {
  switch (intent.type) {
    case 'spend_by_category': {
      const cat = pick(intent.category, w.categories.filter((c) => c.type === 'EXPENSE'));
      if (!cat) return none(intent.category);
      const ids = categoryFamily(cat, w);
      const project = pick(intent.project, w.projects);
      const range = periodToRange(intent.period, w.today);
      const rows = (await liveTxns(range)).filter(
        (x) => x.direction === 'OUT' && x.category_id && ids.has(x.category_id) && (!project || x.project_id === project.id)
      );
      const total = rows.reduce((s, x) => s + x.amount, 0);
      const qty = rows.reduce((s, x) => s + (x.qty ?? 0), 0);
      const title = `${catLabel(cat, w)} · ${periodLabel(intent.period)}${project ? ` · ${project.name}` : ''}`;
      const qtyText = qty > 0 ? `${formatQty(qty)} ${cat.unit ?? ''}`.trim() : '';
      return {
        title,
        headline: money(total),
        sub: [qtyText, `${rows.length} ${t('transactions').toLowerCase()}`].filter(Boolean).join(' · '),
        rows: rows.slice(0, MAX_ROWS).map((x) => txnRow(x, w)),
        speak: `${title}: ${money(total)}${qtyText ? ` · ${qtyText}` : ''}`,
        target: project ? { screen: 'ProjectDetail', projectId: project.id } : { screen: 'Cash' },
      };
    }

    case 'spend_summary': {
      const project = pick(intent.project, w.projects);
      const range = periodToRange(intent.period, w.today);
      const rows = (await liveTxns(range)).filter((x) => !project || x.project_id === project.id);
      const inSum = rows.filter((x) => x.direction === 'IN').reduce((s, x) => s + x.amount, 0);
      const outSum = rows.filter((x) => x.direction === 'OUT').reduce((s, x) => s + x.amount, 0);
      const title = `${periodLabel(intent.period)}${project ? ` · ${project.name}` : ''}`;
      return {
        title,
        headline: money(inSum - outSum),
        sub: `${t('moneyIn')} ${money(inSum)} · ${t('moneyOut')} ${money(outSum)}`,
        rows: rows.slice(0, MAX_ROWS).map((x) => txnRow(x, w)),
        speak: `${title}: ${t('moneyIn')} ${money(inSum)}, ${t('moneyOut')} ${money(outSum)}, ${t('netFlow')} ${money(inSum - outSum)}`,
        target: project ? { screen: 'ProjectDetail', projectId: project.id } : { screen: 'Cash' },
      };
    }

    case 'project_status': {
      const summaries = await listProjectSummaries();
      const project = pick(intent.project, w.projects);
      const chosen = project ? summaries.filter((s) => s.project.id === project.id) : summaries.filter((s) => s.project.status === 'ACTIVE');
      if (chosen.length === 0) return none(t('projects'));
      if (chosen.length === 1) {
        const s = chosen[0];
        const profit = s.saleReceived - s.cost.totalCost;
        return {
          title: s.project.name,
          headline: money(s.cost.totalCost),
          sub: `${t('aiCostLabel')} · ${t('aiSoldLabel')} ${money(s.saleDeal)} · ${t('aiReceivedLabel')} ${money(s.saleReceived)}`,
          rows: [
            { id: 'plot', title: t('assetPlots'), date: '', subtitle: '', amount: s.cost.plotCost, direction: 'out' },
            { id: 'con', title: t('assetConstruction'), date: '', subtitle: '', amount: s.cost.constructionCost, direction: 'out' },
            { id: 'sale', title: t('aiReceivedLabel'), date: '', subtitle: '', amount: s.saleReceived, direction: 'in' },
          ],
          speak: `${s.project.name}: ${t('aiCostLabel')} ${money(s.cost.totalCost)}${s.saleDeal > 0 ? `, ${t('aiSoldLabel')} ${money(s.saleDeal)}, ${t('aiReceivedLabel')} ${money(s.saleReceived)}, ${t('netSoFar')} ${money(profit)}` : ''}`,
          target: { screen: 'ProjectDetail', projectId: s.project.id },
        };
      }
      const total = chosen.reduce((s, x) => s + x.cost.totalCost, 0);
      return {
        title: t('projects'),
        headline: money(total),
        sub: `${chosen.length} · ${t('aiCostLabel')}`,
        rows: chosen.map((s) => ({ id: s.project.id, title: s.project.name, date: '', subtitle: t('aiCostLabel'), amount: s.cost.totalCost, direction: 'out' as const })),
        speak: `${chosen.length} ${t('projects')}: ${t('aiCostLabel')} ${money(total)}`,
      };
    }

    case 'project_details': {
      const project = pick(intent.project, w.projects);
      if (!project) return none(intent.project);
      const monthPrefix = w.today.slice(0, 7);
      const [summary, sale, capital, workers, pos, construction, insights] = await Promise.all([
        getProjectSummary(project.id),
        getSaleSummary(project.id),
        getProjectCapitalSummary(project.id),
        listProjectLaborers(project.id),
        listPurchaseOrders(),
        getConstructionSummary(project.id, monthPrefix),
        listInsights(w.today),
      ]);
      if (!summary) return none(project.name);
      const cost = summary.cost;
      const agreed = sale.sale?.agreed_price ?? 0;
      const profitSoFar = summary.saleReceived - cost.totalCost;
      const projectPos = pos.filter((p) => p.projectId === project.id && p.status !== 'CANCELLED');
      const owedWorkers = workers.filter((x) => x.balance.balance > 0);
      const attention = insights.filter((i) => 'projectId' in i.target && i.target.projectId === project.id);
      const labels = insightLabels(t);
      const sections: { title: string; rows: AnswerRow[] }[] = [
        {
          title: t('aiCostLabel'),
          rows: [
            { id: 'plot', title: t('assetPlots'), date: '', subtitle: '', amount: cost.plotCost, direction: 'out' as const },
            { id: 'con', title: t('assetConstruction'), date: '', subtitle: `${t('laborTitle')} ${money(construction.laborAccrued)}`, amount: cost.constructionCost, direction: 'out' as const },
            { id: 'salec', title: t('kharcha'), date: '', subtitle: t('aiSoldLabel'), amount: cost.saleCost, direction: 'out' as const },
          ].filter((r) => r.amount > 0),
        },
        {
          title: `${t('material')} · ${t('thisMonth')}`,
          rows: construction.byCategory.slice(0, 6).map((c) => ({ id: c.categoryId, title: w.language === 'ur' ? c.nameUr : c.nameEn, date: '', subtitle: c.qty > 0 ? `${formatQty(c.qty)} ${c.unit ?? ''}`.trim() : '', amount: c.total, direction: 'out' as const })),
        },
        {
          title: t('aiSoldLabel'),
          rows: agreed > 0
            ? [
                { id: 'agreed', title: t('agreedPrice'), date: '', subtitle: sale.sale?.buyer_name ?? '', amount: agreed, direction: 'in' as const },
                { id: 'recv', title: t('aiReceivedLabel'), date: '', subtitle: `${sale.receipts.filter((r) => !r.is_void).length} ${t('transactions').toLowerCase()}`, amount: sale.receiptsTotal, direction: 'in' as const },
                { id: 'out', title: t('remaining'), date: '', subtitle: t('insightBuyerOwes'), amount: sale.outstanding, direction: 'out' as const },
              ]
            : [],
        },
        {
          title: `${t('investors')} · ${money(capital.totalCapital)}`,
          rows: capital.shares.map((sh) => ({ id: sh.projectInvestorId, title: sh.name, date: '', subtitle: `${Math.round(sh.ownershipPct)}%`, amount: sh.capital, direction: 'in' as const })),
        },
        {
          title: `${t('laborTitle')} · ${workers.length} ${t('aiWorkersLabel')}`,
          rows: workers.map((x) => ({ id: x.projectLaborer.id, title: x.laborer.name, date: '', subtitle: `${t('aiWage')} ${money(x.projectLaborer.daily_wage)} · ${x.balance.daysFull + x.balance.daysHalf} ${t('daysLabel')}`, amount: x.balance.balance, direction: 'out' as const })),
        },
        {
          title: `${t('bookingsTitle')} · ${projectPos.length}`,
          rows: projectPos.map((p) => ({ id: p.poId, title: [p.poNumber, p.supplierName].filter(Boolean).join(' · '), date: '', subtitle: p.fullyReceived ? t('poDelivered') : t('poPending'), amount: p.payRemaining, direction: 'out' as const })),
        },
        {
          title: t('suggestionsTitle'),
          rows: attention.map((i) => ({ id: i.id, title: describeInsight(i, labels, money), date: '', subtitle: '', amount: i.amount ?? 0, direction: 'out' as const })),
        },
      ].filter((sec) => sec.rows.length > 0);
      const owed = owedWorkers.reduce((s, x) => s + x.balance.balance, 0);
      return {
        title: `${project.name} · ${summary.project.status === 'ACTIVE' ? t('statusActive') : t('statusCompleted')}`,
        headline: money(cost.totalCost),
        sub: `${t('aiCostLabel')} · ${agreed > 0 ? `${t('aiSoldLabel')} ${money(agreed)} · ${t('netSoFar')} ${money(profitSoFar)}` : `${capital.shares.length} ${t('investors').toLowerCase()} · ${workers.length} ${t('aiWorkersLabel')}`}`,
        rows: [],
        sections,
        speak: `${project.name}: ${t('aiCostLabel')} ${money(cost.totalCost)}${agreed > 0 ? `, ${t('aiSoldLabel')} ${money(agreed)}, ${t('aiReceivedLabel')} ${money(sale.receiptsTotal)}` : ''}${owed > 0 ? `, ${t('laborTitle')} ${t('outstanding')} ${money(owed)}` : ''}`,
        target: { screen: 'ProjectDetail', projectId: project.id },
      };
    }

    case 'worker_balance': {
      const worker = pick(intent.worker, w.workers);
      if (worker) {
        const k = await getLaborerKhata(worker.id);
        return {
          title: k.laborer.name,
          headline: money(k.totals.balance),
          sub: `${t('outstanding')} · ${t('insightOwed')}`,
          rows: k.history.slice(0, MAX_ROWS).map((h, i) => ({
            id: `${h.projectLaborerId}:${h.ts}:${i}`,
            title: h.kind === 'PAYMENT' ? t('payWorker') : h.projectName,
            date: h.date,
            amount: h.amount,
            direction: h.kind === 'PAYMENT' ? 'out' : 'in',
            typeLabel: h.kind === 'PAYMENT' ? undefined : (h.attendanceStatus ?? undefined),
          })),
          speak: `${k.laborer.name}: ${t('outstanding')} ${money(k.totals.balance)}`,
          target: { screen: 'LaborerDetail', laborerId: worker.id },
        };
      }
      const all = (await listLaborersWithTotals()).filter((x) => x.balance !== 0);
      const total = all.reduce((s, x) => s + x.balance, 0);
      return {
        title: t('laborTitle'),
        headline: money(total),
        sub: `${all.length} ${t('aiWorkersLabel')} · ${t('outstanding')}`,
        rows: all.map((x) => ({ id: x.id, title: x.name, date: '', subtitle: `${x.projects} ${t('projects').toLowerCase()}`, amount: x.balance, direction: 'out' as const })),
        speak: `${t('laborTitle')}: ${t('outstanding')} ${money(total)} · ${all.length} ${t('aiWorkersLabel')}`,
        target: { screen: 'Labor' },
      };
    }

    case 'worker_attendance': {
      const worker = pick(intent.worker, w.workers);
      if (!worker) return none(t('laborTitle'));
      const k = await getLaborerKhata(worker.id);
      const now = new Date();
      const month = intent.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const marks = k.history.filter((h) => h.kind === 'ATTENDANCE' && h.attendanceStatus && h.date.startsWith(month));
      const days: AnswerCalendar['days'] = {};
      for (const m of marks) days[m.date] = m.attendanceStatus as 'FULL' | 'HALF' | 'ABSENT';
      const count = (s: string) => Object.values(days).filter((v) => v === s).length;
      const full = count('FULL');
      const half = count('HALF');
      const absent = count('ABSENT');
      const earned = marks.reduce((s, m) => s + m.amount, 0);
      const monthName = formatDisplayDate(`${month}-01`).slice(2).trim();
      const projects = Array.from(new Set(marks.map((m) => m.projectName).filter(Boolean)));
      return {
        title: `${k.laborer.name} · ${monthName}`,
        headline: `${full + half / 2} ${t('aiDaysLabel')}`,
        sub: `${full} ${t('attFull').toLowerCase()} · ${half} ${t('attHalf').toLowerCase()} · ${absent} ${t('attAbsent').toLowerCase()}${earned > 0 ? ` · ${t('earnedLabel')} ${money(earned)}` : ''}`,
        calendar: { month, days, full, half, absent },
        rows: [],
        speak: `${k.laborer.name}, ${monthName}: ${full} ${t('attFull')}, ${half} ${t('attHalf')}, ${absent} ${t('attAbsent')}${projects.length ? `. ${projects.join(', ')}` : ''}`,
        target: { screen: 'LaborerDetail', laborerId: worker.id },
      };
    }

    case 'party_history': {
      const party = pick(intent.party, w.parties);
      if (!party) return none(intent.party);
      const range = periodToRange(intent.period, w.today);
      const rows = (await liveTxns(range)).filter((x) => x.party_id === party.id);
      const paid = rows.filter((x) => x.direction === 'OUT').reduce((s, x) => s + x.amount, 0);
      const title = `${party.name} · ${periodLabel(intent.period)}`;
      return {
        title,
        headline: money(paid),
        sub: `${rows.length} ${t('transactions').toLowerCase()}`,
        rows: rows.slice(0, MAX_ROWS).map((x) => txnRow(x, w)),
        speak: `${title}: ${money(paid)}`,
        target: { screen: 'Cash' },
      };
    }

    case 'udhaar_balance': {
      const open = await listUdhaar('OPEN');
      const one = intent.person ? matchName(intent.person, open.map((u) => ({ id: u.id, name: u.person_name })))?.item : undefined;
      const list = one ? open.filter((u) => u.id === one.id) : open.filter((u) => u.balance > 0);
      if (list.length === 0) return none(t('udhaar'));
      const receivable = list.filter((u) => u.direction === 'GIVEN').reduce((s, u) => s + u.balance, 0);
      const payable = list.filter((u) => u.direction === 'TAKEN').reduce((s, u) => s + u.balance, 0);
      return {
        title: one ? one.name : t('udhaar'),
        headline: money(one ? list[0].balance : receivable),
        sub: one ? (list[0].direction === 'GIVEN' ? t('receivable') : t('payable')) : `${t('receivable')} ${money(receivable)} · ${t('payable')} ${money(payable)}`,
        rows: list.map((u) => ({ id: u.id, title: u.person_name, date: '', subtitle: u.direction === 'GIVEN' ? t('receivable') : t('payable'), amount: u.balance, direction: u.direction === 'GIVEN' ? ('in' as const) : ('out' as const) })),
        speak: one
          ? `${one.name}: ${list[0].direction === 'GIVEN' ? t('receivable') : t('payable')} ${money(list[0].balance)}`
          : `${t('udhaar')}: ${t('receivable')} ${money(receivable)}, ${t('payable')} ${money(payable)}`,
        target: one ? { screen: 'UdhaarDetail', udhaarId: one.id } : { screen: 'Udhaar' },
      };
    }

    case 'account_balance': {
      const accounts = await listAccountsWithBalance();
      const one = pick(intent.account, accounts);
      const list = one ? accounts.filter((a) => a.id === one.id) : accounts;
      const total = list.reduce((s, a) => s + a.balance, 0);
      return {
        title: one ? one.name : t('accountsTitle'),
        headline: money(total),
        sub: one ? undefined : `${list.length} ${t('accountsTitle').toLowerCase()} · ${t('totalBalance')}`,
        rows: list.map((a) => ({ id: a.id, title: a.name, date: '', subtitle: '', amount: a.balance, direction: 'in' as const })),
        speak: `${one ? one.name : t('totalBalance')}: ${money(total)}`,
        target: { screen: 'Accounts' },
      };
    }

    case 'plot_status': {
      const summaries = await listPlotSummaries();
      const one = pick(intent.plot, w.plots);
      const list = one ? summaries.filter((s) => s.plot.id === one.id) : summaries.filter((s) => s.plot.status !== 'SOLD');
      if (list.length === 0) return none(t('plotsTitle'));
      if (list.length === 1) {
        const s = list[0];
        return {
          title: s.plot.name,
          headline: money(s.totalCost),
          sub: `${t('aiCostLabel')} · ${t('remaining')} ${money(s.remaining)}`,
          rows: [
            { id: 'deal', title: t('agreedPrice'), date: '', subtitle: '', amount: s.dealPrice, direction: 'out' },
            { id: 'paid', title: t('seller'), date: '', subtitle: '', amount: s.paidToSeller, direction: 'out' },
            { id: 'exp', title: t('kharcha'), date: '', subtitle: '', amount: s.expenses, direction: 'out' },
            ...(s.salePrice > 0 ? [{ id: 'sale', title: t('aiReceivedLabel'), date: '', subtitle: '', amount: s.saleReceived, direction: 'in' as const }] : []),
          ],
          speak: `${s.plot.name}: ${t('aiCostLabel')} ${money(s.totalCost)}, ${t('remaining')} ${money(s.remaining)}`,
          target: { screen: 'PlotDetail', plotId: s.plot.id },
        };
      }
      const total = list.reduce((s, x) => s + x.totalCost, 0);
      return {
        title: t('plotsTitle'),
        headline: money(total),
        sub: `${list.length} · ${t('aiCostLabel')}`,
        rows: list.map((s) => ({ id: s.plot.id, title: s.plot.name, date: '', subtitle: `${t('remaining')} ${money(s.remaining)}`, amount: s.totalCost, direction: 'out' as const })),
        speak: `${list.length} ${t('plotsTitle')}: ${t('aiCostLabel')} ${money(total)}`,
        target: { screen: 'Plots' },
      };
    }

    case 'investor_status': {
      const one = pick(intent.investor, w.investors);
      if (one) {
        const s = await getInvestorSummary(one.id);
        if (!s) return none(one.name);
        return {
          title: s.investor.name,
          headline: money(s.total),
          sub: `${t('invested')} ${money(s.invested)} · ${t('netSoFar')} ${money(s.profit)}`,
          rows: [
            { id: 'inv', title: t('invested'), date: '', subtitle: '', amount: s.invested, direction: 'in' },
            { id: 'profit', title: t('netSoFar'), date: '', subtitle: '', amount: s.profit, direction: 'in' },
            { id: 'out', title: t('paidOut'), date: '', subtitle: '', amount: s.paidOut, direction: 'out' },
          ],
          speak: `${s.investor.name}: ${t('invested')} ${money(s.invested)}, ${t('netSoFar')} ${money(s.profit)}, ${t('totalLabel')} ${money(s.total)}`,
          target: { screen: 'InvestorProfile', investorId: one.id },
        };
      }
      const all = await listInvestorsWithCapital();
      const total = all.reduce((s, x) => s + x.total, 0);
      return {
        title: t('investors'),
        headline: money(total),
        sub: `${all.length}`,
        rows: all.map((x) => ({ id: x.id, title: x.name, date: '', subtitle: `${t('netSoFar')} ${money(x.profit)}`, amount: x.total, direction: 'in' as const })),
        speak: `${all.length} ${t('investors')}: ${money(total)}`,
        target: { screen: 'Investors' },
      };
    }

    case 'sale_status': {
      const project = pick(intent.project, w.projects) ?? (w.projects.length === 1 ? w.projects[0] : undefined);
      if (!project) return none(t('projects'));
      const s = await getSaleSummary(project.id);
      const agreed = s.sale?.agreed_price ?? 0;
      return {
        title: `${project.name} · ${t('aiSoldLabel')}`,
        headline: money(s.outstanding),
        sub: `${t('remaining')} · ${t('aiSoldLabel')} ${money(agreed)} · ${t('aiReceivedLabel')} ${money(s.receiptsTotal)}`,
        rows: s.receipts.filter((r) => !r.is_void).slice(0, MAX_ROWS).map((r) => ({ id: r.id, title: t('aiReceivedLabel'), date: r.date, amount: r.amount, direction: 'in' as const, typeLabel: r.pay_type ?? undefined })),
        speak: agreed > 0
          ? `${project.name}: ${t('aiSoldLabel')} ${money(agreed)}, ${t('aiReceivedLabel')} ${money(s.receiptsTotal)}, ${t('remaining')} ${money(s.outstanding)}`
          : `${project.name}: ${t('noResultsLabel')}`,
        target: { screen: 'SaleDetail', projectId: project.id },
      };
    }

    case 'purchase_orders': {
      const all = await listPurchaseOrders();
      const live = all.filter((p) => p.status !== 'CANCELLED');
      const deliveryOf = (p: (typeof live)[number]): 'delivered' | 'partial' | 'pending' =>
        p.fullyReceived ? 'delivered' : p.items.some((i) => i.qtyReceived > 0) ? 'partial' : 'pending';
      const filtered = live.filter((p) => {
        switch (intent.status) {
          case 'pending':
            return deliveryOf(p) !== 'delivered';
          case 'delivered':
            return deliveryOf(p) === 'delivered';
          case 'unpaid':
            return p.payRemaining >= 1;
          case 'open':
            return p.status === 'OPEN';
          case 'all':
            return true;
        }
      });
      if (filtered.length === 0) return none(t('bookingsTitle'));
      const delivered = filtered.filter((p) => deliveryOf(p) === 'delivered').length;
      const pending = filtered.length - delivered;
      const owed = filtered.reduce((s, p) => s + p.payRemaining, 0);
      // Pending first (what needs chasing), then partial, then delivered.
      const order = { pending: 0, partial: 1, delivered: 2 } as const;
      const sorted = [...filtered].sort((a, b) => order[deliveryOf(a)] - order[deliveryOf(b)] || b.payRemaining - a.payRemaining);
      const statusLabel = { delivered: t('poDelivered'), partial: t('poPartial'), pending: t('poPending') } as const;
      const statusTitle: Record<typeof intent.status, string> = {
        pending: t('poPending'),
        delivered: t('poDelivered'),
        unpaid: t('owedToSuppliers'),
        open: t('bookingsTitle'),
        all: t('bookingsTitle'),
      };
      return {
        title: `${statusTitle[intent.status]} · ${filtered.length}`,
        headline: owed > 0 ? money(owed) : undefined,
        sub: `${delivered} ${t('poDelivered').toLowerCase()} · ${pending} ${t('poPending').toLowerCase()}${owed > 0 ? ` · ${t('owedToSuppliers').toLowerCase()}` : ''}`,
        rows: sorted.slice(0, MAX_ROWS).map((p) => ({
          id: p.poId,
          title: [p.poNumber, p.supplierName].filter(Boolean).join(' · '),
          date: '',
          subtitle: `${statusLabel[deliveryOf(p)]}${p.projectName ? ` · ${p.projectName}` : ''}${p.payRemaining >= 1 ? ` · ${t('remaining')} ${money(p.payRemaining)}` : ` · ${t('poPaid')}`}`,
          amount: p.payRemaining >= 1 ? p.payRemaining : p.total,
          direction: 'out' as const,
        })),
        speak: `${filtered.length} ${t('bookingsTitle')}: ${delivered} ${t('poDelivered')}, ${pending} ${t('poPending')}${owed > 0 ? `. ${t('owedToSuppliers')} ${money(owed)}` : ''}`,
        target: { screen: 'Bookings' },
      };
    }

    case 'insights': {
      const list = await listInsights(w.today);
      const labels = insightLabels(t);
      return {
        title: t('suggestionsTitle'),
        headline: list.length ? String(list.length) : undefined,
        rows: list.map((i) => ({ id: i.id, title: describeInsight(i, labels, money), date: '', subtitle: '', amount: i.amount ?? 0, direction: 'out' as const })),
        speak: list.length ? list.slice(0, 3).map((i) => describeInsight(i, labels, money)).join('. ') : t('insightsAllGood'),
      };
    }

    case 'list_entities': {
      const e = intent.entity;
      let list: AnswerListItem[] = [];
      let title = '';
      let target: AnswerTarget | undefined;
      switch (e) {
        case 'projects': {
          const all = (await listProjectSummaries()).filter((s) =>
            intent.filter === 'active' ? s.project.status === 'ACTIVE' : intent.filter === 'completed' ? s.project.status === 'COMPLETED' : true
          );
          title = intent.filter === 'active' ? `${t('statusActive')} · ${t('projects')}` : intent.filter === 'completed' ? `${t('statusCompleted')} · ${t('projects')}` : t('projects');
          list = all.map((s) => ({ id: s.project.id, title: s.project.name, subtitle: s.project.status === 'ACTIVE' ? t('statusActive') : t('statusCompleted') }));
          target = all.length === 1 ? { screen: 'ProjectDetail', projectId: all[0].project.id } : undefined;
          break;
        }
        case 'plots': {
          const all = (await listPlotSummaries()).filter((s) =>
            intent.filter === 'sold' ? s.plot.status === 'SOLD' : intent.filter === 'owned' ? s.plot.status === 'OWNED' : true
          );
          title = intent.filter === 'sold' ? `${t('aiSoldLabel')} · ${t('plotsTitle')}` : intent.filter === 'owned' ? `${t('aiFreePlots')}` : t('plotsTitle');
          list = all.map((s) => ({ id: s.plot.id, title: s.plot.name, subtitle: s.projectName ?? (s.plot.status === 'SOLD' ? t('aiSoldLabel') : undefined) }));
          target = { screen: 'Plots' };
          break;
        }
        case 'workers': {
          const all = (await listLaborersWithTotals()).filter((x) => (intent.filter === 'owed' ? x.balance > 0 : true));
          title = intent.filter === 'owed' ? `${t('laborTitle')} · ${t('outstanding')}` : t('laborTitle');
          list = all.map((x) => ({ id: x.id, title: x.name, subtitle: intent.filter === 'owed' ? `${t('insightOwed')} ${money(x.balance)}` : `${x.projects} ${t('projects').toLowerCase()}` }));
          target = { screen: 'Labor' };
          break;
        }
        case 'suppliers':
          title = t('supplier');
          list = w.parties.map((p) => ({ id: p.id, title: p.name }));
          break;
        case 'investors':
          title = t('investors');
          list = w.investors.map((p) => ({ id: p.id, title: p.name }));
          target = { screen: 'Investors' };
          break;
        case 'accounts':
          title = t('accountsTitle');
          list = w.accounts.map((a) => ({ id: a.id, title: a.name }));
          target = { screen: 'Accounts' };
          break;
        case 'materials':
          title = t('material');
          list = w.categories.filter((c) => c.type === 'EXPENSE' && c.parentId).map((c) => ({ id: c.id, title: catLabel(c, w), subtitle: c.unit ?? undefined }));
          break;
      }
      if (list.length === 0) return none(title);
      return {
        title: `${title} · ${list.length}`,
        rows: [],
        list,
        speak: `${list.length} ${title}: ${list.slice(0, 5).map((i) => i.title).join(', ')}${list.length > 5 ? '…' : ''}`,
        target,
      };
    }

    case 'report': {
      if (intent.report === 'project') {
        const project = pick(intent.project, w.projects) ?? (w.projects.length === 1 ? w.projects[0] : undefined);
        if (!project) return none(t('projects'));
        return {
          title: `${project.name} · ${t('reports')}`,
          rows: [],
          speak: `${t('aiReportOpening')} · ${project.name}`,
          target: { screen: 'ProjectDetail', projectId: project.id },
          autoOpen: true,
        };
      }
      const label: Record<Exclude<typeof intent.report, 'project'>, TranslationKey> = {
        summary: 'rptSummary',
        pnl: 'rptPnl',
        cashflow: 'rptCashflow',
        expense: 'rptExpense',
        investment: 'rptInvestment',
        roi: 'rptRoi',
        accounts: 'accountsTitle',
      };
      return {
        title: `${t('reports')} · ${t(label[intent.report])}`,
        rows: [],
        speak: `${t('aiReportOpening')} · ${t(label[intent.report])}`,
        target: { screen: 'Report', type: intent.report },
        autoOpen: true,
      };
    }

    case 'expense_breakdown': {
      const project = pick(intent.project, w.projects);
      const range = periodToRange(intent.period, w.today);
      const txns = (await liveTxns(range)).filter((x) => x.direction === 'OUT' && (!project || x.project_id === project.id));
      if (txns.length === 0) return none(t('kharcha'));
      // Group by the category the user knows (a material rolls up to itself,
      // uncategorised rows land in "Other").
      const byCat = new Map<string, { label: string; value: number }>();
      for (const x of txns) {
        const cat = w.categories.find((c) => c.id === x.category_id);
        const key = cat?.id ?? '__other__';
        const cur = byCat.get(key) ?? { label: cat ? catLabel(cat, w) : t('aiChartOther'), value: 0 };
        cur.value += x.amount;
        byCat.set(key, cur);
      }
      const sorted = [...byCat.values()].sort((a, b) => b.value - a.value);
      const top = sorted.slice(0, 6);
      const rest = sorted.slice(6).reduce((s, x) => s + x.value, 0);
      if (rest > 0) top.push({ label: t('aiChartOther'), value: rest });
      const total = sorted.reduce((s, x) => s + x.value, 0);
      const title = `${t('kharcha')} · ${periodLabel(intent.period)}${project ? ` · ${project.name}` : ''}`;
      return {
        title,
        headline: money(total),
        sub: `${sorted.length} ${t('categories')} · ${txns.length} ${t('transactions').toLowerCase()}`,
        chart: { kind: 'bars', items: top },
        rows: top.map((x, i) => ({ id: `${i}`, title: x.label, date: '', subtitle: `${Math.round((x.value / total) * 100)}%`, amount: x.value, direction: 'out' as const })),
        speak: `${title}: ${money(total)}. ${sorted[0].label} ${money(sorted[0].value)}${sorted[1] ? `, ${sorted[1].label} ${money(sorted[1].value)}` : ''}.`,
        target: { screen: 'Report', type: 'expense' },
      };
    }

    case 'cashflow_chart': {
      const all = await getCashFlow();
      if (all.length === 0) return none(t('rptCashflow'));
      // A calendar window ending this month: quiet months show as zero
      // columns instead of vanishing (Aug missing between Jul and Sep).
      const byMonth = new Map(all.map((m) => [m.month, m]));
      const now = new Date();
      const months = Array.from({ length: intent.months }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (intent.months - 1 - i), 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return byMonth.get(ym) ?? { month: ym, inSum: 0, outSum: 0 };
      });
      const inSum = months.reduce((s, m) => s + m.inSum, 0);
      const outSum = months.reduce((s, m) => s + m.outSum, 0);
      // "Sep" alone is ambiguous when the window crosses a year boundary → "Sep 25".
      const years = new Set(months.map((m) => m.month.slice(0, 4)));
      const monthLabel = (ym: string) => `${formatDisplayDate(`${ym}-01`).slice(2, 6).trim()}${years.size > 1 ? ` ${ym.slice(2, 4)}` : ''}`;
      return {
        title: `${t('rptCashflow')} · ${months.length} ${t('monthsLabel')}`,
        headline: `${inSum - outSum < 0 ? '− ' : '+ '}${money(Math.abs(inSum - outSum))}`,
        sub: `${t('netFlow')} · ${t('moneyIn')} ${money(inSum)} · ${t('moneyOut')} ${money(outSum)}`,
        chart: { kind: 'columns', groups: months.map((m) => ({ label: monthLabel(m.month), values: [m.inSum, m.outSum] as [number, number] })), legend: [t('moneyIn'), t('moneyOut')] },
        rows: months
          .slice()
          .reverse()
          .map((m) => ({ id: m.month, title: monthLabel(m.month), date: '', subtitle: `${t('moneyIn')} ${money(m.inSum)} · ${t('moneyOut')} ${money(m.outSum)}`, amount: m.inSum - m.outSum, direction: m.inSum - m.outSum >= 0 ? ('in' as const) : ('out' as const) })),
        speak: `${t('rptCashflow')}: ${t('moneyIn')} ${money(inSum)}, ${t('moneyOut')} ${money(outSum)}, ${t('netFlow')} ${money(inSum - outSum)}`,
        target: { screen: 'Report', type: 'cashflow' },
      };
    }

    case 'company_overview': {
      const [assets, accounts, projects, plots, workers, udhaar] = await Promise.all([
        getCompanyAssets(),
        listAccountsWithBalance(),
        listProjectSummaries(),
        listPlotSummaries(),
        listLaborersWithTotals(),
        getUdhaarTotals(),
      ]);
      const active = projects.filter((p) => p.project.status === 'ACTIVE');
      const held = plots.filter((p) => p.plot.status !== 'SOLD');
      const owed = workers.reduce((s, x) => s + Math.max(0, x.balance), 0);
      const name = w.company?.name ?? t('companyTitle');
      const rows: AnswerRow[] = [
        { id: 'cash', title: t('totalBalance'), date: '', subtitle: `${accounts.length} ${t('accountsTitle').toLowerCase()}`, amount: assets.cash, direction: 'in' as const },
        { id: 'plots', title: t('assetPlots'), date: '', subtitle: `${held.length} ${t('plotsTitle').toLowerCase()}`, amount: assets.plotsValue, direction: 'out' as const },
        { id: 'con', title: t('assetConstruction'), date: '', subtitle: `${active.length} ${t('projects').toLowerCase()}`, amount: assets.constructionValue, direction: 'out' as const },
        { id: 'recv', title: t('receivable'), date: '', subtitle: t('udhaar'), amount: udhaar.receivable, direction: 'in' as const },
        { id: 'labor', title: t('laborTitle'), date: '', subtitle: t('outstanding'), amount: owed, direction: 'out' as const },
      ].filter((r) => r.amount > 0 || r.id === 'cash');
      return {
        title: `${name}${w.company?.owner ? ` · ${w.company.owner}` : ''}`,
        headline: money(assets.total),
        sub: `${t('totalAssets')} · ${active.length} ${t('projects').toLowerCase()} · ${held.length} ${t('plotsTitle').toLowerCase()} · ${workers.length} ${t('aiWorkersLabel')}`,
        rows,
        speak: `${name}: ${t('totalAssets')} ${money(assets.total)}. ${t('totalBalance')} ${money(assets.cash)}. ${active.length} ${t('projects')}, ${held.length} ${t('plotsTitle')}.${owed > 0 ? ` ${t('laborTitle')} ${t('outstanding')} ${money(owed)}.` : ''}${udhaar.receivable > 0 ? ` ${t('receivable')} ${money(udhaar.receivable)}.` : ''}`,
        target: { screen: 'Cash' },
      };
    }

    case 'recent_entries': {
      const range = periodToRange(intent.period, w.today);
      const rows = await liveTxns(range);
      return {
        title: `${t('transactions')} · ${periodLabel(intent.period)}`,
        headline: String(rows.length),
        rows: rows.slice(0, MAX_ROWS).map((x) => txnRow(x, w)),
        speak: `${rows.length} ${t('transactions').toLowerCase()} · ${periodLabel(intent.period)}`,
        target: { screen: 'Cash' },
      };
    }

    case 'top_suppliers': {
      const rows = await getTopSuppliers(8);
      if (rows.length === 0) return none(t('supplier'));
      return {
        title: t('supplier'),
        rows: rows.map((r, i) => ({ id: `${i}`, title: r.name, date: '', subtitle: '', amount: r.total, direction: 'out' as const })),
        speak: `${rows[0].name}: ${money(rows[0].total)}`,
        target: { screen: 'Reports' },
      };
    }

    case 'pnl': {
      const rows = await getPnl();
      const net = rows.reduce((s, r) => s + r.net, 0);
      return {
        title: t('netSoFar'),
        headline: money(net),
        rows: rows.map((r) => ({ id: r.id, title: r.name, date: '', subtitle: `${t('moneyIn')} ${money(r.revenue)} · ${t('moneyOut')} ${money(r.expenses)}`, amount: r.net, direction: r.net >= 0 ? ('in' as const) : ('out' as const) })),
        speak: `${t('netSoFar')}: ${money(net)}`,
        target: { screen: 'Reports' },
      };
    }
  }
}
