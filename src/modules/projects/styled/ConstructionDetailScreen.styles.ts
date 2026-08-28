import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    hero: { gap: theme.spacing.xs },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    emptyText: { paddingVertical: theme.spacing.md },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg },
    detailActions: { flexDirection: 'row', gap: theme.spacing.sm },
  });
