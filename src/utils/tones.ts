import type { ColorPalette, Theme } from '@/theme/theme';

export type ColorKey = keyof ColorPalette;

/**
 * Tone for a user-managed display status (Settings → Statuses), cycled by its
 * position so the list reads as a progression (e.g. Planning → primary,
 * Under Construction → green accent, Finishing → gold, Ready → success) and
 * every status keeps ONE color everywhere it appears.
 */
export const STAGE_TONES: ColorKey[] = ['primary', 'accent', 'gold', 'success', 'danger'];
export function stageTone(stage: { sort_order: number; color?: string | null }): ColorKey {
  // A user-picked color always wins; the position cycle is only the default.
  if (stage.color && (STAGE_TONES as string[]).includes(stage.color)) return stage.color as ColorKey;
  const cycle = STAGE_TONES.length - 1; // auto-cycle skips danger (red = alarm, opt-in only)
  return STAGE_TONES[((stage.sort_order % cycle) + cycle) % cycle];
}

/** Soft 10% tint that pairs with a tone (for icon chips / badges). */
export function softToneColor(theme: Theme, tone: ColorKey): string {
  switch (tone) {
    case 'primary':
      return theme.colors.primarySoft;
    case 'accent':
      return theme.colors.accentSoft;
    case 'success':
      return theme.colors.successSoft;
    case 'danger':
      return theme.colors.dangerSoft;
    case 'gold':
      return theme.colors.goldSoft;
    default:
      return theme.colors.track;
  }
}
