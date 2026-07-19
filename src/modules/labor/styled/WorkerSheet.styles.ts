import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    attRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    sectionLabel: { marginTop: theme.spacing.xs },
  });
