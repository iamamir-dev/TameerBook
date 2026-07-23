import { useCallback } from 'react';

import {
  getBookingSummary,
  getParty,
  getPurchaseOrder,
  listAccountsWithBalance,
  listBookingPayments,
  listDeliveries,
  listProjects,
  listPurchaseOrders,
  type AccountWithBalance,
  type BookingSummary,
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
 * One row of a purchase order's history. A delivery received AND paid in one
 * action is a single `both` entry (delivery + its linked payment); everything
 * else is a standalone `delivery` or `payment`.
 */
export interface PoHistoryEntry {
  key: string;
  kind: 'delivery' | 'payment' | 'both';
  date: string;
  createdAt: string;
  bookingId: string;
  itemName: string;
  delivery: PoDelivery | null;
  payment: PoPayment | null;
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

    // A delivery that carries a linked payment absorbs it into one `both` entry;
    // the rest stand alone.
    const linkedPayIds = new Set(deliveries.map((d) => d.payment_txn_id).filter(Boolean) as string[]);
    const payById = new Map(payments.map((p) => [p.id, p]));

    const entries: PoHistoryEntry[] = [];
    for (const d of deliveries) {
      const pay = d.payment_txn_id ? payById.get(d.payment_txn_id) ?? null : null;
      entries.push({
        key: d.id,
        kind: pay ? 'both' : 'delivery',
        date: d.date,
        createdAt: d.created_at,
        bookingId: d.booking_id,
        itemName: d.itemName,
        delivery: d,
        payment: pay,
      });
    }
    for (const p of payments) {
      if (linkedPayIds.has(p.id)) continue; // already shown as part of a `both`
      entries.push({
        key: p.id,
        kind: 'payment',
        date: p.date,
        createdAt: p.created_at,
        bookingId: p.booking_id!,
        itemName: p.itemName,
        delivery: null,
        payment: p,
      });
    }
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

export interface BookingDetailData {
  summary: BookingSummary | null;
  deliveries: MaterialDeliveryRow[];
  payments: TransactionRow[];
  accounts: AccountWithBalance[];
  /** All projects, for the cross-project delivery picker + name mapping. */
  projects: ProjectRow[];
  /** The saved supplier's phone (from the linked party), for a call button. */
  supplierPhone: string | null;
}

/** One booking's page data. */
export function useBookingDetail(bookingId: string) {
  const loader = useCallback(async (): Promise<BookingDetailData> => {
    const [summary, deliveries, payments, accounts, projects] = await Promise.all([
      getBookingSummary(bookingId),
      listDeliveries(bookingId),
      listBookingPayments(bookingId),
      listAccountsWithBalance(),
      listProjects(),
    ]);
    const supplierPhone = summary.booking.party_id
      ? (await getParty(summary.booking.party_id))?.phone ?? null
      : null;
    return { summary, deliveries, payments, accounts, projects, supplierPhone };
  }, [bookingId]);
  return useFocusData<BookingDetailData>(loader, {
    summary: null,
    deliveries: [],
    payments: [],
    accounts: [],
    projects: [],
    supplierPhone: null,
  });
}
