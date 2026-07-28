import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

/** Shared chip styles for the plot money sheets (pay-type / category chips). */
export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /** Header row: wrapping chips on the left, the "+" pinned top-right. */
    chipHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.xs },
    chipRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.xs },
    chip: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    chipActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
    /** "+" shortcut chip that jumps to Settings — icon only, dashed. */
    addChip: {
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.colors.accent,
      backgroundColor: 'transparent',
    },
  });
