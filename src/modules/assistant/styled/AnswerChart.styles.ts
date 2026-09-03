import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm, gap: theme.spacing.xs },
    /** One horizontal bar: label · track with fill · value. */
    barRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: 22 },
    barLabel: { width: 84 },
    track: { flex: 1, height: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: theme.radius.pill, backgroundColor: theme.colors.danger },
    barValue: { width: 48, textAlign: 'right' },
    legend: { flexDirection: 'row', gap: theme.spacing.md, justifyContent: 'flex-end' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    dot: { width: 8, height: 8, borderRadius: theme.radius.pill },
  });
