import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: 3 },
    gap: { height: theme.spacing.xs },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginVertical: theme.spacing.sm },
    headingWrap: { marginTop: theme.spacing.sm, marginBottom: theme.spacing.xs },
    /** Each new section starts after a clear gap and a hairline, so blocks never run together. */
    headingRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md, marginTop: theme.spacing.lg },
    tableWrap: { marginVertical: theme.spacing.sm, borderRadius: theme.radius.md, overflow: 'hidden' },
    tableScroll: { flexGrow: 0, flexShrink: 0 },
    tableFade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 28 },
    tableScrollContent: { flexGrow: 0 },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.xs },
    dot: { lineHeight: theme.typography.lineHeights.sm, minWidth: 14 },
    /** Emoji column: fixed so the text beside every marker starts on the same line. */
    emoji: { lineHeight: theme.typography.lineHeights.sm, width: 24 },
    bulletText: { flexShrink: 1, minWidth: 0 },
    /** Compact table inside a bubble. */
    /** Tables wear the message tint (no shadow, no outline); plain text around them has no fill. */
    /** At least the bubble width; wider when the columns need it (then the ScrollView scrolls). */
    table: {
      borderRadius: theme.radius.md,
      backgroundColor: 'transparent',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.sm, minHeight: 38 },
    /** Header sits on a firmer rule, like the head of a printed bill. */
    trHead: { borderBottomWidth: 1.5, borderBottomColor: theme.colors.textSecondary, minHeight: 34 },
    /** Closing total row: firm rule above, a little taller. */
    trTotal: { borderTopWidth: 1.5, borderTopColor: theme.colors.textSecondary, minHeight: 42 },
    /** Soft rule between rows so the eye tracks across the table. */
    trRuled: { borderTopWidth: 1, borderTopColor: theme.colors.border },
    /** Every cell: a fixed width per column (from content), so rows stay aligned. */
    cell: { flexShrink: 0, paddingVertical: 6, paddingRight: theme.spacing.sm, justifyContent: 'center' },
    cellNum: { textAlign: 'right', paddingRight: 0 },
    /** Status cell: coloured dot + coloured word. */
    statusCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusDot: { width: 7, height: 7, borderRadius: theme.radius.pill },
    statusText: { flexShrink: 1, minWidth: 0 },
  });
