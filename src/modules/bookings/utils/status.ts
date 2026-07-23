import type { BookingSummary, PurchaseOrderSummary } from '@/db';
import type { TranslationKey } from '@/i18n';
import type { ColorKey } from '@/utils/tones';

/**
 * Situational badge tone + label for a booking, derived from the real balances
 * (not just OPEN/CLOSED): what's actually happening right now.
 */
export function bookingStatusMeta(s: BookingSummary): { tone: ColorKey; labelKey: TranslationKey } {
  const { booking, qtyReceived, qtyRemaining, payRemaining } = s;
  const gotAll = qtyRemaining <= 0.001;
  const paidAll = payRemaining < 1; // sub-rupee remainder = fully paid

  if (booking.status === 'CANCELLED') return { tone: 'danger', labelKey: 'statusCancelled' };
  if (gotAll && paidAll) return { tone: 'success', labelKey: 'statusDone' }; // Completed
  if (gotAll && !paidAll) return { tone: 'gold', labelKey: 'statusToPay' }; // received, money owed
  if (qtyReceived > 0) return { tone: 'accent', labelKey: 'statusPartial' }; // some in, more to come
  if (paidAll) return { tone: 'accent', labelKey: 'statusAwaitingDelivery' }; // paid up front, nothing in yet
  return { tone: 'accent', labelKey: 'statusOrdered' }; // nothing received/paid yet
}

/** Situational status for a whole purchase order, rolled up from its items. */
export function purchaseOrderStatusMeta(po: PurchaseOrderSummary): { tone: ColorKey; labelKey: TranslationKey } {
  if (po.status === 'CANCELLED') return { tone: 'danger', labelKey: 'statusCancelled' };
  const gotAll = po.fullyReceived;
  const paidAll = po.items.every((i) => i.payRemaining < 1); // every item's money settled
  const anyReceived = po.items.some((i) => i.qtyReceived > 0);

  if (gotAll && paidAll) return { tone: 'success', labelKey: 'statusDone' };
  if (gotAll && !paidAll) return { tone: 'gold', labelKey: 'statusToPay' };
  if (anyReceived) return { tone: 'accent', labelKey: 'statusPartial' };
  if (paidAll && po.paid > 0) return { tone: 'accent', labelKey: 'statusAwaitingDelivery' };
  return { tone: 'accent', labelKey: 'statusOrdered' };
}
