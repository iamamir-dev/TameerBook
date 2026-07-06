import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { digitsOnly, formatPakistaniGrouping, toReadableAmount } from '@/utils/money';

import { AppText } from './AppText';

interface AmountInputProps {
  /** Current numeric value (rupees). 0 shows an empty field with placeholder. */
  value: number;
  /** Called with the new numeric value whenever it changes. */
  onChange: (value: number) => void;
  /** Optional field label shown above the input. */
  label?: string;
  /** Auto-focus the field on mount (Quick Entry opens straight to the keyboard). */
  autoFocus?: boolean;
  /**
   * Render the compact notched floating-label variant (the label rides up onto
   * the top border when focused/filled), matching `FloatingLabelInput`.
   */
  floating?: boolean;
  /**
   * Surface colour the floating label notches into — should match the
   * container behind the field. Defaults to the screen background.
   */
  surface?: string;
  style?: ViewStyle;
}

/**
 * A money input that live-formats Pakistani-style ("2500000" -> "25,00,000")
 * and shows a plain-language helper ("25 Lakh") so non-technical users can read
 * back the amount.
 *
 * Two looks: the default large display field, and a compact `floating` variant
 * with a notched floating label for use inside forms / drawers.
 */
export function AmountInput({
  value,
  onChange,
  label,
  autoFocus,
  floating,
  surface,
  style,
}: AmountInputProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const handleChangeText = useCallback(
    (text: string) => {
      const digits = digitsOnly(text);
      onChange(digits.length ? Number(digits) : 0);
    },
    [onChange]
  );

  const displayValue = value > 0 ? formatPakistaniGrouping(value) : '';
  const helper = value > 0 ? toReadableAmount(value, t('lakhSuffix'), t('croreSuffix')) : '';

  if (floating) {
    return (
      <FloatingAmount
        label={label ?? t('amount')}
        displayValue={displayValue}
        helper={helper}
        onChangeText={handleChangeText}
        autoFocus={autoFocus}
        surface={surface ?? theme.colors.background}
        theme={theme}
        styles={styles}
        style={style}
      />
    );
  }

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <AppText size="sm" weight="semibold" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}

      <View style={styles.inputRow}>
        <AppText size="xl" weight="bold" color="textSecondary">
          Rs
        </AppText>
        <TextInput
          value={displayValue}
          onChangeText={handleChangeText}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.input}
          accessibilityLabel={label ?? t('amount')}
          maxLength={15}
          autoFocus={autoFocus}
        />
      </View>

      <View style={styles.helperRow}>
        {helper ? (
          <AppText size="md" weight="semibold" color="accent">
            {helper}
          </AppText>
        ) : (
          <AppText size="md" color="textSecondary">
            {t('amount')}
          </AppText>
        )}
      </View>
    </View>
  );
}

/** Compact notched floating-label variant with the "Rs" prefix kept inline. */
function FloatingAmount({
  label,
  displayValue,
  helper,
  onChangeText,
  autoFocus,
  surface,
  theme,
  styles,
  style,
}: {
  label: string;
  displayValue: string;
  helper: string;
  onChangeText: (t: string) => void;
  autoFocus?: boolean;
  surface: string;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
  style?: ViewStyle;
}): React.JSX.Element {
  const [focused, setFocused] = useState(false);
  const filled = displayValue.length > 0;
  const active = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    active.value = withTiming(focused || filled ? 1 : 0, { duration: 160 });
  }, [focused, filled, active]);

  const restingTop = (theme.touch.minTarget - theme.typography.sizes.md) / 2;
  const labelStyle = useAnimatedStyle(() => ({
    top: interpolate(active.value, [0, 1], [restingTop, -10]),
    fontSize: interpolate(active.value, [0, 1], [theme.typography.sizes.md, theme.typography.sizes.xs]),
    color: interpolateColor(active.value, [0, 1], [theme.colors.textSecondary, theme.colors.accent]),
  }));

  const showPrefix = focused || filled;

  return (
    <View style={style}>
      <View style={[styles.fBox, { backgroundColor: surface }, focused && styles.fBoxFocused]}>
        <Animated.Text
          style={[styles.fLabel, { backgroundColor: surface }, labelStyle]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
        <View style={styles.fRow}>
          {showPrefix ? (
            <AppText size="md" weight="bold" color="textSecondary">
              Rs
            </AppText>
          ) : null}
          <TextInput
            value={displayValue}
            onChangeText={onChangeText}
            keyboardType="number-pad"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={styles.fInput}
            accessibilityLabel={label}
            maxLength={15}
            autoFocus={autoFocus}
          />
        </View>
      </View>
      {helper ? (
        <AppText size="xs" weight="semibold" color="accent" style={styles.fHint}>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
    label: {
      marginBottom: theme.spacing.xs,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      minHeight: theme.touch.minTarget + 8,
    },
    input: {
      flex: 1,
      fontFamily: theme.typography.weights.bold,
      fontSize: theme.typography.sizes.display,
      color: theme.colors.textPrimary,
      padding: 0,
      margin: 0,
      includeFontPadding: false,
    },
    helperRow: {
      minHeight: 24,
      justifyContent: 'center',
    },
    /* floating variant */
    fBox: {
      height: theme.touch.minTarget,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      justifyContent: 'center',
    },
    fBoxFocused: {
      borderColor: theme.colors.accent,
    },
    fLabel: {
      position: 'absolute',
      left: theme.spacing.md,
      paddingHorizontal: theme.spacing.xs,
      fontFamily: theme.typography.weights.semibold,
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    fRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    fInput: {
      flex: 1,
      padding: 0,
      margin: 0,
      fontFamily: theme.typography.weights.bold,
      fontSize: theme.typography.sizes.md,
      color: theme.colors.textPrimary,
      includeFontPadding: false,
    },
    fHint: {
      marginTop: theme.spacing.xs,
      marginLeft: theme.spacing.sm,
    },
  });
