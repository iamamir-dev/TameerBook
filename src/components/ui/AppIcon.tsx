import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { ColorPalette } from '@/theme/theme';

import { ICONS, type GlyphName, type IconKey } from './icons';

type ThemeColorKey = keyof ColorPalette;

interface AppIconProps {
  /** A semantic key from the registry. */
  name: IconKey | GlyphName;
  /** Size in px. Defaults to the theme icon size (24). */
  size?: number;
  /** A theme color key (keeps icons on-palette) OR an explicit color string. */
  color?: ThemeColorKey | (string & {});
  /** Override the default soft stroke width (theme default 1.8). */
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The single place the app renders an icon. Resolves a semantic name to its
 * lucide component and pulls size / color / strokeWidth from the theme — so no
 * icon components, hex codes, or stroke widths leak into screens.
 */
export function AppIcon({
  name,
  size,
  color = 'textPrimary',
  strokeWidth,
  style,
}: AppIconProps): React.JSX.Element {
  const theme = useTheme();

  const resolvedColor = isThemeColorKey(color, theme.colors)
    ? theme.colors[color]
    : color;

  const Glyph = ICONS[name];

  return (
    <Glyph
      size={size ?? theme.icon.size}
      color={resolvedColor}
      strokeWidth={strokeWidth ?? theme.icon.strokeWidth}
      style={style}
    />
  );
}

/** True when `color` names a key in the theme palette. */
function isThemeColorKey(
  color: ThemeColorKey | string,
  colors: ColorPalette
): color is ThemeColorKey {
  return Object.prototype.hasOwnProperty.call(colors, color);
}
