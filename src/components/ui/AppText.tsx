import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { ColorPalette } from '@/theme/theme';
import type { fontSizes } from '@/theme/theme';

type SizeKey = keyof typeof fontSizes;
type WeightKey = 'regular' | 'semibold' | 'bold';
type ColorKey = keyof ColorPalette;

interface AppTextProps extends TextProps {
  /** Typography size token. Defaults to `md` (16). Content stays >= 13. */
  size?: SizeKey;
  /** Font weight token mapped to a concrete M PLUS Rounded 1c family. */
  weight?: WeightKey;
  /** Theme color key. Defaults to primary text. */
  color?: ColorKey;
  /** Center the text. */
  center?: boolean;
  /** Tabular (monospaced) digits  for aligned big numbers. */
  tabular?: boolean;
  /** Uppercase + letter-spaced overline caption (e.g. "TOTAL BALANCE"). */
  uppercase?: boolean;
}

/**
 * The base text primitive. EVERY string renders through this (or a component
 * built on it) so font family, size, weight, color, and line height all come
 * from the theme  never hardcoded.
 */
export function AppText({
  size = 'md',
  weight = 'regular',
  color = 'textPrimary',
  center,
  tabular,
  uppercase,
  style,
  children,
  ...rest
}: AppTextProps): React.JSX.Element {
  const theme = useTheme();

  const composed: TextStyle = {
    fontFamily: theme.typography.weights[weight],
    fontSize: theme.typography.sizes[size],
    lineHeight: theme.typography.lineHeights[size],
    color: theme.colors[color],
    ...(center ? { textAlign: 'center' } : null),
    ...(tabular ? { fontVariant: theme.typography.tabularNums } : null),
    ...(uppercase
      ? { textTransform: 'uppercase', letterSpacing: theme.typography.tracking }
      : null),
  };

  return (
    <Text style={[composed, style]} {...rest}>
      {children}
    </Text>
  );
}
