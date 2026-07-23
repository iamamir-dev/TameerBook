import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.card },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: theme.spacing.xxxl },
    sectionLabel: { marginTop: theme.spacing.xs },
    itemCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      // Clearance so the floating "Rate" label doesn't ride over the qty row.
      gap: theme.spacing.md,
    },
    itemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    itemNo: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    addItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
    },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      minHeight: theme.touch.minTarget,
    },
    flexText: { flex: 1 },
    suggestWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
    suggestChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    suggestChipOn: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
    trash: { padding: theme.spacing.xs },
  });
