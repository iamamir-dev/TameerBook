import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /** User turn: right-aligned brand bubble with a small tail. */
    userWrap: { alignItems: 'flex-end', paddingLeft: theme.spacing.xxxl },
    user: {
      maxWidth: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.hero,
      borderBottomRightRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    /** Assistant turn: avatar on the left, content fills the rest. */
    assistantRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm, paddingRight: theme.spacing.lg },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    assistantBody: { flex: 1, minWidth: 0 },
    assistant: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.hero,
      borderBottomLeftRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    errorText: { flex: 1 },
  });
