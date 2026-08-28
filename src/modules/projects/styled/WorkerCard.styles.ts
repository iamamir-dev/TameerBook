import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    columns: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginTop: theme.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.sm,
    },
    col: { flex: 1, alignItems: 'center', gap: 2 },
    colDivider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginVertical: 2 },
  });
