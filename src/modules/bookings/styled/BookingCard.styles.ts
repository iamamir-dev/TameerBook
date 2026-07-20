import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { gap: theme.spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    iconChip: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { flex: 1, gap: 2 },
    block: { gap: theme.spacing.xs },
  });
