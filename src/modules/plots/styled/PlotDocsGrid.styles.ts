import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    tile: { width: 96, height: 96 },
    thumb: {
      width: 96,
      height: 96,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.track,
    },
    /** Label chip floated over the image, sitting just above its bottom edge. */
    labelChip: {
      position: 'absolute',
      left: theme.spacing.xs,
      right: theme.spacing.xs,
      bottom: theme.spacing.xs,
      alignItems: 'center',
      paddingVertical: 2,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radius.pill,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    add: { width: 96, height: 96 },
    viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
    viewerImage: { width: '100%', height: '80%' },
    viewerClose: {
      position: 'absolute',
      top: theme.spacing.xxxl,
      right: theme.spacing.lg,
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
