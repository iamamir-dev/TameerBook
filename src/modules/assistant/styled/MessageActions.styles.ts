import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, paddingLeft: theme.spacing.xs, marginTop: -2 },
    action: {
      minWidth: 28,
      height: 28,
      paddingHorizontal: 6,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    actionAccent: { backgroundColor: theme.colors.accentSoft, paddingHorizontal: theme.spacing.sm },
    pressed: { opacity: 0.6 },
  });
