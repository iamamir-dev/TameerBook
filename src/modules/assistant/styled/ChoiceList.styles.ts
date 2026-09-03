import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.track,
      overflow: 'hidden',
    },
    head: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, paddingBottom: 2 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: 44,
    },
    ruled: { borderTopWidth: 1, borderTopColor: theme.colors.track },
    label: { flex: 1, minWidth: 0 },
    pressed: { backgroundColor: theme.colors.accentSoft },
  });
