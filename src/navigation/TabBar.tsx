import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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
  Reports: { icon: 'reports', labelKey: 'reports' },
  Investors: { icon: 'investors', labelKey: 'investors' },
};

const FAB_SIZE = 48;
const BAR_HEIGHT = 56;

/**
 * Clearance (in px, excluding the bottom safe-area inset) that screens should
 * reserve at the bottom so content never hides behind the floating bar.
 */
export const FLOATING_BAR_CLEARANCE = BAR_HEIGHT + 32;

/**
 * A floating white pill tab bar. The active tab morphs into a dark pill with
 * an icon + label (200ms Reanimated expand); inactive tabs are a grey icon
 * only. A raised green "+" FAB sits dead-center and opens Quick Entry. Driven
 * by a swipeable (pager-backed) tab navigator, so the bar tracks page swipes.
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

/** A single tab that animates between "icon only" and "dark pill + label". */
function TabItem({ icon, label, focused, onPress }: TabItemProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const progress = useSharedValue(focused ? 1 : 0);
  const [labelWidth, setLabelWidth] = useState(0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: 200 });
  }, [focused, progress]);

  const labelStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [0, labelWidth]),
    opacity: progress.value,
    marginLeft: interpolate(progress.value, [0, 1], [0, theme.spacing.xs]),
  }));

  const onLabelLayout = (e: LayoutChangeEvent) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    if (w && w !== labelWidth) setLabelWidth(w);
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={theme.touch.hitSlop}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={[styles.tab, focused && styles.tabActive]}
    >
      <AppIcon name={icon} size={22} color={focused ? 'onPrimary' : 'textSecondary'} />
      <Animated.View style={[styles.labelClip, labelStyle]}>
        <AppText
          size="xs"
          weight="semibold"
          color="onPrimary"
          numberOfLines={1}
          style={styles.labelText}
        >
          {label}
        </AppText>
      </Animated.View>

      {/* Hidden copy used only to measure the label's natural width. */}
      <AppText
        size="xs"
        weight="semibold"
        numberOfLines={1}
        onLayout={onLabelLayout}
        style={styles.measure}
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
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 44,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radius.pill,
    },
    tabActive: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.md,
    },
    labelClip: {
      overflow: 'hidden',
    },
    labelText: {
      // keeps the clipped label on one line during the width animation
    },
    measure: {
      position: 'absolute',
      opacity: 0,
      left: 0,
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
