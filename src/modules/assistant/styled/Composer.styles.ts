import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      paddingHorizontal: theme.spacing.page,
      paddingTop: theme.spacing.sm,
      backgroundColor: theme.colors.background,
    },
    /** Field pill and action button side by side, both hugging the bottom. */
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm },
    /** Rounded rectangle (not a full pill) so a multi-line message still reads well. */
    pill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 0,
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
      // The pill already pads the outside; keep the text's own padding small so
      // one line sits centred against the 48px buttons and a wrapped message
      // never rides up under the rounded top edge.
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      paddingLeft: theme.spacing.sm,
      // Clear of the send button even mid-scroll.
      paddingRight: theme.spacing.sm,
      textAlignVertical: 'top',
      // A grown field must not swallow the conversation: about four lines.
      maxHeight: 4 * theme.typography.lineHeights.md + 2 * theme.spacing.md,
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
    dot: { width: theme.spacing.md - 2, height: theme.spacing.md - 2, borderRadius: theme.radius.pill, backgroundColor: theme.colors.danger },
    round: {
      width: theme.touch.minTarget - 2 * theme.spacing.xs,
      height: theme.touch.minTarget - 2 * theme.spacing.xs,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /** The attach button is narrower than the mic: the icon sits near the text it belongs with. */
    lead: { width: theme.touch.minTarget - 2 * theme.spacing.md + theme.spacing.xs },
    /** The send / mic circle: its own button outside the field, never squeezed. */
    action: {
      width: theme.touch.minTarget,
      height: theme.touch.minTarget,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    send: { backgroundColor: theme.colors.accent },
    sendDisabled: { backgroundColor: theme.colors.track },
    mic: { backgroundColor: 'transparent' },
    micRecording: { backgroundColor: theme.colors.danger },
    pressed: { opacity: 0.8 },
    previews: { flexDirection: 'row', gap: theme.spacing.sm, paddingBottom: theme.spacing.sm, paddingLeft: theme.spacing.xs },
    preview: { width: theme.touch.minTarget, height: theme.touch.minTarget, borderRadius: theme.radius.md, overflow: 'visible' },
    previewImg: { width: theme.touch.minTarget, height: theme.touch.minTarget, borderRadius: theme.radius.md, backgroundColor: theme.colors.track },
    previewRemove: {
      position: 'absolute',
      top: -theme.spacing.xs,
      right: -theme.spacing.xs,
      width: theme.spacing.xxl,
      height: theme.spacing.xxl,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /** Paper-plane tilt: nose 30° above the horizon. */
    sendIcon: { transform: [{ rotate: '-30deg' }], marginLeft: -1, marginTop: -1 },
  });
