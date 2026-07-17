/**
 * Settlement report — a `ReportDoc` for the house report engine
 * (reportHtml.ts + reportPdf.ts). This module only DESCRIBES the document
 * (stats, ownership table, distribution table, notes, signatures); all
 * branding, layout and printing are shared with every other report type.
 */
import type { Settlement } from '@/db';
import type { FontKey } from '@/theme/theme';

import { createReportPdf } from './reportPdf';
import type { ReportCell, ReportDoc } from './reportHtml';

export interface SettlementReportInput {
  company: { name: string; ownerName?: string | null; phone?: string | null; logoUri?: string | null };
  projectName: string;
  settlement: Settlement;
  /** The plot's address (society · block · plot no · size), if any. */
  plotAddress?: string | null;
  /** "start — end · N days" line under the title (null = unknown start). */
  periodText?: string | null;
  ruleLabel: string;
  ownerLabel: string;
  payoutAccountName?: string | null;
  fontKey: FontKey;
  /** Localized strings (already translated). */
  L: {
    reportTitle: string;
    revenue: string;
    expenses: string;
    netProfit: string;
    netLoss: string;
    ownership: string;
    invested: string;
    capitalBack: string;
    profitShare: string;
    charity: string;
    getsBack: string;
    total: string;
    paidFrom: string;
    madeWith: string;
    settled: string;
    signatures: string;
  };
}

const rup = (n: number) => `Rs ${Math.round(n).toLocaleString('en-IN')}`;

/** Describe the settlement as a branded report document. */
export function settlementReportDoc(input: SettlementReportInput): ReportDoc {
  const { company, projectName, settlement: s, ruleLabel, ownerLabel, L } = input;
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const investors = s.rows.filter((r) => !r.isOwner);
  const owner = s.rows.find((r) => r.isOwner);
  const name = (r: { isOwner: boolean; name: string }) => (r.isOwner ? ownerLabel : r.name);

  const notes: { label: string; value: string }[] = [];
  if (input.payoutAccountName) notes.push({ label: L.paidFrom, value: input.payoutAccountName });
  if (owner && s.isProfit) {
    notes.push({ label: ownerLabel, value: rup(owner.capital + owner.profitOrLoss - owner.donation) });
  }

  return {
    company: { name: company.name, ownerName: company.ownerName, phone: company.phone },
    title: L.reportTitle,
    subject: projectName,
    sublines: [input.plotAddress, input.periodText],
    statusChip: L.settled,
    dateText: date,
    madeWith: L.madeWith,
    blocks: [
      {
        kind: 'stats',
        items: [
          { label: L.revenue, value: rup(s.revenue), tone: 'accent' },
          { label: L.expenses, value: rup(s.expenses), tone: 'danger' },
          {
            label: s.isProfit ? L.netProfit : L.netLoss,
            value: rup(Math.abs(s.net)),
            filled: s.isProfit ? 'accent' : 'danger',
          },
        ],
      },
      {
        kind: 'table',
        title: L.ownership,
        columns: [{ label: '' }, { label: L.invested, align: 'num' }, { label: '%', align: 'num' }],
        rows: s.rows.map((r): ReportCell[] => [
          { text: name(r), tone: 'strong' },
          { text: rup(r.capital) },
          { text: `${r.ownershipPct.toFixed(1)}%` },
        ]),
      },
      {
        kind: 'table',
        title: ruleLabel,
        columns: [
          { label: '' },
          { label: L.capitalBack, align: 'num' },
          { label: L.profitShare, align: 'num' },
          { label: L.charity, align: 'num' },
          { label: L.getsBack, align: 'num', highlight: true },
        ],
        rows: s.rows.map((r): ReportCell[] => [
          { text: name(r), tone: 'strong', tag: `${Math.round(r.ownershipPct)}%` },
          { text: rup(r.capital) },
          { text: rup(Math.abs(r.profitOrLoss)), tone: s.isProfit ? 'green' : 'red' },
          { text: r.donation > 0 ? rup(r.donation) : '—', tone: 'gold' },
          { text: r.isOwner ? '—' : rup(r.finalPayout), tone: 'strong' },
        ]),
        totals: [
          { text: L.total },
          { text: rup(s.rows.reduce((a, r) => a + r.capital, 0)) },
          { text: rup(Math.abs(s.net)) },
          { text: rup(s.totalDonation), tone: 'gold' },
          { text: rup(investors.reduce((a, r) => a + r.finalPayout, 0)) },
        ],
      },
      { kind: 'notes', lines: notes },
      { kind: 'signatures', title: L.signatures, names: s.rows.map(name) },
    ],
  };
}

/** Render the settlement report to a PDF; returns its uri (+ html preview). */
export async function createSettlementPdf(input: SettlementReportInput): Promise<{ uri: string; html: string }> {
  return createReportPdf(settlementReportDoc(input), input.fontKey, input.company.logoUri);
}
