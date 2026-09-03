import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppIcon } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/AssistantFab.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface AssistantFabProps {
  /** Distance from the bottom edge (keep clear of the floating tab bar). */
  bottom: number;
}

/**
 * The one way into the assistant from Home: a small accent button, bottom-
 * right, that springs in on mount and breathes a soft halo every few seconds
 * so it reads as alive without nagging. Honours reduced-motion.
 */
export function AssistantFab({ bottom }: AssistantFabProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);
  const reduceMotion = useReducedMotion();

  const enter = useSharedValue(0);
  const halo = useSharedValue(0);
  const press = useSharedValue(1);

  useEffect(() => {
    enter.value = withDelay(250, withSpring(1, { damping: 14, stiffness: 160 }));
    if (reduceMotion) return;
    // One breath (expand + fade) then a pause, forever.
    halo.value = withDelay(
      1200,
      withRepeat(
        withSequence(withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 0 }), withDelay(2600, withTiming(0, { duration: 0 }))),
        -1,
        false
      )
    );
  }, [enter, halo, reduceMotion]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: enter.value * press.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: (1 - halo.value) * 0.35,
    transform: [{ scale: 1 + halo.value * 0.9 }],
  }));

  return (
    <Animated.View style={[styles.anchor, { bottom }, wrapStyle]} pointerEvents="box-none">
      <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none" />
      <Pressable
        onPress={() => navigation.navigate('Assistant')}
        onPressIn={() => {
          press.value = withTiming(0.92, { duration: 90 });
        }}
        onPressOut={() => {
          press.value = withSpring(1, { damping: 12, stiffness: 220 });
        }}
        accessibilityRole="button"
        accessibilityLabel={t('assistantTitle')}
        style={styles.button}
      >
        <View>
          <AppIcon name="assistant" size={24} color="onAccent" />
        </View>
      </Pressable>
    </Animated.View>
  );
}
