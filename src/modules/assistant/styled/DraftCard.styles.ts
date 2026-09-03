import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /** The inline approval card (like a tool-approval bubble in a chat). */
    /** Soft: a tinted surface, no outline. */
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
      width: 32,
      height: 32,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconChipDone: { backgroundColor: theme.colors.successSoft },
    iconChipMuted: { backgroundColor: theme.colors.track },
    headText: { flex: 1, minWidth: 0 },
    headAmount: { maxWidth: '45%', textAlign: 'right' },
    /** Field rows: label left, value right. */
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: 32,
      paddingVertical: 2,
    },
    /** Label keeps at most ~45% and ellipsizes; the value takes the rest. */
    label: { flexShrink: 0, maxWidth: '45%' },
    value: { flex: 1, textAlign: 'right' },
    /** A row that still needs a choice: tinted, tappable. */
    pick: { backgroundColor: theme.colors.card, borderRadius: theme.radius.sm, marginHorizontal: theme.spacing.sm, paddingHorizontal: theme.spacing.sm },
    inputs: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, gap: theme.spacing.sm },
    warn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.sm,
      marginTop: theme.spacing.xs,
      backgroundColor: theme.colors.goldSoft,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    warnText: { flex: 1, minWidth: 0 },
    /** Reject · Accept — compact pills, right-aligned like a dialog footer. */
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    btn: {
      minHeight: 34,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    btnAccept: { backgroundColor: theme.colors.accent },
    btnAcceptDisabled: { backgroundColor: theme.colors.track },
    btnReject: { backgroundColor: theme.colors.card },
    pressed: { opacity: 0.8 },
    editLink: { alignItems: 'center', paddingBottom: theme.spacing.sm },
    doneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: 36,
    },
    doneText: { flex: 1 },
  });
