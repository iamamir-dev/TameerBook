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
    histRow: { paddingVertical: theme.spacing.sm },
    histLeft: { gap: 3 },
    histTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing.md },
    histNote: { fontStyle: 'italic' },
    // Bleed the tint out by the card's padding on every side and add the same
    // amount back as padding, so the surrounding gap becomes space INSIDE the
    // highlight while the row's occupied size is unchanged (content stays put,
    // no layout shift). Covers the card's top padding on the first row and its
    // bottom padding on the last row too.
    histHighlight: {
      backgroundColor: theme.colors.dangerSoft,
      borderRadius: theme.radius.md,
      marginHorizontal: -theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      marginVertical: -theme.spacing.md,
      paddingVertical: theme.spacing.md + theme.spacing.sm,
    },
    pressed: { opacity: 0.6 },
  });
