import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: 3 },
    gap: { height: theme.spacing.xs },
    headingWrap: { marginTop: theme.spacing.sm, marginBottom: theme.spacing.xs },
    /** Each new section starts after a clear gap and a hairline, so blocks never run together. */
    headingRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md, marginTop: theme.spacing.lg },
    tableScroll: { flexGrow: 0, flexShrink: 0, marginVertical: theme.spacing.xs },
    tableScrollContent: { flexGrow: 0, alignItems: 'flex-start' },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.xs },
    dot: { lineHeight: theme.typography.lineHeights.sm, minWidth: 14 },
    bulletText: { flexShrink: 1, minWidth: 0 },
    /** Compact table inside a bubble. */
    /** Tables wear the message tint (no shadow, no outline); plain text around them has no fill. */
    table: {
      marginVertical: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primarySoft,
      overflow: 'hidden',
    },
    tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, minHeight: 36 },
    trHead: { borderBottomWidth: 1, borderBottomColor: theme.colors.border, minHeight: 32 },
    /** Soft rule between rows so the eye tracks across the table. */
    trRuled: { borderTopWidth: 1, borderTopColor: theme.colors.border },
    cell: { flex: 1, minWidth: 0, paddingVertical: 4, paddingRight: theme.spacing.xs },
    cellFirst: { flex: 1.6 },
    cellNum: { flex: 0, flexShrink: 0, textAlign: 'right', paddingRight: 0, paddingLeft: theme.spacing.sm },
    /** Header over a numeric column: right-aligned, but allowed to shrink. */
    cellNumHead: { minWidth: 72 },
    /** Fixed widths inside a horizontally scrolling table. */
    cellWide: { flex: 0, width: 104 },
    cellWideFirst: { flex: 0, width: 150 },
  });
