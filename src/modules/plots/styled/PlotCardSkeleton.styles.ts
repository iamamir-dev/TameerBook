import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

/** Placeholder blocks that mirror PlotCard's layout while the list loads. */
export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { gap: theme.spacing.md, opacity: 0.7 },
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    iconChip: { width: 44, height: 44, borderRadius: theme.radius.chip, backgroundColor: theme.colors.track },
    titleCol: { flex: 1, gap: theme.spacing.xs },
    mathBlock: { gap: theme.spacing.sm },
    mathRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, marginVertical: theme.spacing.xs },
    block: { height: 12, borderRadius: 6, backgroundColor: theme.colors.track },
  });
