import type { BookingSummary } from '@/db';
import type { TranslationKey } from '@/i18n';
import type { ColorKey } from '@/utils/tones';

/**
 * Situational badge tone + label for a booking, derived from the real balances
 * (not just OPEN/CLOSED): what's actually happening right now.
 */
export function bookingStatusMeta(s: BookingSummary): { tone: ColorKey; labelKey: TranslationKey } {
  const { booking, qtyReceived, qtyRemaining, payRemaining } = s;
  const gotAll = qtyRemaining <= 0.001;
  const paidAll = payRemaining <= 0.001;

  if (booking.status === 'CANCELLED') return { tone: 'danger', labelKey: 'statusCancelled' };
  if (gotAll && paidAll) return { tone: 'success', labelKey: 'statusDone' }; // Completed
  if (gotAll && !paidAll) return { tone: 'gold', labelKey: 'statusToPay' }; // received, money owed
  if (paidAll && !gotAll) return { tone: 'accent', labelKey: 'statusAwaitingDelivery' }; // paid, awaiting material
  if (qtyReceived > 0) return { tone: 'accent', labelKey: 'statusPartial' }; // some received
  return { tone: 'accent', labelKey: 'statusOrdered' }; // nothing received/paid yet
}
