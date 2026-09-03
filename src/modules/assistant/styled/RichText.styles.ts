import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: 2 },
    gap: { height: theme.spacing.xs },
    heading: { marginTop: theme.spacing.xs },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.xs },
    dot: { lineHeight: theme.typography.lineHeights.sm },
    para: { flex: 1, minWidth: 0 },
  });
