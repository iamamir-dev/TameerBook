import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSheetAnimation } from '@/hooks';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import type { IconKey } from './icons';

export interface DrawerAction {
  icon: IconKey;
  label: string;
  onPress: () => void;
  /** Row disabled + dimmed (e.g. while a share is preparing). */
  loading?: boolean;
}

interface ActionsDrawerProps {
  visible: boolean;
  onClose: () => void;
  /** Context line at the top (e.g. the investor/plot name). */
  title?: string;
  actions: DrawerAction[];
}

/**
 * THE app-wide actions drawer: a bottom sheet listing a screen's money
 * actions as icon rows. Every detail screen opens it from a round green "+"
 * beside its history/ledger heading (see `AddActionButton`), replacing the
 * old stacks of full-width buttons that pushed content off screen.
 */
export function ActionsDrawer({ visible, onClose, title, actions }: ActionsDrawerProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const { mounted, backdropStyle, sheetStyle, onSheetLayout } = useSheetAnimation(visible);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
      </Animated.View>
      <Animated.View onLayout={onSheetLayout} style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        {/* Title + ✕ header, ruled off from the option rows (Vyapar-style). */}
        <View style={styles.header}>
          <AppText size="lg" weight="bold" numberOfLines={1} style={styles.flex}>
            {title ?? ''}
          </AppText>
          <Pressable onPress={onClose} hitSlop={theme.touch.hitSlop} accessibilityRole="button" style={({ pressed }) => pressed && styles.dim}>
            <AppIcon name="close" size={22} color="textSecondary" />
          </Pressable>
        </View>
        {actions.map((a, i) => (
          <Pressable
            key={a.label}
            onPress={() => {
              onClose();
              a.onPress();
            }}
            disabled={a.loading}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, i > 0 && styles.rowRule, (pressed || a.loading) && styles.dim]}
          >
            <AppIcon name={a.icon} size={20} color="textPrimary" />
            <AppText size="md" weight="semibold" style={styles.flex}>
              {a.label}
            </AppText>
          </Pressable>
        ))}
      </Animated.View>
    </Modal>
  );
}

/** The round green "+" that opens an ActionsDrawer — sits beside a section heading. */
export function AddActionButton({
  onPress,
  accessibilityLabel,
}: {
  onPress: () => void;
  accessibilityLabel: string;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={theme.touch.hitSlop}
      style={({ pressed }) => [styles.fab, pressed && styles.dim]}
    >
      <AppIcon name="add" size={22} color="textPrimary" />
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.overlay },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      paddingHorizontal: theme.spacing.lg,
      ...theme.shadows.raised,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: theme.touch.minTarget,
      paddingHorizontal: theme.spacing.xs,
    },
    rowRule: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    dim: { opacity: 0.7 },
    // Same look as the AppHeader action chip, so every "+" in the app matches.
    fab: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.card,
    },
  });
