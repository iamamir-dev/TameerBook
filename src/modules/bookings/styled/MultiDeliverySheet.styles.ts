import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    field: { gap: theme.spacing.xs },
    itemRow: {
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    itemHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing.sm },
    inputsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
    half: { flex: 1 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    flex: { flex: 1 },
  });
