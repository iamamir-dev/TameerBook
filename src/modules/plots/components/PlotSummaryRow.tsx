import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import type { ColorKey } from '@/utils/tones';

interface Props {
  label: string;
  value: string;
  valueColor?: ColorKey;
}

/** One label/value row of the plot's cost math (shared by the list card + hero). */
export function PlotSummaryRow({ label, value, valueColor = 'textPrimary' }: Props): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.row}>
      <AppText size="sm" color="textSecondary">
        {label}
      </AppText>
      <AppText size="sm" weight="semibold" color={valueColor} tabular>
        {value}
      </AppText>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
  });
