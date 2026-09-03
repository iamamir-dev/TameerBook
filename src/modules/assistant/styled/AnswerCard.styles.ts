import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    head: { padding: theme.spacing.lg, gap: theme.spacing.xs },
    rows: { borderTopWidth: 1, borderTopColor: theme.colors.border },
    footer: { padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border },
  });
