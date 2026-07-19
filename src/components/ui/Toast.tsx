import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import type { GlyphName, IconKey } from './icons';

interface ToastProps {
  /** Message to show; null/empty renders nothing (pair with `useToast`). */
  message: string | null;
  /** Leading icon (defaults to a success check). */
  icon?: IconKey | GlyphName;
}

/**
 * The shared auto-dismiss toast pill. Renders the `useToast` message as a
 * floating confirmation above the safe area — replaces the identical inline
 * `Animated.View` toast that several screens each hand-rolled.
 */
export function Toast({ message, icon = 'checkCircle' }: ToastProps): React.JSX.Element | null {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  if (!message) return null;

  return (
    <Animated.View entering={FadeInDown} exiting={FadeOutDown} style={[styles.toast, { bottom: insets.bottom + theme.spacing.xl }]}>
      <AppIcon name={icon} size={20} color="onPrimary" />
      <AppText size="sm" weight="bold" color="onPrimary">
        {message}
      </AppText>
    </Animated.View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    toast: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.success,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      ...theme.shadows.raised,
    },
  });
