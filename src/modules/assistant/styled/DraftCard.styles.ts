import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /** The inline approval card (like a tool-approval bubble in a chat). */
    card: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.accent,
      overflow: 'hidden',
    },
    cardDone: { borderColor: theme.colors.track },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xs,
    },
    headText: { flex: 1, minWidth: 0 },
    amount: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xs },
    /** Field rows: label left, value right. */
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: 36,
      paddingVertical: 2,
      borderTopWidth: 1,
      borderTopColor: theme.colors.track,
    },
    label: { flex: 1 },
    value: { textAlign: 'right', flexShrink: 1 },
    /** A row that still needs a choice: tinted, tappable. */
    pick: { backgroundColor: theme.colors.accentSoft },
    inputs: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, gap: theme.spacing.sm },
    warn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      backgroundColor: theme.colors.goldSoft,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    warnText: { flex: 1, minWidth: 0 },
    /** Reject · Accept — small, side by side. */
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.track,
    },
    btn: {
      flex: 1,
      minHeight: 40,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    btnAccept: { backgroundColor: theme.colors.accent },
    btnAcceptDisabled: { backgroundColor: theme.colors.track },
    btnReject: { backgroundColor: theme.colors.primarySoft },
    pressed: { opacity: 0.8 },
    editLink: { alignItems: 'center', paddingBottom: theme.spacing.sm },
    doneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: 40,
      borderTopWidth: 1,
      borderTopColor: theme.colors.track,
    },
    doneText: { flex: 1 },
  });
