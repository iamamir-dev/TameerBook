import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, gap: theme.spacing.lg },
    statusRow: { flexDirection: 'row', marginTop: theme.spacing.sm },
    closedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.successSoft,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    emptyPad: { paddingVertical: theme.spacing.lg },
    invRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      minHeight: theme.touch.minTarget,
    },
    invIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.goldSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    pressed: { opacity: 0.7 },
    toolRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  });
