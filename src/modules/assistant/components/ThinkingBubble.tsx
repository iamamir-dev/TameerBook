import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/ThinkingBubble.styles';

interface ThinkingBubbleProps {
  /** What is happening right now ("Checking · purchase orders"). */
  status: string;
}

/** One dot of the typing indicator, bouncing on a stagger. */
function Dot({ index, still }: { index: number; still: boolean }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const v = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    v.value = withDelay(
      index * 160,
      withRepeat(withSequence(withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }), withTiming(0, { duration: 320 })), -1, false)
    );
  }, [v, index, still]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 * v.value }],
    opacity: 0.45 + 0.55 * v.value,
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

/**
 * The assistant's "typing" bubble: three bouncing dots plus a quiet status
 * line that follows the agent (thinking → checking <tool> → writing). Fades in
 * and out so it never pops. Honours reduced-motion (dots stay still).
 */
export function ThinkingBubble({ status }: ThinkingBubbleProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const still = useReducedMotion();
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.bubble}>
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} index={i} still={still} />
        ))}
      </View>
      <AppText size="xs" color="textSecondary" numberOfLines={1} style={styles.status}>
        {status}
      </AppText>
    </Animated.View>
  );
}
