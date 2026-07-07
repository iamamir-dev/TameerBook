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
 * The label is centered by FLEXBOX (an absolutely-positioned overlay that fills
 * the box and centers its content), so at rest it aligns pixel-for-pixel with
 * the input text regardless of the font's line-box metrics — then a `translateY`
 * floats it up onto the border. (Computing a manual `top` fought the baseline
 * and dropped the glyph a few px low.)
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

  // Active: lift the centered label up onto the top border line.
  const floatTo = -(theme.touch.minTarget / 2);

  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(active.value, [0, 1], [0, floatTo]) }],
    fontSize: interpolate(active.value, [0, 1], [theme.typography.sizes.md, theme.typography.sizes.xs]),
    color: interpolateColor(
      active.value,
      [0, 1],
      [theme.colors.textSecondary, theme.colors.accent]
    ),
  }));

  return (
    <View>
      <View style={[styles.box, focused && styles.boxFocused]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
          accessibilityLabel={label}
        />
        {/* Overlay that fills the box and vertically centers the label; it's
            non-interactive so taps still reach the input beneath. */}
        <View pointerEvents="none" style={styles.labelWrap}>
          <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
            {label}
          </Animated.Text>
        </View>
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
    /* fills the box; flexbox centers the label exactly like the input text */
    labelWrap: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: theme.spacing.md,
      right: theme.spacing.md,
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    label: {
      // background matches the field/screen so it notches the border cleanly
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.xs,
      fontFamily: theme.typography.weights.semibold,
      includeFontPadding: false,
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
