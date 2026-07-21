import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    empty: { paddingVertical: theme.spacing.lg },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
    // Dense notebook rows, matching the Home activity ledger.
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xs, minHeight: 40 },
    pressed: { opacity: 0.6 },
    chip: {
      minWidth: 56,
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: theme.radius.pill,
    },
  });
