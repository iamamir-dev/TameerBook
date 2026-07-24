import { useCallback } from 'react';

import {
  getParty,
  getPurchaseOrder,
  listAccountsWithBalance,
  listBookingPayments,
  listDeliveries,
  listProjects,
  listPurchaseOrders,
  type AccountWithBalance,
  type MaterialDeliveryRow,
  type ProjectRow,
  type PurchaseOrderSummary,
  type TransactionRow,
} from '@/db';
import { useFocusData } from '@/hooks';

/** Purchase-orders home list (grouped by po_id, OPEN-first from the repo). */
export function usePurchaseOrders() {
  const loader = useCallback(async () => ({ items: await listPurchaseOrders() }), []);
  return useFocusData(loader, { items: [] as PurchaseOrderSummary[] });
}

/** A delivery / payment across the whole PO, tagged with its item name. */
export type PoDelivery = MaterialDeliveryRow & { itemName: string };
export type PoPayment = TransactionRow & { itemName: string };

/**
 * One row of a purchase order's history = everything recorded in ONE action
 * (batch). Receiving and/or paying several items at once collapses into a single
 * entry carrying all its deliveries + payments; a lone delivery/payment is a
 * batch of one.
 */
export interface PoHistoryEntry {
  key: string;
  kind: 'delivery' | 'payment' | 'both';
  date: string;
  createdAt: string;
  /** Distinct bookings touched by this batch. */
  bookingIds: string[];
  itemCount: number;
  /** The item name when the batch is a single item; null = show "N items". */
  itemName: string | null;
  deliveries: PoDelivery[];
  payments: PoPayment[];
  /** Σ of the batch's supplier payments. */
  totalPaid: number;
  batchId: string | null;
}

export interface PurchaseOrderDetailData {
  po: PurchaseOrderSummary | null;
  /** The saved supplier's phone (from the linked party), for a call button. */
  supplierPhone: string | null;
  accounts: AccountWithBalance[];
  projects: ProjectRow[];
  /** Unified delivery + payment history across the PO's items, newest first. */
  history: PoHistoryEntry[];
}

/** One purchase order's page data (items + a unified delivery/payment history). */
export function usePurchaseOrderDetail(poId: string) {
  const loader = useCallback(async (): Promise<PurchaseOrderDetailData> => {
    const [po, accounts, projects] = await Promise.all([getPurchaseOrder(poId), listAccountsWithBalance(), listProjects()]);
    const partyId = po.items[0]?.booking.party_id ?? null;
    const supplierPhone = partyId ? (await getParty(partyId))?.phone ?? null : null;

    const perItem = await Promise.all(
      po.items.map(async (it) => {
        const [dels, pays] = await Promise.all([listDeliveries(it.booking.id), listBookingPayments(it.booking.id)]);
        const name = it.booking.item_name;
        return {
          deliveries: dels.map((d) => ({ ...d, itemName: name })),
          payments: pays.map((p) => ({ ...p, itemName: name })),
        };
      })
    );
    const deliveries = perItem.flatMap((x) => x.deliveries);
    const payments = perItem.flatMap((x) => x.payments);

    // Group everything by its batch. A delivery groups by batch_id; a payment by
    // its batch_id — or, for legacy rows, by the delivery that links it via
    // payment_txn_id. Anything without a batch is its own group of one.
    const gkOfDelivery = (d: PoDelivery) => d.batch_id ?? `d:${d.id}`;
    const linkedGk = new Map<string, string>();
    for (const d of deliveries) if (d.payment_txn_id) linkedGk.set(d.payment_txn_id, gkOfDelivery(d));
    const gkOfPayment = (p: PoPayment) => linkedGk.get(p.id) ?? p.po_batch_id ?? `p:${p.id}`;

    const groups = new Map<string, { deliveries: PoDelivery[]; payments: PoPayment[] }>();
    const bucket = (k: string) => {
      let g = groups.get(k);
      if (!g) groups.set(k, (g = { deliveries: [], payments: [] }));
      return g;
    };
    for (const d of deliveries) bucket(gkOfDelivery(d)).deliveries.push(d);
    for (const p of payments) bucket(gkOfPayment(p)).payments.push(p);

    const entries: PoHistoryEntry[] = [...groups.entries()].map(([key, g]) => {
      const all = [...g.deliveries, ...g.payments];
      const bookingIds = [...new Set([...g.deliveries.map((d) => d.booking_id), ...g.payments.map((p) => p.booking_id!)])];
      const names = [...new Set(all.map((x) => x.itemName))];
      const kind = g.deliveries.length && g.payments.length ? 'both' : g.deliveries.length ? 'delivery' : 'payment';
      return {
        key,
        kind,
        date: all[0]?.date ?? '',
        createdAt: all[0]?.created_at ?? '',
        bookingIds,
        itemCount: bookingIds.length,
        itemName: names.length === 1 ? names[0] : null,
        deliveries: g.deliveries,
        payments: g.payments,
        totalPaid: g.payments.reduce((s, p) => s + p.amount, 0),
        batchId: g.deliveries[0]?.batch_id ?? g.payments[0]?.po_batch_id ?? null,
      };
    });
    const history = entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

    return { po, supplierPhone, accounts, projects, history };
  }, [poId]);
  return useFocusData<PurchaseOrderDetailData>(loader, {
    po: null,
    supplierPhone: null,
    accounts: [],
    projects: [],
    history: [],
  });
}
