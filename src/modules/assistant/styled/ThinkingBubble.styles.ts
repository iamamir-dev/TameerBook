import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    bubble: {
      alignSelf: 'flex-start',
      justifyContent: 'center',
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.lg,
      borderBottomLeftRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: 36,
    },
    dots: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 16 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.textSecondary },
  });
