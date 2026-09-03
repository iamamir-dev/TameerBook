import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { paddingHorizontal: theme.spacing.page, paddingTop: theme.spacing.lg, gap: theme.spacing.lg },
    newDeal: { gap: theme.spacing.md },
    hero: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    heroMetrics: {
      gap: theme.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.md,
      marginTop: theme.spacing.sm,
    },
    metricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    sectionTitle: { marginTop: theme.spacing.sm },
    detailActions: { flexDirection: 'row', gap: theme.spacing.sm },
  });
