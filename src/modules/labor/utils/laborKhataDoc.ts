import dayjs from 'dayjs';

import type { AttendanceStatus, LaborerKhataEntry } from '@/db';
import { formatRupees } from '@/utils/money';
import type { ReportBlock, ReportCell, ReportDoc, ReportStat } from '@/utils/reportHtml';

/** One project the worker took part in, with its own totals and entries. */
export interface LaborKhataProject {
  name: string;
  dailyWage: number;
  daysFull: number;
  daysHalf: number;
  daysAbsent: number;
  earned: number;
  taken: number;
  balance: number;
  /** This project's attendance + payment rows, newest first. */
  entries: LaborerKhataEntry[];
}

export interface LaborKhataInput {
  company: { name: string; ownerName?: string | null; phone?: string | null };
  workerName: string;
  /** Overall totals across every project. */
  earned: number;
  taken: number;
  balance: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  /** Per-project breakdown (active first). */
  projects: LaborKhataProject[];
  dateText: string;
  /** Localized labels (caller passes t(...) results, incl. attendance labels). */
  L: {
    khataStatement: string;
    earned: string;
    taken: string;
    balance: string;
    date: string;
    type: string;
    amount: string;
    note: string;
    dailyWage: string;
    present: string;
    absent: string;
    day: string;
    days: string;
    madeWith: string;
    payment: string;
    attendance: Record<AttendanceStatus, string>;
  };
}

/**
 * Describe a worker's khata as a branded `ReportDoc`, laid out PER PROJECT so a
 * worker can read exactly what they earned, were paid, and are owed on each job
 * — each with its own heading, a summary (daily wage, present/absent days,
 * earned/taken/balance) and a dated table of every day and payment, notes and
 * all. Reuses the house report engine (reportHtml.ts + reportPdf.ts).
 */
export function laborKhataDoc(input: LaborKhataInput): ReportDoc {
  const { company, workerName, earned, taken, balance, projects, L } = input;

  const overall: ReportStat[] = [
    { label: L.earned, value: formatRupees(earned), tone: 'accent' },
    { label: L.taken, value: formatRupees(taken), tone: 'danger' },
    { label: L.balance, value: formatRupees(balance), filled: 'accent' },
  ];

  const daysText = (n: number) => `${n} ${n === 1 ? L.day : L.days}`;

  const blocks: ReportBlock[] = [{ kind: 'stats', items: overall }];

  // One section per project: heading (name + daily wage on the right), the dated
  // rows with notes, then this project's earned/taken/balance at the bottom.
  projects.forEach((p, i) => {
    if (i > 0) blocks.push({ kind: 'divider' });
    blocks.push({
      kind: 'table',
      title: p.name,
      titleRight: `${L.dailyWage}: ${formatRupees(p.dailyWage)}  |  ${L.present}: ${daysText(p.daysFull + p.daysHalf)}  |  ${L.absent}: ${daysText(p.daysAbsent)}`,
      columns: [
        { label: L.date },
        { label: L.type },
        { label: L.note },
        { label: L.amount, align: 'num', highlight: true },
      ],
      rows: p.entries.map((e): ReportCell[] => {
        const absent = e.attendanceStatus === 'ABSENT';
        const typeText = e.kind === 'PAYMENT' ? L.payment : L.attendance[e.attendanceStatus ?? 'FULL'];
        return [
          { text: dayjs(e.date).format('DD MMM YYYY') },
          { text: typeText },
          { text: e.note ?? '' },
          {
            text: absent ? '—' : formatRupees(e.amount),
            tone: absent ? undefined : e.kind === 'PAYMENT' ? 'red' : 'green',
          },
        ];
      }),
      summary: [
        { label: L.earned, value: formatRupees(p.earned), tone: 'green' },
        { label: L.taken, value: formatRupees(p.taken), tone: 'red' },
        { label: L.balance, value: formatRupees(p.balance) },
      ],
    });
  });

  return {
    company: { name: company.name, ownerName: company.ownerName, phone: company.phone },
    title: L.khataStatement,
    subject: workerName,
    // Present / absent days shown right under the worker's name.
    sublines: [`${L.present}: ${daysText(input.totalPresentDays)}  |  ${L.absent}: ${daysText(input.totalAbsentDays)}`],
    dateText: input.dateText,
    madeWith: L.madeWith,
    blocks,
  };
}
