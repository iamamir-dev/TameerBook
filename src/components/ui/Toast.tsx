import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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

const TIMING = { duration: 200, easing: Easing.inOut(Easing.quad) };

/**
 * The shared auto-dismiss toast pill, floating above the safe area. Animated
 * with a plain shared value — NOT Reanimated layout animations (`entering`/
 * `exiting`), which break the native stack's push/pop transition when they
 * run while a screen is being popped (e.g. save → toast fading → back).
 */
export function Toast({ message, icon = 'checkCircle' }: ToastProps): React.JSX.Element | null {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const progress = useSharedValue(0);
  // Keep the last message mounted through the fade-out.
  const [shown, setShown] = useState<string | null>(message);
  if (message && message !== shown) setShown(message);

  useEffect(() => {
    progress.value = withTiming(message ? 1 : 0, TIMING, (finished) => {
      if (finished && !message) runOnJS(setShown)(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 16 }],
  }));

  if (!shown) return null;

  return (
    <Animated.View style={[styles.toast, { bottom: insets.bottom + theme.spacing.xl }, style]}>
      <AppIcon name={icon} size={20} color="onPrimary" />
      <AppText size="sm" weight="bold" color="onPrimary">
        {shown}
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
