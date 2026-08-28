import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.lg,
    },
    dot: {
      width: 9,
      height: 9,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.border,
    },
    dotActive: { backgroundColor: theme.colors.accent, width: 28 },
    dotDone: { backgroundColor: theme.colors.success },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    stepIcon: {
      alignSelf: 'center',
      width: 64,
      height: 64,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.sm,
    },
    guide: { marginBottom: theme.spacing.sm },
    /* plot picker */
    plotCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
    },
    plotCardActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
    plotIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primarySoft,
    },
    plotIconActive: { backgroundColor: theme.colors.accent },
    /* review */
    reviewCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      paddingHorizontal: theme.spacing.lg,
      ...theme.shadows.card,
    },
    reviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    ruled: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    reviewValue: { flex: 1, textAlign: 'right' },
    footer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
    },
    backBtn: { flex: 1 },
    nextBtn: { flex: 2 },
    /* investor list rows */
    invRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    invIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.goldSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /* add-investor sheet */
  });
