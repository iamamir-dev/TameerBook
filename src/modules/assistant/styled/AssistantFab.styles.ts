import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const FAB_SIZE = 56;
/** The rotating sweeps are drawn oversize and clipped by the orb, so their
 *  corners never show while spinning. */
export const SWEEP_SIZE = FAB_SIZE * 1.5;

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /** Anchored bottom-right, above the floating tab bar. */
    anchor: { position: 'absolute', right: theme.spacing.lg, width: FAB_SIZE, height: FAB_SIZE },
    /** Blurred-looking glow: several soft rings that breathe. */
    glow: {
      position: 'absolute',
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.gradients.orbGlow,
    },
    orb: {
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: theme.radius.pill,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.fab,
    },
    sweep: {
      position: 'absolute',
      width: SWEEP_SIZE,
      height: SWEEP_SIZE,
      left: (FAB_SIZE - SWEEP_SIZE) / 2,
      top: (FAB_SIZE - SWEEP_SIZE) / 2,
      borderRadius: SWEEP_SIZE / 2,
    },
    /** Glassy highlight on the upper half. */
    sheen: {
      position: 'absolute',
      top: theme.spacing.xxs,
      left: theme.spacing.sm,
      right: theme.spacing.sm,
      height: FAB_SIZE * 0.42,
      borderRadius: theme.radius.pill,
      backgroundColor: 'rgba(255,255,255,0.28)',
    },
    /** Thin inner rim so the orb reads as a sphere on any background. */
    rim: {
      position: 'absolute',
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.45)',
    },
  });
