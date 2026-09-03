import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    user: {
      alignSelf: 'flex-end',
      maxWidth: '85%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.lg,
      borderBottomRightRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    assistant: {
      alignSelf: 'flex-start',
      maxWidth: '92%',
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
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
