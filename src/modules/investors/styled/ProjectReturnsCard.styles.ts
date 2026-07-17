import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.md },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: 2 },
    pressed: { opacity: 0.6 },
  });
