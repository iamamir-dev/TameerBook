import React from 'react';
import { View } from 'react-native';

import { AppCard } from '@/components/ui';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/PlotCardSkeleton.styles';

/** A shimmer-free placeholder that matches PlotCard exactly (icon chip, title +
 *  badge, the four deal rows, divider and total) so the list load feels calm. */
export function PlotCardSkeleton(): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const line = (w: string, h = 12) => <View style={[styles.block, { width: w as `${number}%`, height: h }]} />;

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconChip} />
        <View style={styles.titleCol}>
          {line('55%', 15)}
          {line('35%', 13)}
        </View>
      </View>
      <View style={styles.mathBlock}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.mathRow}>
            {line('32%')}
            {line('22%')}
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.mathRow}>
          {line('38%', 15)}
          {line('28%', 17)}
        </View>
      </View>
    </AppCard>
  );
}
