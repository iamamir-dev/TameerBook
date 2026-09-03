import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      paddingHorizontal: theme.spacing.page,
      paddingTop: theme.spacing.sm,
      backgroundColor: theme.colors.background,
    },
    /** One pill: mic · field · send. */
    pill: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      minHeight: theme.touch.minTarget,
    },
    pillRecording: { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerSoft },
    pillBusy: { borderColor: theme.colors.border },
    input: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.families.regular,
      fontSize: theme.typography.sizes.md,
      lineHeight: theme.typography.lineHeights.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      maxHeight: 120,
    },
    /** Replaces the input while recording / transcribing. */
    status: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: theme.touch.minTarget - 2 * theme.spacing.xs,
    },
    dot: { width: 10, height: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.danger },
    round: {
      width: theme.touch.minTarget - 2 * theme.spacing.xs,
      height: theme.touch.minTarget - 2 * theme.spacing.xs,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    send: { backgroundColor: theme.colors.accent },
    sendDisabled: { backgroundColor: theme.colors.track },
    mic: { backgroundColor: 'transparent' },
    micRecording: { backgroundColor: theme.colors.danger },
    pressed: { opacity: 0.8 },
    /** Paper-plane tilt: nose 30° above the horizon. */
    sendIcon: { transform: [{ rotate: '-30deg' }], marginLeft: -1, marginTop: -1 },
  });
