import { useCallback } from 'react';

import {
  getBookingSummary,
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
    return { summary, deliveries, payments, accounts, projects };
  }, [bookingId]);
  return useFocusData<BookingDetailData>(loader, {
    summary: null,
    deliveries: [],
    payments: [],
    accounts: [],
    projects: [],
  });
}
