import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { gap: theme.spacing.md },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    iconChip: { width: 44, height: 44, borderRadius: theme.radius.chip, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { flex: 1, gap: theme.spacing.xs },
    badgeWrap: { flexDirection: 'row' },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    progressBar: { flex: 1 },
    mathBlock: { gap: theme.spacing.xs },
    mathRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, marginVertical: theme.spacing.xs },
    saleRow: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
  });
