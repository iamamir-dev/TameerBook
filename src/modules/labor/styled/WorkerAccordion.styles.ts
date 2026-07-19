import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    historyHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    calendarBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressedDim: { opacity: 0.7 },
    pillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
    },
    pillBtnSoft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
    },
    card: { gap: theme.spacing.sm },
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    toggleChip: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primarySoft,
    },
    title: { flex: 1, gap: 2 },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
    mathColumns: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.sm,
    },
    mathCol: { flex: 1, alignItems: 'center', gap: 2 },
    mathColDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
    body: { gap: theme.spacing.md },
    flex: { flex: 1 },
    projectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
    projectTitle: { flex: 1, gap: 2 },
    loading: { paddingVertical: theme.spacing.xl },
  });
