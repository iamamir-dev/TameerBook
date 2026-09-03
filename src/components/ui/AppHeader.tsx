import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import type { GlyphName, IconKey } from './icons';

interface HeaderAction {
  icon: IconKey | GlyphName;
  onPress: () => void;
  accessibilityLabel: string;
  /** Optional short text → renders a labeled pill instead of a bare icon. */
  label?: string;
}

interface AppHeaderProps {
  title: string;
  /** Optional small line under the title (e.g. a greeting or project name). */
  subtitle?: string;
  /** Show a back chevron and call this when tapped. */
  onBack?: () => void;
  /** Optional single action on the right (icon button). */
  rightAction?: HeaderAction;
  /** Optional row attached inside the header bar, under the title (e.g. tabs). */
  bottom?: React.ReactNode;
}

/**
 * App-wide screen header  "Soft Modern". Sits transparently on the canvas: a
 * bare back arrow + a left-aligned dark title (with an optional muted subtitle)
 * and an optional right action. Compact — no floating chip buttons. Safe-area
 * aware; tap targets stay >= the minimum touch size via hit-slop.
 */
export function AppHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  bottom,
}: AppHeaderProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  return (
    <View style={[styles.container, { paddingTop: insets.top + theme.spacing.xs }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={theme.touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.iconBtn, styles.backBtn, pressed && styles.pressed]}
          >
            <AppIcon name="back" size={24} color="textPrimary" />
          </Pressable>
        ) : null}

        <View style={styles.titleBlock}>
          <AppText size="lg" weight="bold" color="textPrimary" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText size="sm" color="textSecondary" numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </AppText>
          ) : null}
        </View>

        {rightAction ? (
          <Pressable
            onPress={rightAction.onPress}
            hitSlop={theme.touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={rightAction.accessibilityLabel}
            style={({ pressed }) => [rightAction.label ? styles.labelBtn : styles.iconBtn, pressed && styles.pressed]}
          >
            <AppIcon name={rightAction.icon} size={rightAction.label ? 18 : 24} color="textPrimary" />
            {rightAction.label ? (
              <AppText size="xs" weight="bold">
                {rightAction.label}
              </AppText>
            ) : null}
          </Pressable>
        ) : null}
      </View>
      {bottom}
    </View>
  );
}

const HIT = 40;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    // Padding lives on the row (not the container) so a `bottom` slot — e.g.
    // underline tabs — can run edge-to-edge, flush with the bottom border.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: HIT,
      paddingHorizontal: theme.spacing.page,
      paddingBottom: theme.spacing.sm,
    },
    iconBtn: {
      width: HIT,
      height: HIT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Nudge the bare arrow to sit flush with the screen's left edge.
    backBtn: { marginLeft: -theme.spacing.sm },
    labelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      height: HIT - 6,
      paddingHorizontal: theme.spacing.md,
      borderRadius: (HIT - 6) / 2,
      backgroundColor: theme.colors.card,
      ...theme.shadows.card,
    },
    pressed: {
      opacity: 0.5,
    },
    titleBlock: {
      flex: 1,
      alignItems: 'flex-start',
    },
    subtitle: {
      marginTop: 2,
    },
  });
