import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /** User turn: right-aligned brand bubble with a small tail. */
    userWrap: { alignItems: 'flex-end', paddingLeft: theme.spacing.xxxl },
    user: {
      maxWidth: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.lg,
      borderBottomRightRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    /** Assistant turn: small avatar on the left, content fills the rest. */
    assistantRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.xs, paddingRight: theme.spacing.xl },
    avatar: {
      width: 22,
      height: 22,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    assistantBody: { flex: 1, minWidth: 0 },
    assistant: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.lg,
      borderBottomLeftRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    /** Error / open notices: a full-width quiet row, text can't collapse. */
    notice: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.lg,
      borderBottomLeftRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    noticeText: { flex: 1, minWidth: 0 },
    link: { paddingHorizontal: theme.spacing.xs, minHeight: 32, justifyContent: 'center' },
  });
