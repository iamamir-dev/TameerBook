import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import type { ColorPalette, Theme } from '@/theme/theme';

import { AppCard } from './AppCard';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import type { GlyphName, IconKey } from './icons';

type ColorKey = keyof ColorPalette;
export type Trend = 'up' | 'down' | 'none';

interface StatCardProps {
  /** Short label, e.g. "Total Balance". */
  label: string;
  /** The big formatted value, e.g. "Rs 25,00,000". */
  value: string;
  /** Optional leading icon describing the stat. */
  icon?: IconKey | GlyphName;
  /** Tints the value + icon chip (e.g. success for money-in, danger for out). */
  tone?: ColorKey;
  /** Optional trend arrow next to the value. */
  trend?: Trend;
  /** Optional small caption under the value (e.g. "this month"). */
  caption?: string;
}

/**
 * A headline number with a label — the building block of the Home dashboard.
 * The big value uses the `xxl` size; tone/trend colors come from the theme.
 */
export function StatCard({
  label,
  value,
  icon,
  tone = 'textPrimary',
  trend = 'none',
  caption,
}: StatCardProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const chipBg = chipBackground(theme, tone);

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        {icon ? (
          <View style={[styles.chip, { backgroundColor: chipBg }]}>
            <AppIcon name={icon} size={20} color={tone} />
          </View>
        ) : null}
        {trend !== 'none' ? (
          <AppIcon
            name={trend === 'up' ? 'trendUp' : 'trendDown'}
            size={20}
            color={trend === 'up' ? 'success' : 'danger'}
          />
        ) : null}
      </View>

      <AppText size="xl" weight="bold" color={tone} numberOfLines={1} adjustsFontSizeToFit tabular>
        {value}
      </AppText>
      <AppText size="xs" weight="semibold" color="textSecondary">
        {label}
      </AppText>
      {caption ? (
        <AppText size="xs" color="textSecondary" style={styles.caption}>
          {caption}
        </AppText>
      ) : null}
    </AppCard>
  );
}

/** Map a tone to its soft chip background, falling back to primary-soft. */
function chipBackground(theme: Theme, tone: ColorKey): string {
  switch (tone) {
    case 'success':
      return theme.colors.successSoft;
    case 'danger':
      return theme.colors.dangerSoft;
    case 'accent':
      return theme.colors.accentSoft;
    default:
      return theme.colors.primarySoft;
  }
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
      minHeight: 40,
    },
    chip: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    caption: {
      marginTop: theme.spacing.xs,
    },
  });
