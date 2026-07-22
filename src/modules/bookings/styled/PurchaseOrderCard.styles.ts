import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { gap: theme.spacing.sm },
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    iconChip: { width: 40, height: 40, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, gap: 2 },
    caption: { marginTop: 2 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
    block: { gap: theme.spacing.xs },
  });
