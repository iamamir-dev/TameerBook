/**
 * Insights — the assistant's PROACTIVE suggestions, computed offline from the
 * ledger (no model involved). This module is PURE: it types the insight shape,
 * derives severity, ranks, and renders each one into a plain sentence from
 * caller-supplied labels, so it is unit-tested with vitest. The SQL that
 * produces the raw facts lives in `src/db/repositories/insights.ts`.
 */

export type InsightKind =
  | 'workerOwed'
  | 'duplicateEntry'
  | 'rateOutlier'
  | 'transferDeadline'
  | 'buyerOutstanding'
  | 'staleUdhaar'
  | 'poUndelivered'
  | 'spendSpike';

export type InsightSeverity = 'critical' | 'warning' | 'info';

/** Where tapping the insight takes the user. */
export type InsightTarget =
  | { screen: 'LaborerDetail'; laborerId: string }
  | { screen: 'Cash' }
  | { screen: 'PlotDetail'; plotId: string }
  | { screen: 'SaleDetail'; projectId: string }
  | { screen: 'UdhaarDetail'; udhaarId: string }
  | { screen: 'PurchaseOrderDetail'; poId: string }
  | { screen: 'ConstructionDetail'; projectId: string };

export interface Insight {
  /** Stable key (`kind:entityId`) so lists can diff and the user can dismiss. */
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  /** The person / thing the sentence is about (worker, plot, category…). */
  subject: string;
  /** Main rupee figure (owed / outstanding / latest rate). */
  amount?: number;
  /** Days involved: age of the debt, or days left to a deadline (negative = overdue). */
  days?: number;
  /** Comparison figure (usual rate / last month spend). */
  reference?: number;
  target: InsightTarget;
}

/** Thresholds, in one place so the rules read like policy. */
export const INSIGHT_RULES = {
  workerOwedWarnDays: 30,
  workerOwedCriticalDays: 60,
  /** |latest − median| / median above this flags a material rate. */
  rateOutlierRatio: 0.5,
  /** Need this many earlier purchases before judging a rate. */
  rateOutlierMinSamples: 3,
  deadlineWarnDays: 7,
  deadlineCriticalDays: 2,
  buyerQuietDays: 30,
  udhaarStaleDays: 60,
  poUndeliveredDays: 14,
  /** This month-to-date ≥ ratio × last month-to-same-day → spike. */
  spendSpikeRatio: 1.5,
  /** Ignore spikes on tiny amounts. */
  spendSpikeFloor: 10_000,
} as const;

const SEVERITY_RANK: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** Severity from the kind + its numbers, applying `INSIGHT_RULES`. */
export function severityFor(kind: InsightKind, days?: number): InsightSeverity {
  switch (kind) {
    case 'workerOwed':
      return (days ?? 0) >= INSIGHT_RULES.workerOwedCriticalDays ? 'critical' : 'warning';
    case 'transferDeadline':
      return (days ?? 0) <= INSIGHT_RULES.deadlineCriticalDays ? 'critical' : 'warning';
    case 'duplicateEntry':
    case 'rateOutlier':
    case 'buyerOutstanding':
    case 'staleUdhaar':
      return 'warning';
    case 'poUndelivered':
    case 'spendSpike':
      return 'info';
  }
}

/** Most urgent first; within a severity the bigger rupee figure wins. */
export function rankInsights(list: readonly Insight[]): Insight[] {
  return [...list].sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s !== 0) return s;
    return (b.amount ?? 0) - (a.amount ?? 0);
  });
}

/** Whole days from `fromIso` to `toIso` (both YYYY-MM-DD); negative when `to` is earlier. */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** Median of a non-empty numeric list. */
export function median(values: readonly number[]): number {
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Is `latest` an outlier against `earlier` rates? Needs at least
 * `rateOutlierMinSamples` earlier points; compares to their median.
 */
export function isRateOutlier(latest: number, earlier: readonly number[]): { outlier: boolean; usual: number } {
  if (earlier.length < INSIGHT_RULES.rateOutlierMinSamples) return { outlier: false, usual: 0 };
  const usual = median(earlier);
  if (usual <= 0) return { outlier: false, usual };
  return { outlier: Math.abs(latest - usual) / usual > INSIGHT_RULES.rateOutlierRatio, usual };
}

/** The translated fragments an insight sentence is assembled from. */
export interface InsightLabels {
  owed: string;
  days: string;
  daysLeft: string;
  overdue: string;
  duplicate: string;
  usual: string;
  deadlineSoon: string;
  buyerOwes: string;
  loanUnpaid: string;
  poUndelivered: string;
  spendUp: string;
}

/**
 * One plain sentence per insight — short fragments joined by " · " so the
 * same template reads naturally in English and Urdu. `money` formats rupees.
 */
export function describeInsight(i: Insight, l: InsightLabels, money: (n: number) => string): string {
  switch (i.kind) {
    case 'workerOwed':
      return `${i.subject} · ${l.owed} ${money(i.amount ?? 0)} · ${i.days ?? 0} ${l.days}`;
    case 'duplicateEntry':
      return `${l.duplicate}: ${i.subject} ${money(i.amount ?? 0)}`;
    case 'rateOutlier':
      return `${i.subject} ${money(i.amount ?? 0)} · ${l.usual} ${money(i.reference ?? 0)}`;
    case 'transferDeadline':
      return (i.days ?? 0) < 0
        ? `${l.deadlineSoon}: ${i.subject} · ${l.overdue}`
        : `${l.deadlineSoon}: ${i.subject} · ${i.days ?? 0} ${l.daysLeft}`;
    case 'buyerOutstanding':
      return `${i.subject} · ${l.buyerOwes} ${money(i.amount ?? 0)} · ${i.days ?? 0} ${l.days}`;
    case 'staleUdhaar':
      return `${i.subject} · ${money(i.amount ?? 0)} · ${l.loanUnpaid} ${i.days ?? 0} ${l.days}`;
    case 'poUndelivered':
      return `${i.subject} · ${l.poUndelivered} ${i.days ?? 0} ${l.days}`;
    case 'spendSpike': {
      const ref = i.reference ?? 0;
      const pct = ref > 0 ? Math.round((((i.amount ?? 0) - ref) / ref) * 100) : 0;
      return `${i.subject} · ${l.spendUp} +${pct}%`;
    }
  }
}
