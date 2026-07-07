import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useTheme } from '@/theme';
import type { ColorPalette, Theme } from '@/theme/theme';
import { softToneColor } from '@/utils/tones';

type ColorKey = keyof ColorPalette;

interface StageBadgeProps {
  /** Theme color key that tints the pill. */
  tone: ColorKey;
  /** Already-translated stage label. */
  label: string;
}

/** Soft-tint stage pill (same palette family as StageTracker). */
export function StageBadge({ tone, label }: StageBadgeProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={[styles.badge, { backgroundColor: softToneColor(theme, tone) }]}>
      <AppText size="xs" weight="bold" color={tone}>
        {label}
      </AppText>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.pill,
    },
  });
