import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.accent,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    warn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.goldSoft,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    warnText: { flex: 1 },
  });
