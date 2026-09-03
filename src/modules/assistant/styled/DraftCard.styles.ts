import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /**
     * The inline approval card: a soft tinted surface (no shadow, no outline)
     * with a header (icon · title · amount), hairline-ruled detail rows on the
     * same surface (one colour, nothing inset), and a compact Reject / Accept footer.
     */
    card: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
    },
    cardDone: { backgroundColor: theme.colors.primarySoft },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    iconChip: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.md,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconChipDone: { backgroundColor: 'transparent' },
    iconChipMuted: { backgroundColor: theme.colors.track },
    headText: { flex: 1, minWidth: 0, gap: 1 },
    headAmount: { maxWidth: '45%', textAlign: 'right' },
    /** Saved / Rejected state, shown as a small pill under the title. */
    statusPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 20,
      borderRadius: theme.radius.pill,
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      marginTop: 2,
    },
    statusPillMuted: {},
    /** White panel holding the detail rows while the card awaits a decision. */
    panel: {
      marginHorizontal: theme.spacing.sm,
      backgroundColor: 'transparent',
    },
    /** Settled: the rows sit directly on the message-coloured card, nothing raised. */
    panelDone: { backgroundColor: 'transparent' },
    /** Field rows: label left, value right, hairline between rows. */
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: 38,
      paddingVertical: 4,
    },
    rowRuled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    /** Label keeps at most ~45% and ellipsizes; the value takes the rest. */
    label: { flexShrink: 0, maxWidth: '45%' },
    value: { flex: 1, textAlign: 'right' },
    /** A row that still needs a choice: the value reads as a link. */
    pick: {},
    inputs: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, gap: theme.spacing.sm },
    warn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.sm,
      marginTop: theme.spacing.sm,
      backgroundColor: theme.colors.goldSoft,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    warnText: { flex: 1, minWidth: 0 },
    /** Reject (ghost) · Accept (filled): compact, right-aligned like a dialog footer. */
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
    },
    btn: {
      minHeight: 36,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    btnAccept: { backgroundColor: theme.colors.accent, paddingHorizontal: theme.spacing.lg },
    btnAcceptDisabled: { backgroundColor: theme.colors.track, paddingHorizontal: theme.spacing.lg },
    btnReject: { backgroundColor: 'transparent' },
    pressed: { opacity: 0.8 },
    editLink: { alignItems: 'center', paddingBottom: theme.spacing.sm },
    /** Footer after saving: "Saved · View ›" */
    doneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      minHeight: 40,
      marginTop: theme.spacing.xs,
    },
    doneText: { flex: 1 },
    /** Breathing room under the panel when there is no footer. */
    panelGap: { height: theme.spacing.md },
  });
