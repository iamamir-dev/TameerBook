import React from 'react';
import { View } from 'react-native';

import { AppCard } from '@/components/ui';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/ProjectCardSkeleton.styles';

/** Calm placeholder matching ProjectCard (icon chip, title+badge, progress bar,
 *  the plot/construction/total math) while the projects list loads. */
export function ProjectCardSkeleton(): React.JSX.Element {
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
      <View style={styles.bar} />
      <View style={styles.mathBlock}>
        <View style={styles.mathRow}>
          {line('30%')}
          {line('22%')}
        </View>
        <View style={styles.mathRow}>
          {line('34%')}
          {line('22%')}
        </View>
        <View style={styles.divider} />
        <View style={styles.mathRow}>
          {line('38%', 15)}
          {line('28%', 17)}
        </View>
      </View>
    </AppCard>
  );
}
