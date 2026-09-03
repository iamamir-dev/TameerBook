import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.track,
      overflow: 'hidden',
    },
    head: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm, gap: 2 },
    /** Dense rows: label + small sub on the left, tabular value on the right. */
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: 40,
      paddingVertical: theme.spacing.xs,
      borderTopWidth: 1,
      borderTopColor: theme.colors.track,
    },
    rowText: { flex: 1, minWidth: 0 },
    value: { textAlign: 'right' },
    /** "Open →" as a quiet text link, right-aligned. */
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      minHeight: 40,
      borderTopWidth: 1,
      borderTopColor: theme.colors.track,
    },
    footerLeft: { flex: 1 },
    pressed: { opacity: 0.7 },
  });
