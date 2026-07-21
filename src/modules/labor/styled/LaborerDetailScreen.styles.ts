import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    identityRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    flexGrow: { flex: 1 },
    workerAvatar: { width: 56, height: 56, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    footerRow: { flexDirection: 'row', gap: theme.spacing.md },
    historyGroup: { gap: theme.spacing.sm },
  });
