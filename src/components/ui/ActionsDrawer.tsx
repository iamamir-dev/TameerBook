import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSheetAnimation } from '@/hooks';
import { useTranslation } from '@/i18n';
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
 * Modern app-wide actions drawer: a bottom sheet listing a screen's actions
 * as polished icon rows with consistent touch feedback.
 */
export function ActionsDrawer({ visible, onClose, title, actions }: ActionsDrawerProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { mounted, backdropStyle, sheetStyle, onSheetLayout } = useSheetAnimation(visible);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('cancel')}
        />
      </Animated.View>
      <Animated.View
        onLayout={onSheetLayout}
        style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + theme.spacing.lg }]}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('cancel')}
          style={styles.grabberArea}
        >
          <View style={styles.grabber} />
        </Pressable>

        {title ? (
          <View style={styles.header}>
            <AppText size="lg" weight="bold" numberOfLines={1} style={styles.flex}>
              {title}
            </AppText>
            <Pressable
              onPress={onClose}
              hitSlop={theme.touch.hitSlop}
              accessibilityRole="button"
              accessibilityLabel={t('cancel')}
              style={({ pressed }) => pressed && styles.dim}
            >
              <AppIcon name="close" size={22} color="textSecondary" />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.actionsList}>
          {actions.map((a, i) => (
            <Pressable
              key={a.label}
              onPress={() => {
                onClose();
                a.onPress();
              }}
              disabled={a.loading}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              style={({ pressed }) => [
                styles.row,
                (pressed || a.loading) && styles.rowPressed,
              ]}
            >
              <View style={styles.iconCircle}>
                <AppIcon name={a.icon} size={20} color="primary" />
              </View>
              <AppText size="md" weight="semibold" style={styles.flex}>
                {a.label}
              </AppText>
              <AppIcon name="forward" size={16} color="textSecondary" />
            </Pressable>
          ))}
        </View>
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
      borderTopWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      ...theme.shadows.raised,
    },
    grabberArea: {
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      width: '100%',
    },
    grabber: {
      width: 44,
      height: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      marginBottom: theme.spacing.xs,
    },
    actionsList: {
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: theme.touch.minTarget,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
    },
    rowPressed: {
      backgroundColor: theme.colors.track,
      opacity: 0.8,
    },
    iconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dim: { opacity: 0.7 },
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
