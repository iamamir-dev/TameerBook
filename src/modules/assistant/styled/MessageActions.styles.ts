import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingLeft: theme.spacing.xs, marginTop: -theme.spacing.xs },
    /** Icon + label together (DESIGN_GUIDELINES rule 3); hitSlop carries the
        target to 56px without a heavy bar under every reply (rule 1). */
    action: {
      minHeight: 34,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    actionAccent: { backgroundColor: theme.colors.accentSoft, paddingHorizontal: theme.spacing.sm },
    pressed: { opacity: 0.6 },
    /** Token count sits at the far end of the row, quiet and never a button. */
    usage: { marginLeft: 'auto', paddingRight: theme.spacing.sm },
  });
