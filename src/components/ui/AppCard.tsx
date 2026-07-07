import React, { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

interface AppCardProps {
  children: ReactNode;
  /** Optional tap handler  makes the whole card a touch target. */
  onPress?: () => void;
  /** Use the stronger floating shadow instead of the resting card shadow. */
  raised?: boolean;
  /** Tighter inner padding (e.g. for list-style cards). */
  compact?: boolean;
  /** Add a hairline border (off by default  cards float on shadow alone). */
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The standard surface container. Soft off-white-on-white with a generous
 * radius and an ultra-soft floating shadow  no harsh borders. Background,
 * radius, padding, and shadow all come from the theme.
 */
export function AppCard({
  children,
  onPress,
  raised = false,
  compact = false,
  bordered = false,
  style,
}: AppCardProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    compact && styles.compact,
    bordered && styles.bordered,
    raised ? theme.shadows.raised : theme.shadows.card,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      padding: theme.spacing.lg,
    },
    compact: {
      padding: theme.spacing.md,
    },
    bordered: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    pressed: {
      opacity: 0.9,
    },
  });
