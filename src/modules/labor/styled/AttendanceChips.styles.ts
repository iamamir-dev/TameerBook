import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: theme.spacing.sm },
    chip: {
      flex: 1,
      minHeight: theme.touch.minTarget, // 56 — meets the touch-target rule
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
  });
