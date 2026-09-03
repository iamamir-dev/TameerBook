import React from 'react';
import { View, type DimensionValue } from 'react-native';

import { useTheme } from '@/theme';

interface SkeletonBlockProps {
  width: DimensionValue;
  height?: number;
  /** Fully round (for icon/avatar placeholders). */
  round?: boolean;
  /** On a charcoal (hero) surface — uses the translucent white chip tone. */
  onDark?: boolean;
}

/**
 * One placeholder shape for loading skeletons. Shimmer-free by design (calm,
 * like the plots/projects card skeletons): a `track`-colored rounded block on
 * light cards, translucent white on the charcoal hero.
 */
export function SkeletonBlock({ width, height = 12, round, onDark }: SkeletonBlockProps): React.JSX.Element {
  const theme = useTheme();
  return (
    <View
      style={{
        width,
        height,
        borderRadius: round ? theme.radius.pill : Math.min(theme.radius.sm, Math.ceil(height / 2)),
        backgroundColor: onDark ? theme.colors.onPrimaryChip : theme.colors.track,
      }}
    />
  );
}
