import dayjs from 'dayjs';

import { formatQty, formatRupees } from '@/utils/money';
import type { ReportCell, ReportBlock, ReportDoc } from '@/utils/reportHtml';

export interface PurchaseOrderLine {
  date: string;
  projectName: string | null;
  qty: number;
}
export interface PurchaseOrderPayment {
  date: string;
  amount: number;
  note: string | null;
}

export interface PurchaseOrderInput {
  company: { name: string; ownerName?: string | null; phone?: string | null };
  itemName: string;
  unit: string | null;
  qty: number;
  rate: number;
  total: number;
  received: number;
  paid: number;
  payRemaining: number;
  supplierName: string | null;
  projectName: string | null;
  statusLabel: string;
  deliveries: PurchaseOrderLine[];
  payments: PurchaseOrderPayment[];
  dateText: string;
  L: {
    purchaseOrder: string;
    supplier: string;
    project: string;
    total: string;
    paid: string;
    toPay: string;
    item: string;
    qty: string;
    rate: string;
    received: string;
    deliveries: string;
    payments: string;
    date: string;
    note: string;
    amount: string;
    madeWith: string;
  };
}

/**
 * A material Purchase Order as a branded `ReportDoc` (house report engine): the
 * order line (item / qty / rate / total), what's been received and paid, and the
 * delivery + payment history — a record the builder can hand to the supplier.
 */
export function purchaseOrderDoc(input: PurchaseOrderInput): ReportDoc {
  const { L } = input;
  const unit = input.unit ? ` ${input.unit}` : '';

  const blocks: ReportBlock[] = [
    {
      kind: 'stats',
      items: [
        { label: L.total, value: formatRupees(input.total), tone: 'accent' },
        { label: L.paid, value: formatRupees(input.paid), tone: 'accent' },
        { label: L.toPay, value: formatRupees(input.payRemaining), filled: input.payRemaining > 0 ? 'danger' : 'accent' },
      ],
    },
    {
      kind: 'table',
      title: L.item,
      columns: [
        { label: L.item },
        { label: L.qty, align: 'num' },
        { label: L.received, align: 'num' },
        { label: L.rate, align: 'num' },
        { label: L.total, align: 'num', highlight: true },
      ],
      rows: [
        [
          { text: input.itemName },
          { text: `${formatQty(input.qty)}${unit}` },
          { text: `${formatQty(input.received)}${unit}`, tone: input.received >= input.qty - 0.001 ? 'green' : undefined },
          { text: formatRupees(input.rate) },
          { text: formatRupees(input.total) },
        ],
      ],
    },
  ];

  if (input.deliveries.length > 0) {
    blocks.push({
      kind: 'table',
      title: L.deliveries,
      columns: [{ label: L.date }, { label: L.project }, { label: L.qty, align: 'num', highlight: true }],
      rows: input.deliveries.map((d): ReportCell[] => [
        { text: dayjs(d.date).format('DD MMM YYYY') },
        { text: d.projectName ?? '' },
        { text: `${formatQty(d.qty)}${unit}`, tone: 'green' },
      ]),
    });
  }

  if (input.payments.length > 0) {
    blocks.push({
      kind: 'table',
      title: L.payments,
      columns: [{ label: L.date }, { label: L.note }, { label: L.amount, align: 'num', highlight: true }],
      rows: input.payments.map((p): ReportCell[] => [
        { text: dayjs(p.date).format('DD MMM YYYY') },
        { text: p.note ?? '' },
        { text: formatRupees(p.amount), tone: 'red' },
      ]),
    });
  }

  return {
    company: { name: input.company.name, ownerName: input.company.ownerName, phone: input.company.phone },
    title: L.purchaseOrder,
    subject: input.itemName,
    sublines: [
      input.supplierName ? `${L.supplier}: ${input.supplierName}` : null,
      input.projectName ? `${L.project}: ${input.projectName}` : null,
    ],
    statusChip: input.statusLabel,
    dateText: input.dateText,
    madeWith: L.madeWith,
    blocks,
  };
}
