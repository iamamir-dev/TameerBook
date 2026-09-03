import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      paddingHorizontal: theme.spacing.page,
      paddingTop: theme.spacing.md,
      backgroundColor: theme.colors.background,
    },
    /** One pill: mic · field · send. */
    /** Rounded rectangle (not a full pill) so a multi-line message still reads well. */
    pill: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.card,
      // Half the single-line height: a true pill when short, soft corners when tall.
      borderRadius: theme.touch.minTarget / 2,
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
      // Symmetric padding keeps the last line clear of the rounded bottom edge;
      // Android needs top alignment or long text floats to the middle.
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      paddingLeft: theme.spacing.xs,
      paddingRight: theme.spacing.sm,
      textAlignVertical: 'top',
      maxHeight: 132,
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
    /** Attach + mic sit as one tight group at the left edge. */
    leading: { flexDirection: 'row', alignItems: 'center', gap: 0 },
    lead: { width: theme.touch.minTarget - 2 * theme.spacing.xs - 6 },
    send: { backgroundColor: theme.colors.accent },
    sendDisabled: { backgroundColor: theme.colors.track },
    mic: { backgroundColor: 'transparent' },
    micRecording: { backgroundColor: theme.colors.danger },
    pressed: { opacity: 0.8 },
    previews: { flexDirection: 'row', gap: theme.spacing.sm, paddingBottom: theme.spacing.sm, paddingLeft: theme.spacing.xs },
    preview: { width: 56, height: 56, borderRadius: theme.radius.md, overflow: 'visible' },
    previewImg: { width: 56, height: 56, borderRadius: theme.radius.md, backgroundColor: theme.colors.track },
    previewRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /** Paper-plane tilt: nose 30° above the horizon. */
    sendIcon: { transform: [{ rotate: '-30deg' }], marginLeft: -1, marginTop: -1 },
  });
