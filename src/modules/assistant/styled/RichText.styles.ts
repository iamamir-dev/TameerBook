import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: 2 },
    gap: { height: theme.spacing.xs },
    headingWrap: { marginTop: theme.spacing.sm, marginBottom: 2 },
    headingRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: theme.spacing.sm, marginTop: theme.spacing.md },
    tableScroll: { flexGrow: 0, flexShrink: 0, marginVertical: theme.spacing.xs },
    tableScrollContent: { flexGrow: 0, alignItems: 'flex-start' },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.xs },
    dot: { lineHeight: theme.typography.lineHeights.sm, minWidth: 14 },
    bulletText: { flexShrink: 1, minWidth: 0 },
    /** Compact table inside a bubble. */
    table: {
      marginVertical: theme.spacing.xs,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.card,
      overflow: 'hidden',
    },
    tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.sm, minHeight: 34 },
    trHead: { backgroundColor: theme.colors.background },
    trRuled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    cell: { flex: 1, minWidth: 0, paddingVertical: 4, paddingRight: theme.spacing.xs },
    cellFirst: { flex: 1.6 },
    cellNum: { flex: 0, flexShrink: 0, textAlign: 'right', paddingRight: 0, paddingLeft: theme.spacing.sm },
    /** Header over a numeric column: right-aligned, but allowed to shrink. */
    cellNumHead: { minWidth: 72 },
    /** Fixed widths inside a horizontally scrolling table. */
    cellWide: { flex: 0, width: 104 },
    cellWideFirst: { flex: 0, width: 150 },
  });
