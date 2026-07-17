import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { gap: theme.spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    info: { flex: 1, gap: 2 },
    mathBlock: { gap: theme.spacing.xs },
    mathRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
  });
