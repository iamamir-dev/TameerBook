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
import { applyMask, type MaskType } from '@/utils/mask';

interface FloatingLabelInputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: KeyboardTypeOptions;
  /** Optional helper / guidance line shown under the field. */
  hint?: string;
  /**
   * Auto-format as the user types (e.g. CNIC `#####-#######-#`, phone
   * `####-#######`). Forces a numeric keypad and stores the formatted string.
   */
  mask?: MaskType;
  /** Render as a growing multi-line text area (label floats to the top line). */
  multiline?: boolean;
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
  mask,
  multiline,
}: FloatingLabelInputProps): React.JSX.Element {
  // A masked field re-formats every keystroke and always types on a numpad.
  const handleChange = (text: string) => onChangeText(mask ? applyMask(mask, text) : text);
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [focused, setFocused] = useState(false);
  const active = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    active.value = withTiming(focused || value.length > 0 ? 1 : 0, { duration: 160 });
  }, [focused, value, active]);

  // Single-line: lift the vertically-centered label onto the border. Multi-line:
  // the label sits on the first text line, so lift it from there instead.
  const floatTo = multiline
    ? -(theme.spacing.md + theme.typography.sizes.md / 2 + 2)
    : -(theme.touch.minTarget / 2);

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
      <View style={[styles.box, multiline && styles.boxMultiline, focused && styles.boxFocused]}>
        <TextInput
          value={value}
          onChangeText={handleChange}
          keyboardType={mask ? 'number-pad' : keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && styles.inputMultiline]}
          accessibilityLabel={label}
          multiline={multiline}
        />
        {/* Overlay that fills the box and vertically centers the label; it's
            non-interactive so taps still reach the input beneath. */}
        <View pointerEvents="none" style={[styles.labelWrap, multiline && styles.labelWrapMultiline]}>
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
    boxMultiline: {
      height: undefined,
      minHeight: 92,
      paddingVertical: theme.spacing.md,
      justifyContent: 'flex-start',
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
    /* Multi-line: pin the label to the first text line instead of centering. */
    labelWrapMultiline: {
      bottom: undefined,
      justifyContent: 'flex-start',
      paddingTop: theme.spacing.md,
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
    inputMultiline: {
      flex: 1,
      textAlignVertical: 'top',
    },
    hint: {
      marginTop: theme.spacing.xs,
      marginLeft: theme.spacing.sm,
    },
  });
