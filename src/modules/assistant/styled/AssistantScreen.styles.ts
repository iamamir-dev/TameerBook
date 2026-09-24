import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.chatCanvas },
    flex: { flex: 1 },
    content: {
      paddingHorizontal: theme.spacing.page,
      paddingTop: theme.spacing.sm,
      // Room between turns; a user question gets a little extra above (see MessageBubble.userWrap).
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
      width: theme.icon.box,
      height: theme.icon.box,
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
    followRow: { flexDirection: 'row', gap: theme.spacing.xs, paddingRight: theme.spacing.lg, paddingVertical: theme.spacing.xs },
    /** Follow-ups stay a light scrolling row; hitSlop carries the tap target
        instead of a 56px pill (DESIGN_GUIDELINES rule 1, small touchables). */
    followChip: {
      paddingHorizontal: theme.spacing.sm,
      height: 30,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.accentSoft,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    turnStack: { gap: theme.spacing.sm },
    /** The whole reply on one surface: text, card, choices, confirmation. */
    /** Incoming bubble: white on the deeper canvas, no shadow, no outline, tight corner beside the tail. */
    replyWrap: { alignSelf: 'stretch', overflow: 'visible' },
    replyWrapHug: { alignSelf: 'flex-start', maxWidth: '88%' },
    replyBubble: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.hero,
      borderTopLeftRadius: theme.radius.tail,
      overflow: 'hidden',
    },
    /** A card or list inside the bubble sits under a hairline, never in its own box. */
    replyPiece: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.track },
    moreCards: { alignItems: 'flex-end', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.track },
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
