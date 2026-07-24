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
  const { mounted, backdropStyle, sheetStyle } = useSheetAnimation(visible);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
      </Animated.View>
      <Animated.View style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <View style={styles.grabber} />
        {title ? (
          <AppText size="lg" weight="bold" numberOfLines={1}>
            {title}
          </AppText>
        ) : null}
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={() => {
              onClose();
              a.onPress();
            }}
            disabled={a.loading}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, (pressed || a.loading) && styles.dim]}
          >
            <View style={styles.iconChip}>
              <AppIcon name={a.icon} size={20} color="accent" />
            </View>
            <AppText size="md" weight="semibold" style={styles.flex}>
              {a.label}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
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
      padding: theme.spacing.xl,
      gap: theme.spacing.sm,
      ...theme.shadows.raised,
    },
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
    },
    iconChip: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
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
