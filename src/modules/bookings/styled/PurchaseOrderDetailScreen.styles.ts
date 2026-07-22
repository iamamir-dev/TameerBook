import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    hero: { gap: theme.spacing.sm },
    heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.md },
    flex: { flex: 1 },
    caption: { marginTop: 2 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginVertical: theme.spacing.xs },
    columns: { flexDirection: 'row', alignItems: 'stretch' },
    col: { flex: 1, gap: theme.spacing.xs },
    vDivider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginHorizontal: theme.spacing.md },
  });
