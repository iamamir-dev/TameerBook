import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: 2 },
    gap: { height: theme.spacing.xs },
    heading: { marginTop: theme.spacing.xs },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.xs },
    dot: { lineHeight: theme.typography.lineHeights.sm, minWidth: 14 },
    bulletText: { flexShrink: 1, minWidth: 0 },
    /** Compact table inside a bubble. */
    table: {
      marginVertical: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.track,
      backgroundColor: theme.colors.card,
      overflow: 'hidden',
    },
    tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.sm, minHeight: 30 },
    trHead: { backgroundColor: theme.colors.background },
    trRuled: { borderTopWidth: 1, borderTopColor: theme.colors.track },
    cell: { flex: 1, minWidth: 0, paddingVertical: 4, paddingRight: theme.spacing.xs },
    cellFirst: { flex: 1.6 },
    cellNum: { textAlign: 'right', paddingRight: 0 },
  });
