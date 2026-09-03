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
    thinking: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.lg,
      borderBottomLeftRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: 36,
    },
  });
