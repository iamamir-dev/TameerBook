import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

const TRACK_W = 44;
const TRACK_H = 26;
const THUMB = 22;
const PAD = 2;

interface AppToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}

/**
 * iOS-style switch: a rounded pill that turns green with a white thumb that
 * slides across. Renders identically on Android and iOS (RN's built-in
 * `Switch` looks Material on Android). Driven by Reanimated.
 */
export function AppToggle({
  value,
  onValueChange,
  accessibilityLabel,
  disabled,
}: AppToggleProps): React.JSX.Element {
  const theme = useTheme();
  const progress = useDerivedValue(() => withTiming(value ? 1 : 0, { duration: 180 }), [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [theme.colors.track, theme.colors.accent]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: PAD + progress.value * (TRACK_W - THUMB - 2 * PAD) }],
  }));

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={disabled ? styles.disabled : undefined}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  disabled: { opacity: 0.5 },
});
