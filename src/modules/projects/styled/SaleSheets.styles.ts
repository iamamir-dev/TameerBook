import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

/** Shared chip styles for the sale money sheets (pay-type / category chips). */
export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.xs },
    chip: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    chipActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
  });
