import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    bubble: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.lg,
      borderBottomLeftRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: 36,
      maxWidth: '92%',
    },
    dots: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 16 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent },
    status: { flexShrink: 1 },
  });
