import dayjs from 'dayjs';

import { formatRupees } from '@/utils/money';
import type { ReportDoc } from '@/utils/reportHtml';

export interface ExitReceiptInput {
  company: { name: string; ownerName?: string | null; phone?: string | null };
  projectName: string;
  investorName: string;
  buyerName: string;
  amount: number;
  L: {
    title: string;
    who: string;
    buyer: string;
    value: string;
    note: string;
    signatures: string;
    madeWith: string;
  };
}

/**
 * Describe the investor-exit receipt as a branded `ReportDoc` — reuses the house
 * report engine instead of the old hand-rolled HTML (exporter.exitReceiptHtml).
 */
export function exitReceiptDoc(input: ExitReceiptInput): ReportDoc {
  const { company, projectName, investorName, buyerName, amount, L } = input;
  return {
    company: { name: company.name, ownerName: company.ownerName, phone: company.phone },
    title: L.title,
    subject: projectName,
    sublines: [L.note],
    dateText: dayjs().format('DD MMM YYYY'),
    madeWith: L.madeWith,
    blocks: [
      { kind: 'stats', items: [{ label: L.value, value: formatRupees(amount), filled: 'accent' }] },
      {
        kind: 'notes',
        lines: [
          { label: L.who, value: investorName },
          { label: L.buyer, value: buyerName },
        ],
      },
      { kind: 'signatures', title: L.signatures, names: [investorName, buyerName] },
    ],
  };
}
