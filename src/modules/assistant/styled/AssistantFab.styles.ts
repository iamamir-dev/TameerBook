import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const FAB_SIZE = 52;

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /** Anchored bottom-right, above the floating tab bar. */
    anchor: { position: 'absolute', right: theme.spacing.lg },
    /** The soft halo that breathes behind the button. */
    halo: {
      position: 'absolute',
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
    },
    button: {
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.fab,
    },
    pressed: { opacity: 0.9 },
  });
