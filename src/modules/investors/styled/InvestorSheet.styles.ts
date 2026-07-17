import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    row: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    rowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: theme.touch.minTarget,
    },
    rowActive: { borderColor: theme.colors.accent },
    rowBody: { flex: 1, gap: 2 },
    newRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.touch.minTarget,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accentSoft,
    },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    hint: { marginLeft: theme.spacing.sm },
    pressed: { opacity: 0.7 },
  });
