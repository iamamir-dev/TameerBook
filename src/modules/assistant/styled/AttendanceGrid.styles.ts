import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

const DAY = 30;

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm, gap: 2 },
    row: { flexDirection: 'row' },
    weekday: { flex: 1, textAlign: 'center', paddingBottom: 2 },
    cell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: DAY + 4 },
    day: { width: DAY, height: DAY, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
    legend: { flexDirection: 'row', gap: theme.spacing.md, paddingTop: theme.spacing.sm, justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    dot: { width: 9, height: 9, borderRadius: theme.radius.pill },
  });
