import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /** User turn: right-aligned brand bubble with a small tail. */
    /** Extra room above a question (ends the previous exchange) and below it (before the answer). */
    userWrap: { alignItems: 'flex-end', paddingLeft: theme.spacing.xxxl, marginTop: theme.spacing.md, marginBottom: theme.spacing.xs, gap: theme.spacing.xxs },
    userCopy: { padding: theme.spacing.xs, marginRight: theme.spacing.xxs },
    userImages: { flexDirection: 'row', gap: theme.spacing.xs, justifyContent: 'flex-end', flexWrap: 'wrap' },
    userImage: { width: theme.touch.minTarget * 2, height: theme.touch.minTarget * 2, borderRadius: theme.radius.lg, backgroundColor: theme.colors.track },
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
      width: theme.spacing.xxl,
      height: theme.spacing.xxl,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.xxs,
    },
    assistantBody: { flex: 1, minWidth: 0 },
    /** Answers carry no fill: only things the user acts on (choices, confirmations) are tinted. */
    assistant: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      backgroundColor: 'transparent',
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
      backgroundColor: 'transparent',
      borderRadius: theme.radius.lg,
      borderBottomLeftRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    noticeText: { flex: 1, minWidth: 0 },
    link: { paddingHorizontal: theme.spacing.sm, minHeight: theme.touch.minTarget - theme.spacing.lg, justifyContent: 'center' },
    /** Copy icon tucked in the bubble's bottom-right corner. */
    copy: { alignSelf: 'flex-end', marginTop: theme.spacing.xxs, marginBottom: -theme.spacing.xxs, marginRight: -theme.spacing.xs, padding: theme.spacing.xs },
    retry: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
  });
