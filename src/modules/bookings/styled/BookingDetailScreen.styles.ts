import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    hero: { gap: theme.spacing.xs },
    heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.md },
    // (badgeWrap removed — the status badge now sits in heroTop)
    flex: { flex: 1 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginTop: theme.spacing.xs },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: '100%',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
    },
    pillText: { flexShrink: 1 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, marginVertical: theme.spacing.sm },
    columns: { flexDirection: 'row', alignItems: 'stretch', gap: theme.spacing.lg },
    col: { flex: 1, gap: theme.spacing.sm },
    vDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.border },
    deliveryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      minHeight: 44,
      paddingVertical: theme.spacing.xs,
    },
    ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    deliveryLeft: { flex: 1, gap: 2 },
    pressed: { opacity: 0.6 },
  });
