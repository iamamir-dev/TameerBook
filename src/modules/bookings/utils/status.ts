import type { BookingStatus } from '@/db';
import type { TranslationKey } from '@/i18n';
import type { ColorKey } from '@/utils/tones';

/** Badge tone + label key for a booking status (shared by card + detail). */
export function bookingStatusMeta(status: BookingStatus): { tone: ColorKey; labelKey: TranslationKey } {
  if (status === 'CANCELLED') return { tone: 'danger', labelKey: 'statusCancelled' };
  if (status === 'CLOSED') return { tone: 'success', labelKey: 'statusDone' };
  return { tone: 'accent', labelKey: 'statusCurrent' };
}
