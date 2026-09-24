import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /** Under the confirmation message: Reject (outlined) · Save (filled), on the bubble's own surface. */
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
    btn: {
      minHeight: theme.touch.minTarget - theme.spacing.sm,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
    },
    btnReject: { flex: 1, borderWidth: 1.5, borderColor: theme.colors.border },
    btnSave: { flex: 2, backgroundColor: theme.colors.accent },
    pressed: { opacity: 0.8 },
    /** Settled: one quiet line, "Saved · Rs 5,000 · View ›" or "Rejected". */
    done: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, paddingHorizontal: theme.spacing.md, minHeight: 44 },
    doneText: { flex: 1, minWidth: 0 },
  });
