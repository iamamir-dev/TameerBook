import dayjs from 'dayjs';

import type { AttendanceStatus, LaborerKhataEntry } from '@/db';
import { formatRupees } from '@/utils/money';
import type { ReportCell, ReportDoc, ReportStat } from '@/utils/reportHtml';

export interface LaborKhataInput {
  company: { name: string; ownerName?: string | null; phone?: string | null };
  workerName: string;
  earned: number;
  taken: number;
  balance: number;
  history: LaborerKhataEntry[];
  dateText: string;
  /** Localized labels (caller passes t(...) results, incl. attendance labels). */
  L: {
    khataStatement: string;
    earned: string;
    taken: string;
    balance: string;
    date: string;
    type: string;
    projects: string;
    amount: string;
    madeWith: string;
    payment: string;
    attendance: Record<AttendanceStatus, string>;
  };
}

/**
 * Describe a worker's khata as a branded `ReportDoc` — reuses the house report
 * engine (reportHtml.ts + reportPdf.ts), matching the investor statement and
 * every other TameerBook PDF.
 */
export function laborKhataDoc(input: LaborKhataInput): ReportDoc {
  const { company, workerName, earned, taken, balance, history, L } = input;

  const stats: ReportStat[] = [
    { label: L.earned, value: formatRupees(earned), tone: 'accent' },
    { label: L.taken, value: formatRupees(taken), tone: 'danger' },
    { label: L.balance, value: formatRupees(balance), filled: 'accent' },
  ];

  return {
    company: { name: company.name, ownerName: company.ownerName, phone: company.phone },
    title: L.khataStatement,
    subject: workerName,
    dateText: input.dateText,
    madeWith: L.madeWith,
    blocks: [
      { kind: 'stats', items: stats },
      {
        kind: 'table',
        columns: [
          { label: L.date },
          { label: L.type },
          { label: L.projects },
          { label: L.amount, align: 'num', highlight: true },
        ],
        rows: history.map((e): ReportCell[] => {
          const absent = e.attendanceStatus === 'ABSENT';
          const typeText = e.kind === 'PAYMENT' ? L.payment : L.attendance[e.attendanceStatus ?? 'FULL'];
          return [
            { text: dayjs(e.date).format('DD MMM YYYY') },
            { text: typeText },
            { text: e.projectName },
            {
              text: absent ? '—' : formatRupees(e.amount),
              tone: absent ? undefined : e.kind === 'PAYMENT' ? 'red' : 'green',
            },
          ];
        }),
      },
    ],
  };
}
