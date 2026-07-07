import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import type { GlyphName, IconKey } from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  /** Icon shown with the label. UX rule: icon + text together, always. */
  icon?: IconKey | GlyphName;
  /**
   * Which side the icon sits on. Defaults to the left, EXCEPT the directional
   * `forward` arrow, which reads as "continue →" and defaults to the right.
   */
  iconRight?: boolean;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  /** Buttons are full-width by default (one clear primary action per screen). */
  fullWidth?: boolean;
  /** Fully-rounded pill shape (else a soft 14px radius). */
  pill?: boolean;
  style?: ViewStyle;
}

/**
 * Primary tappable action. Always >= 56px tall (the minimum touch target),
 * icon + label together, with a built-in loading state. Colors and sizing all
 * come from the theme.
 */
export function AppButton({
  label,
  onPress,
  icon,
  iconRight,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
  pill = false,
  style,
}: AppButtonProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const palette = variantPalette(theme, variant);
  const isDisabled = disabled || loading;
  // A forward arrow means "continue"  it belongs after the label unless told otherwise.
  const onRight = iconRight ?? icon === 'forward';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={theme.touch.hitSlop}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { borderRadius: pill ? theme.radius.pill : theme.radius.md },
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: palette.border === 'transparent' ? 0 : StyleSheet.hairlineWidth * 2,
        },
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.content}>
          {icon && !onRight ? <AppIcon name={icon} size={22} color={palette.fgColorKey} /> : null}
          <AppText size="lg" weight="bold" style={{ color: palette.fg }}>
            {label}
          </AppText>
          {icon && onRight ? <AppIcon name={icon} size={22} color={palette.fgColorKey} /> : null}
        </View>
      )}
    </Pressable>
  );
}

function variantPalette(theme: Theme, variant: ButtonVariant) {
  switch (variant) {
    case 'secondary':
      return {
        bg: theme.colors.card,
        fg: theme.colors.primary,
        fgColorKey: 'primary' as const,
        border: theme.colors.border,
      };
    case 'danger':
      return {
        bg: theme.colors.danger,
        fg: theme.colors.onPrimary,
        fgColorKey: 'onPrimary' as const,
        border: 'transparent',
      };
    case 'primary':
    default:
      return {
        bg: theme.colors.primary,
        fg: theme.colors.onPrimary,
        fgColorKey: 'onPrimary' as const,
        border: 'transparent',
      };
  }
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    base: {
      minHeight: theme.touch.minTarget,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullWidth: {
      alignSelf: 'stretch',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.5,
    },
  });
