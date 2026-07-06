import type { ColorPalette, Theme } from '@/theme/theme';

type ColorKey = keyof ColorPalette;

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
