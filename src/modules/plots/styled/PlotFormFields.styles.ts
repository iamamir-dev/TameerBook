import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    sizeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
    unitChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      height: theme.touch.minTarget,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    sectionLabel: { marginTop: theme.spacing.sm },
    deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    clearChip: { paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.sm },
  });
