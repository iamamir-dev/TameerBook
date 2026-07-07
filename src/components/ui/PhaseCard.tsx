import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { softToneColor, type ColorKey } from '@/utils/tones';
import { formatRupees } from '@/utils/money';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import type { IconKey } from './icons';

export interface PhaseMetric {
  label: string;
  value: string;
  /** Optional color for the value (e.g. success for received money). */
  tone?: ColorKey;
}

interface PhaseCardProps {
  /** Phase name  Plot / Construction / Sale. */
  title: string;
  icon: IconKey;
  tone: ColorKey;
  /** The headline number (usually the phase's total cost). */
  headline: number;
  headlineLabel: string;
  /** Small supporting rows (paid / remaining / top category …). */
  metrics?: PhaseMetric[];
  onPress: () => void;
}

/**
 * One phase of a project (Plot → Construction → Sale) as a tappable summary
 * card: icon + title, a big headline amount, and a few supporting metrics.
 * Tapping opens the phase's detail screen  all data entry happens there.
 */
export function PhaseCard({
  title,
  icon,
  tone,
  headline,
  headlineLabel,
  metrics,
  onPress,
}: PhaseCardProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <View style={[styles.iconChip, { backgroundColor: softToneColor(theme, tone) }]}>
          <AppIcon name={icon} size={22} color={tone} />
        </View>
        <AppText size="md" weight="bold" style={styles.flex}>
          {title}
        </AppText>
        <AppIcon name="forward" size={20} color="textSecondary" />
      </View>

      <View style={styles.headline}>
        <AppText size="xs" color="textSecondary" uppercase>
          {headlineLabel}
        </AppText>
        <AppText size="xxl" weight="bold" tabular>
          {formatRupees(headline)}
        </AppText>
      </View>

      {metrics && metrics.length > 0 ? (
        <View style={styles.metrics}>
          {metrics.map((m) => (
            <View key={m.label} style={styles.metricRow}>
              <AppText size="sm" color="textSecondary">
                {m.label}
              </AppText>
              <AppText size="sm" weight="bold" tabular color={m.tone ?? 'textPrimary'}>
                {m.value}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      ...theme.shadows.card,
    },
    pressed: { opacity: 0.85 },
    head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    iconChip: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flex: { flex: 1 },
    headline: { gap: 2 },
    metrics: {
      gap: theme.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.md,
    },
    metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  });
