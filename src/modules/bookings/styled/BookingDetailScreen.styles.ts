import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    hero: { gap: theme.spacing.xs },
    badgeWrap: { flexDirection: 'row', marginTop: theme.spacing.xs },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, marginVertical: theme.spacing.sm },
    columns: { flexDirection: 'row', alignItems: 'stretch', gap: theme.spacing.lg },
    col: { flex: 1, gap: theme.spacing.sm },
    vDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.border },
    deliveryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      minHeight: 44,
      paddingVertical: theme.spacing.xs,
    },
    ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    deliveryLeft: { flex: 1, gap: 2 },
    pressed: { opacity: 0.6 },
  });
