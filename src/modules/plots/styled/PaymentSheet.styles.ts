import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

/** Shared chip styles for the plot money sheets (pay-type / category chips). */
export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    chip: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    chipActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
  });
