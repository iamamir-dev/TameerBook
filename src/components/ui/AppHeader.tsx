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
}

interface AppHeaderProps {
  title: string;
  /** Optional small line under the title (e.g. a greeting or project name). */
  subtitle?: string;
  /** Show a back chevron and call this when tapped. */
  onBack?: () => void;
  /** Optional single action on the right (icon button). */
  rightAction?: HeaderAction;
}

/**
 * App-wide screen header  "Soft Modern". Sits transparently on the cream
 * canvas (no colored bar): a centered dark title with an optional muted
 * subtitle, flanked by round white "chip" buttons that float on a soft shadow.
 * Safe-area aware and every tap target stays >= the minimum touch size.
 */
export function AppHeader({
  title,
  subtitle,
  onBack,
  rightAction,
}: AppHeaderProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  return (
    <View style={[styles.container, { paddingTop: insets.top + theme.spacing.sm }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={theme.touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <AppIcon name="back" size={24} color="textPrimary" />
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}

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
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <AppIcon name={rightAction.icon} size={22} color="textPrimary" />
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
    </View>
  );
}

const CHIP = 46;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: 'transparent',
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: CHIP,
    },
    chip: {
      width: CHIP,
      height: CHIP,
      borderRadius: CHIP / 2,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.card,
    },
    spacer: {
      width: CHIP,
      height: CHIP,
    },
    pressed: {
      opacity: 0.6,
    },
    titleBlock: {
      flex: 1,
      alignItems: 'center',
    },
    subtitle: {
      marginTop: 2,
    },
  });
