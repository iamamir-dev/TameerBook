import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const FAB_SIZE = 56;

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /** Anchored bottom-right, above the floating tab bar. */
    anchor: { position: 'absolute', right: theme.spacing.lg, width: FAB_SIZE, height: FAB_SIZE },
    /** A plain brand-charcoal circle on the app's floating shadow. */
    orb: {
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.fab,
    },
  });
