import type { AttendanceStatus } from '@/db';
import type { TranslationKey } from '@/i18n';
import type { ColorPalette } from '@/theme/theme';

/** i18n label key per attendance status (was redefined ~4× across the module). */
export const ATT_LABEL: Record<AttendanceStatus, TranslationKey> = {
  FULL: 'attFull',
  HALF: 'attHalf',
  ABSENT: 'attAbsent',
};

/** Palette tone per status — accent (full), gold (half), danger (absent). */
export const ATT_TONE: Record<AttendanceStatus, keyof ColorPalette> = {
  FULL: 'accent',
  HALF: 'gold',
  ABSENT: 'danger',
};

/** Soft background token per status (for calendar day fills / legend dots). */
export const ATT_SOFT: Record<AttendanceStatus, keyof ColorPalette> = {
  FULL: 'accentSoft',
  HALF: 'goldSoft',
  ABSENT: 'dangerSoft',
};
