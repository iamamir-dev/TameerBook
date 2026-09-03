import { describe, expect, it } from 'vitest';

import {
  daysBetween,
  describeInsight,
  isRateOutlier,
  median,
  rankInsights,
  severityFor,
  type Insight,
  type InsightLabels,
} from './insights';

const labels: InsightLabels = {
  owed: 'owed',
  days: 'days',
  daysLeft: 'days left',
  overdue: 'overdue',
  duplicate: 'Possible duplicate',
  usual: 'usual',
  deadlineSoon: 'Transfer due',
  buyerOwes: 'buyer owes',
  loanUnpaid: 'not repaid for',
  poUndelivered: 'not delivered for',
  spendUp: 'spending up',
};
const money = (n: number) => `Rs ${n}`;

describe('severityFor', () => {
  it('escalates worker debt by age', () => {
    expect(severityFor('workerOwed', 10)).toBe('warning');
    expect(severityFor('workerOwed', 60)).toBe('critical');
  });
  it('escalates deadlines as they approach or pass', () => {
    expect(severityFor('transferDeadline', 7)).toBe('warning');
    expect(severityFor('transferDeadline', 2)).toBe('critical');
    expect(severityFor('transferDeadline', -1)).toBe('critical');
  });
  it('keeps informational kinds informational', () => {
    expect(severityFor('spendSpike')).toBe('info');
    expect(severityFor('poUndelivered')).toBe('info');
  });
});

describe('rankInsights', () => {
  const base = (id: string, severity: Insight['severity'], amount: number): Insight => ({
    id,
    kind: 'workerOwed',
    severity,
    subject: id,
    amount,
    target: { screen: 'Cash' },
  });
  it('orders by severity then by amount desc', () => {
    const out = rankInsights([base('a', 'info', 900), base('b', 'critical', 10), base('c', 'warning', 500), base('d', 'warning', 700)]);
    expect(out.map((i) => i.id)).toEqual(['b', 'd', 'c', 'a']);
  });
  it('does not mutate the input', () => {
    const input = [base('a', 'info', 1), base('b', 'critical', 1)];
    rankInsights(input);
    expect(input[0].id).toBe('a');
  });
});

describe('daysBetween / median', () => {
  it('counts whole days across month boundaries', () => {
    expect(daysBetween('2026-08-30', '2026-09-03')).toBe(4);
    expect(daysBetween('2026-09-03', '2026-08-30')).toBe(-4);
  });
  it('median handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('isRateOutlier', () => {
  it('needs enough history before judging', () => {
    expect(isRateOutlier(2000, [1200, 1250]).outlier).toBe(false);
  });
  it('flags a rate far from the usual', () => {
    const r = isRateOutlier(2000, [1200, 1250, 1180, 1220]);
    expect(r.outlier).toBe(true);
    expect(r.usual).toBe(1210);
  });
  it('accepts a rate near the usual', () => {
    expect(isRateOutlier(1300, [1200, 1250, 1180]).outlier).toBe(false);
  });
});

describe('describeInsight', () => {
  it('renders each kind as one sentence', () => {
    const cases: [Insight, string][] = [
      [
        { id: '1', kind: 'workerOwed', severity: 'warning', subject: 'Akram', amount: 12000, days: 31, target: { screen: 'Cash' } },
        'Akram · owed Rs 12000 · 31 days',
      ],
      [
        { id: '2', kind: 'duplicateEntry', severity: 'warning', subject: 'Cement', amount: 5000, target: { screen: 'Cash' } },
        'Possible duplicate: Cement Rs 5000',
      ],
      [
        { id: '3', kind: 'rateOutlier', severity: 'warning', subject: 'Cement', amount: 2000, reference: 1200, target: { screen: 'Cash' } },
        'Cement Rs 2000 · usual Rs 1200',
      ],
      [
        { id: '4', kind: 'transferDeadline', severity: 'critical', subject: 'Plot 14', days: -1, target: { screen: 'Cash' } },
        'Transfer due: Plot 14 · overdue',
      ],
      [
        { id: '5', kind: 'transferDeadline', severity: 'warning', subject: 'Plot 14', days: 5, target: { screen: 'Cash' } },
        'Transfer due: Plot 14 · 5 days left',
      ],
      [
        { id: '6', kind: 'spendSpike', severity: 'info', subject: 'Gulberg', amount: 300000, reference: 200000, target: { screen: 'Cash' } },
        'Gulberg · spending up +50%',
      ],
    ];
    for (const [insight, text] of cases) expect(describeInsight(insight, labels, money)).toBe(text);
  });
});
