import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

interface StickyFooterProps {
  /** The primary action(s) — usually a single AppButton. */
  children: React.ReactNode;
  /**
   * Add the device's bottom safe-area inset below the content. ON for
   * full-screen forms (the bar hugs the screen edge); OFF for bottom-sheets,
   * whose sheet container already pads for the inset.
   */
  applyInset?: boolean;
  style?: ViewStyle;
}

/**
 * A bottom-pinned action bar. Place it as a SIBLING AFTER the ScrollView (both
 * inside the same KeyboardAvoidingView) so the primary action stays put while
 * the form scrolls, and the keyboard lifts it. A hairline top divider separates
 * it from the scrolling content — the one clear action per screen, always in
 * reach.
 */
export function StickyFooter({ children, applyInset = true, style }: StickyFooterProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  return (
    <View
      style={[
        styles.footer,
        { paddingBottom: (applyInset ? insets.bottom : 0) + theme.spacing.md },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    footer: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
  });
