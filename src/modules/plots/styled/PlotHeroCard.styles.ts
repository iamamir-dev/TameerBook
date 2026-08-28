import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    hero: { gap: theme.spacing.xs },
    badgeRow: { flexDirection: 'row' },
    stagePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: theme.radius.pill,
      marginTop: 4,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      marginVertical: theme.spacing.sm,
    },
    transferRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    flex: { flex: 1 },
    pressedDim: { opacity: 0.7 },
  });
