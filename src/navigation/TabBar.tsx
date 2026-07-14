import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, AppText } from '@/components/ui';
import type { IconKey } from '@/components/ui';
import { useTranslation, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import type { RootStackParamList, TabParamList } from './types';

/** Map each tab route to its lucide icon + label translation key. */
const TAB_META: Record<keyof TabParamList, { icon: IconKey; labelKey: TranslationKey }> = {
  Home: { icon: 'home', labelKey: 'home' },
  Projects: { icon: 'projects', labelKey: 'projects' },
  Plots: { icon: 'plot', labelKey: 'plotsTitle' },
  Investors: { icon: 'investors', labelKey: 'investors' },
};

const FAB_SIZE = 48;
const BAR_HEIGHT = 64;

/**
 * Clearance (in px, excluding the bottom safe-area inset) that screens should
 * reserve at the bottom so content never hides behind the floating bar.
 */
export const FLOATING_BAR_CLEARANCE = BAR_HEIGHT + 32;

/**
 * A floating white pill tab bar. Every tab shows its icon with the tab name
 * beneath it; the active tab sits in a soft dark pill. A raised green "+" FAB
 * sits dead-center and opens Quick Entry. Driven by a swipeable (pager-backed)
 * tab navigator, so the bar tracks page swipes.
 */
export function TabBar({ state, navigation }: MaterialTopTabBarProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const mid = Math.ceil(state.routes.length / 2);
  const leftRoutes = state.routes.slice(0, mid);
  const rightRoutes = state.routes.slice(mid);

  const renderTab = (route: (typeof state.routes)[number]) => {
    const routeIndex = state.routes.findIndex((r) => r.key === route.key);
    const isFocused = state.index === routeIndex;
    const meta = TAB_META[route.name as keyof TabParamList];

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <TabItem
        key={route.key}
        icon={meta.icon}
        label={t(meta.labelKey)}
        focused={isFocused}
        onPress={onPress}
      />
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}
    >
      <View style={styles.bar}>
        <View style={styles.side}>{leftRoutes.map(renderTab)}</View>
        <View style={styles.fabSlot} />
        <View style={styles.side}>{rightRoutes.map(renderTab)}</View>
      </View>

      <Pressable
        onPress={() => rootNav.navigate('QuickEntry')}
        // Long-press jumps straight to the expense form — the most common entry.
        onLongPress={() => rootNav.navigate('Entry', { direction: 'OUT' })}
        accessibilityRole="button"
        accessibilityLabel={t('quickEntry')}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <AppIcon name="add" size={26} color="onAccent" strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

/* ------------------------------ tab item -------------------------------- */

interface TabItemProps {
  icon: IconKey;
  label: string;
  focused: boolean;
  onPress: () => void;
}

/**
 * A single tab: icon with its name beneath. The active one sits in a fully
 * rounded dark pill with an accent tick above the icon, so the selection
 * reads instantly without feeling heavy.
 */
function TabItem({ icon, label, focused, onPress }: TabItemProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={theme.touch.hitSlop}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={[styles.tab, focused && styles.tabActive]}
    >
      <View style={[styles.tick, focused && styles.tickActive]} />
      <AppIcon name={icon} size={20} color={focused ? 'onPrimary' : 'textSecondary'} />
      <AppText
        size="overline"
        weight={focused ? 'bold' : 'semibold'}
        color={focused ? 'onPrimary' : 'textSecondary'}
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: theme.spacing.lg,
      right: theme.spacing.lg,
      bottom: 0,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      height: BAR_HEIGHT,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.card,
      paddingHorizontal: theme.spacing.sm,
      ...theme.shadows.raised,
    },
    side: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    tab: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      minHeight: 52,
      minWidth: 66,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.pill,
    },
    tabActive: {
      backgroundColor: theme.colors.primary,
      ...theme.shadows.card,
    },
    /* tiny accent tick that lights up over the active icon */
    tick: {
      width: 14,
      height: 3,
      borderRadius: theme.radius.pill,
      backgroundColor: 'transparent',
      marginBottom: 1,
    },
    tickActive: {
      backgroundColor: theme.colors.accent,
    },
    label: {
      // keeps the tiny caption tight under the icon
      lineHeight: 13,
    },
    fabSlot: {
      width: FAB_SIZE + theme.spacing.lg,
    },
    fab: {
      position: 'absolute',
      alignSelf: 'center',
      top: -FAB_SIZE / 2 + theme.spacing.xs,
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.fab,
    },
    fabPressed: {
      opacity: 0.9,
    },
  });
