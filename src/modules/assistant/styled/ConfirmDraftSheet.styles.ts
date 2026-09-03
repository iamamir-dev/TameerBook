import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    body: { gap: theme.spacing.md, paddingBottom: theme.spacing.sm },
    hero: { alignItems: 'center', gap: theme.spacing.xs, paddingVertical: theme.spacing.sm },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.xs,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.track,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: 44,
      paddingVertical: theme.spacing.xs,
    },
    ruled: { borderTopWidth: 1, borderTopColor: theme.colors.track },
    label: { flex: 1 },
    value: { textAlign: 'right', flexShrink: 1 },
    pick: { backgroundColor: theme.colors.accentSoft },
    warn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.goldSoft,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    warnText: { flex: 1, minWidth: 0 },
    footer: { gap: theme.spacing.sm },
    link: { alignItems: 'center', minHeight: 40, justifyContent: 'center' },
  });
