import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /** Lives inside the reply bubble: no box of its own. */
    card: {
      alignSelf: 'stretch',
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    head: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xxs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: theme.touch.minTarget,
    },
    ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    label: { flex: 1, minWidth: 0 },
    pressed: { backgroundColor: theme.colors.accentSoft },
  });
