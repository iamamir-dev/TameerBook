import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: {
      paddingHorizontal: theme.spacing.page,
      paddingTop: theme.spacing.sm,
      // Breathing room between turns; a user question gets extra space above
      // (see MessageBubble.userWrap) so each exchange reads as one group.
      gap: theme.spacing.md,
    },
    intro: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.track,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    introHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    introIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      minHeight: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
    },
    chipPressed: { opacity: 0.7 },
    /** Model-offered follow-ups: outlined in the accent, quieter than answers. */
    /** Model-offered follow-ups: one small scrolling row of quiet pills. */
    followRow: { flexDirection: 'row', gap: 6, paddingRight: theme.spacing.lg },
    followChip: {
      paddingHorizontal: theme.spacing.sm,
      height: 28,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.accentSoft,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    turnStack: { gap: theme.spacing.sm },
    sectionLabel: { marginTop: theme.spacing.xs, marginLeft: theme.spacing.xs },
    setup: {
      margin: theme.spacing.page,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
  });
