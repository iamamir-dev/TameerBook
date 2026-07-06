import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

interface FloatingLabelInputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: KeyboardTypeOptions;
  /** Optional helper / guidance line shown under the field. */
  hint?: string;
}

/**
 * Outlined text field with a NOTCHED floating label: the label sits inside as
 * a placeholder, then rides up to sit ON the top border line (cutting a notch)
 * when the field is focused or holds a value. An optional `hint` adds a small
 * guidance line beneath. All metrics/colors come from the theme.
 *
 * The field background matches the screen background so the label's background
 * notches the border seamlessly.
 */
export function FloatingLabelInput({
  label,
  value,
  onChangeText,
  keyboardType,
  hint,
}: FloatingLabelInputProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [focused, setFocused] = useState(false);
  const active = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    active.value = withTiming(focused || value.length > 0 ? 1 : 0, { duration: 160 });
  }, [focused, value, active]);

  // Resting position that vertically centers the label glyph inside the box.
  const restingTop = (theme.touch.minTarget - theme.typography.sizes.md) / 2;

  const labelStyle = useAnimatedStyle(() => ({
    // resting: vertically centered inside; active: up on the top border (-10)
    top: interpolate(active.value, [0, 1], [restingTop, -10]),
    fontSize: interpolate(
      active.value,
      [0, 1],
      [theme.typography.sizes.md, theme.typography.sizes.xs]
    ),
    color: interpolateColor(
      active.value,
      [0, 1],
      [theme.colors.textSecondary, theme.colors.accent]
    ),
  }));

  return (
    <View>
      <View style={[styles.box, focused && styles.boxFocused]}>
        <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
          {label}
        </Animated.Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
          accessibilityLabel={label}
        />
      </View>
      {hint ? (
        <AppText size="xs" color="textSecondary" style={styles.hint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    box: {
      height: theme.touch.minTarget,
      backgroundColor: theme.colors.background,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      justifyContent: 'center',
    },
    boxFocused: {
      borderColor: theme.colors.accent,
    },
    label: {
      position: 'absolute',
      left: theme.spacing.md,
      // background matches the field/screen so it notches the border cleanly
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.xs,
      fontFamily: theme.typography.weights.semibold,
      // strip Android's extra line padding so the resting glyph centers cleanly
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    input: {
      // Auto-height single-line input, vertically centered by the box. No fixed
      // height / textAlignVertical (unreliable on iOS) — let the box center it.
      padding: 0,
      margin: 0,
      fontFamily: theme.typography.weights.semibold,
      fontSize: theme.typography.sizes.md,
      color: theme.colors.textPrimary,
      includeFontPadding: false,
    },
    hint: {
      marginTop: theme.spacing.xs,
      marginLeft: theme.spacing.sm,
    },
  });
