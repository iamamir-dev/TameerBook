import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /**
     * The confirmation, in the reply bubble's own colour: the whole reply is
     * ONE surface (the user's rule), so the card adds no fill, no outline and
     * no shadow. Header (icon · title · state), the amount as a headline, the
     * details as hairline-ruled rows, then what still needs fixing and the two
     * buttons.
     */
    card: {
      alignSelf: 'stretch',
      backgroundColor: 'transparent',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    cardRejected: { opacity: 0.6 },
    head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    iconChip: {
      width: theme.icon.box,
      height: theme.icon.box,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /** The one place a direction colour belongs at a glance. */
    iconChipOut: { backgroundColor: theme.colors.dangerSoft },
    iconChipIn: { backgroundColor: theme.colors.successSoft },
    iconChipDone: { backgroundColor: theme.colors.successSoft },
    iconChipMuted: { backgroundColor: theme.colors.track },
    headText: { flex: 1, minWidth: 0, gap: theme.spacing.xxs },
    /** "1/3" when a message carries several dependent actions. */
    stepPill: {
      height: 22,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /** The figure the whole card is about. */
    amount: { marginTop: theme.spacing.xxs, marginBottom: theme.spacing.xxs },
    /** The detail rows, on the same surface, hairline-ruled top and bottom. */
    panel: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
    /** Field rows: label left, value right, hairline between rows. */
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
      minHeight: 40,
      paddingVertical: theme.spacing.xs,
    },
    /** A row the user can tap (choose account / project / category) is a full touch target. */
    rowTap: { minHeight: theme.touch.minTarget - theme.spacing.sm },
    rowRuled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    /** Label keeps at most ~42% and ellipsizes; the value takes the rest. */
    label: { flexShrink: 0, maxWidth: '42%' },
    value: { flex: 1, textAlign: 'right' },
    /** Typed-in fields (name, amount, wage) when the sentence left them out. */
    inputs: { gap: theme.spacing.sm },
    /** What still blocks Accept, one line each. */
    checks: { gap: theme.spacing.xs, paddingHorizontal: theme.spacing.xs },
    check: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    checkText: { flex: 1, minWidth: 0 },
    /** Why the last Accept failed (a repository guard), kept where the user is looking. */
    warn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.dangerSoft,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    warnText: { flex: 1, minWidth: 0 },
    /** Reject (outlined) · Accept (filled): two pills sharing the row, Accept wider. */
    actions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.xxs },
    btn: {
      minHeight: theme.touch.minTarget - theme.spacing.sm,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
    },
    btnReject: { flex: 1, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: 'transparent' },
    btnAccept: { flex: 2, backgroundColor: theme.colors.accent },
    btnAcceptDisabled: { flex: 2, backgroundColor: theme.colors.track },
    pressed: { opacity: 0.8 },
    editLink: { alignItems: 'center', paddingTop: theme.spacing.xxs },
    /** Footer after saving: "Saved · Rs 39,000 · View ›" */
    doneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      minHeight: 40,
      paddingHorizontal: theme.spacing.xs,
    },
    doneText: { flex: 1 },
  });
