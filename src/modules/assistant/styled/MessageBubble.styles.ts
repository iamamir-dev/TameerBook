import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /** User turn: right-aligned brand bubble with a small tail. */
    /** Extra room above a question (ends the previous exchange) and below it (before the answer). */
    userWrap: { alignItems: 'flex-end', paddingLeft: theme.spacing.xxxl, paddingRight: theme.spacing.md, marginTop: theme.spacing.md, marginBottom: 0, gap: theme.spacing.xxs, overflow: 'visible' },
    userCopy: { padding: theme.spacing.xs, marginRight: theme.spacing.xxs },
    userImages: { flexDirection: 'row', gap: theme.spacing.xs, justifyContent: 'flex-end', flexWrap: 'wrap' },
    userImage: { width: theme.touch.minTarget * 2, height: theme.touch.minTarget * 2, borderRadius: theme.radius.lg, backgroundColor: theme.colors.track },
    /** Room for the tail to hang off the right edge. */
    userWithTail: { maxWidth: '100%', overflow: 'visible' },
    /** Outgoing bubble: brand charcoal, tight corner beside the tail. */
    user: {
      maxWidth: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.tail,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    /** Assistant turn: small avatar on the left, content fills the rest. */
    assistantRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.xs, paddingRight: theme.spacing.xl, paddingLeft: theme.spacing.md, overflow: 'visible' },
    avatar: {
      width: theme.spacing.xxl,
      height: theme.spacing.xxl,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.xxs,
    },
    assistantBody: { flex: 1, minWidth: 0, overflow: 'visible' },
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
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.hero,
      borderTopLeftRadius: theme.radius.tail,
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
    /** The tail sits at the bubble's foot, just outside its edge. */
    tail: { position: 'absolute', top: 0, width: 18, height: 22 },
    tailLeft: { left: -12 },
    tailRight: { right: -12 },
  });
