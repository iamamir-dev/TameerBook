import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import type { ColorPalette, Theme } from '@/theme/theme';

type ColorKey = keyof ColorPalette;

interface ProgressBarProps {
  /** Completion 0–100. */
  percent: number;
  /** Fill color (theme key). Defaults to accent. */
  tone?: ColorKey;
}

/** Slim rounded progress bar — accent fill on a neutral track. */
export function ProgressBar({ percent, tone = 'accent' }: ProgressBarProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View style={styles.track}>
      <View
        style={[styles.fill, { width: `${clamped}%`, backgroundColor: theme.colors[tone] }]}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    track: {
      height: 6,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
      overflow: 'hidden',
    },
    fill: {
      height: 6,
      borderRadius: theme.radius.pill,
    },
  });
