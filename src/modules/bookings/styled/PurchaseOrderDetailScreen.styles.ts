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

    /* Items container */
    itemRow: { paddingVertical: theme.spacing.sm },
    ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    itemTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing.sm },
    itemSub: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing.sm, marginTop: 2 },

    /* History rows */
    histRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm },
    histLeft: { flex: 1, gap: 2 },
    histRight: { alignItems: 'flex-end', gap: 2 },
    pressed: { opacity: 0.6 },
  });
