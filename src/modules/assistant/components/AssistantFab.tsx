import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
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

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

interface AssistantFabProps {
  /** Distance from the bottom edge (keep clear of the floating tab bar). */
  bottom: number;
}

/**
 * The assistant orb — the one way into the assistant from Home. Two
 * multicolour sweeps rotate in opposite directions under a glassy sheen, a
 * soft glow breathes behind it, and the whole thing springs in on mount. Like
 * a voice-assistant orb, without a single bitmap. Honours reduced-motion
 * (static gradient, no breathing).
 */
export function AssistantFab({ bottom }: AssistantFabProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);
  const reduceMotion = useReducedMotion();

  const enter = useSharedValue(0);
  const spinA = useSharedValue(0);
  const spinB = useSharedValue(0);
  const breath = useSharedValue(0);
  const press = useSharedValue(1);

  useEffect(() => {
    enter.value = withDelay(250, withSpring(1, { damping: 14, stiffness: 160 }));
    if (reduceMotion) return;
    spinA.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
    spinB.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
    breath.value = withRepeat(
      withSequence(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) })),
      -1,
      false
    );
  }, [enter, spinA, spinB, breath, reduceMotion]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: enter.value * press.value }],
  }));
  const sweepAStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spinA.value * 360}deg` }] }));
  const sweepBStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spinB.value * 360}deg` }], opacity: 0.85 }));
  const glowNear = useAnimatedStyle(() => ({ opacity: 0.55 - breath.value * 0.2, transform: [{ scale: 1.15 + breath.value * 0.1 }] }));
  const glowFar = useAnimatedStyle(() => ({ opacity: 0.28 - breath.value * 0.12, transform: [{ scale: 1.45 + breath.value * 0.25 }] }));

  return (
    <Animated.View style={[styles.anchor, { bottom }, wrapStyle]} pointerEvents="box-none">
      <Animated.View style={[styles.glow, glowFar]} pointerEvents="none" />
      <Animated.View style={[styles.glow, glowNear]} pointerEvents="none" />
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
        style={styles.orb}
      >
        <AnimatedGradient colors={[...theme.gradients.orbA]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.sweep, sweepAStyle]} />
        <AnimatedGradient colors={[...theme.gradients.orbB]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.sweep, sweepBStyle]} />
        <View style={styles.sheen} pointerEvents="none" />
        <View style={styles.rim} pointerEvents="none" />
        <AppIcon name="assistant" size={24} color="onAccent" />
      </Pressable>
    </Animated.View>
  );
}
