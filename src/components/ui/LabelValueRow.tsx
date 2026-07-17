import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { ColorPalette, Theme } from '@/theme/theme';

import { AppText } from './AppText';

interface LabelValueRowProps {
  label: string;
  /** Right-hand value. A string renders as themed text; a node renders as-is. */
  value: React.ReactNode;
  /** Palette color for a string value (e.g. 'success' / 'danger' / 'gold'). */
  valueColor?: keyof ColorPalette;
  /** Emphasize both label and value (totals rows). */
  strong?: boolean;
  style?: ViewStyle;
}

/**
 * The one label↔value row. Replaces ~7 near-identical inline variants
 * (`SummaryRow`, `MetricRow`, `WorthRow`, `ReviewRow`, `ColumnStat`, `Row`,
 * `MathRow`) scattered across screens. Left label, right value, baseline-aligned.
 */
export function LabelValueRow({
  label,
  value,
  valueColor,
  strong = false,
  style,
}: LabelValueRowProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={[styles.row, style]}>
      <AppText size={strong ? 'md' : 'sm'} weight={strong ? 'bold' : 'semibold'} color="textSecondary">
        {label}
      </AppText>
      {typeof value === 'string' || typeof value === 'number' ? (
        <AppText size="md" weight="bold" color={valueColor} tabular>
          {value}
        </AppText>
      ) : (
        value
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
  });
