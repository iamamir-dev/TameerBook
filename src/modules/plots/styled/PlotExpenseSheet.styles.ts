import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    field: { gap: theme.spacing.xs },
    catRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: theme.touch.minTarget,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    catPickRow: { flexDirection: 'row', alignItems: 'stretch', gap: theme.spacing.sm },
    addBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: theme.touch.minTarget,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.colors.accent,
    },
  });
