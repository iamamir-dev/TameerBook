import dayjs from 'dayjs';

import { formatRupees } from '@/utils/money';
import type { ReportCell, ReportDoc, ReportStat } from '@/utils/reportHtml';

export interface InvestorStatementRow {
  date: string;
  label: string;
  project: string;
  amount: number;
  direction: 'in' | 'out';
}

export interface InvestorStatementInput {
  company: { name: string; ownerName?: string | null; phone?: string | null };
  investorName: string;
  invested: number;
  profit: number;
  total: number;
  rows: InvestorStatementRow[];
  dateText: string;
  L: {
    statement: string;
    totalInvested: string;
    profitEarned: string;
    total: string;
    date: string;
    category: string;
    projects: string;
    amount: string;
    madeWith: string;
  };
}

/**
 * Describe an investor statement as a branded `ReportDoc` — reuses the house
 * report engine (reportHtml.ts + reportPdf.ts) instead of hand-rolled HTML, so
 * it matches every other TameerBook PDF.
 */
export function investorStatementDoc(input: InvestorStatementInput): ReportDoc {
  const { company, investorName, invested, profit, total, rows, L } = input;

  const stats: ReportStat[] = [
    { label: L.totalInvested, value: formatRupees(invested), tone: 'accent' },
    ...(profit !== 0
      ? [{ label: L.profitEarned, value: formatRupees(profit), tone: profit >= 0 ? 'accent' : 'danger' } as ReportStat]
      : []),
    { label: L.total, value: formatRupees(total), filled: 'accent' },
  ];

  return {
    company: { name: company.name, ownerName: company.ownerName, phone: company.phone },
    title: L.statement,
    subject: investorName,
    dateText: input.dateText,
    madeWith: L.madeWith,
    blocks: [
      { kind: 'stats', items: stats },
      {
        kind: 'table',
        columns: [
          { label: L.date },
          { label: L.category },
          { label: L.projects },
          { label: L.amount, align: 'num', highlight: true },
        ],
        rows: rows.map(
          (r): ReportCell[] => [
            { text: dayjs(r.date).format('DD MMM YYYY') },
            { text: r.label },
            { text: r.project },
            { text: formatRupees(r.amount), tone: r.direction === 'in' ? 'green' : 'red' },
          ]
        ),
      },
    ],
  };
}
