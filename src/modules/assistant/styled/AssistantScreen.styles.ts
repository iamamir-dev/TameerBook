import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: {
      paddingHorizontal: theme.spacing.page,
      paddingTop: theme.spacing.md,
      gap: theme.spacing.md,
    },
    intro: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    introHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    introIcon: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      minHeight: 44,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    chipPressed: { opacity: 0.7 },
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
      paddingHorizontal: theme.spacing.lg,
      minHeight: 44,
    },
  });
