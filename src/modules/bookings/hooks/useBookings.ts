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

export interface PurchaseOrderDetailData {
  po: PurchaseOrderSummary | null;
  /** The saved supplier's phone (from the linked party), for a call button. */
  supplierPhone: string | null;
}

/** One purchase order's page data (its item bookings + supplier phone). */
export function usePurchaseOrderDetail(poId: string) {
  const loader = useCallback(async (): Promise<PurchaseOrderDetailData> => {
    const po = await getPurchaseOrder(poId);
    const partyId = po.items[0]?.booking.party_id ?? null;
    const supplierPhone = partyId ? (await getParty(partyId))?.phone ?? null : null;
    return { po, supplierPhone };
  }, [poId]);
  return useFocusData<PurchaseOrderDetailData>(loader, { po: null, supplierPhone: null });
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
