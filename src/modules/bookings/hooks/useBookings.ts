import { useCallback } from 'react';

import {
  getBookingSummary,
  getParty,
  listAccountsWithBalance,
  listBookingPayments,
  listBookingSummaries,
  listDeliveries,
  listProjects,
  type AccountWithBalance,
  type BookingSummary,
  type MaterialDeliveryRow,
  type ProjectRow,
  type TransactionRow,
} from '@/db';
import { useFocusData } from '@/hooks';

/** Bookings-home list (already OPEN-first from the repo). */
export function useBookings() {
  const loader = useCallback(async () => ({ items: await listBookingSummaries() }), []);
  return useFocusData(loader, { items: [] as BookingSummary[] });
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
