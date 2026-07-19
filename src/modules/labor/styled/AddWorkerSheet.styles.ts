import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    pillChip: {
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
    pillChipActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
  });
