import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { makeStyles } from '../styled/ThinkingBubble.styles';

interface ThinkingBubbleProps {
  /** What is happening right now; read by screen readers only. */
  status?: string;
}

/** One dot: fades between dim and bright on a stagger, WhatsApp style (no bounce). */
function Dot({ index, still }: { index: number; still: boolean }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const v = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    v.value = withDelay(
      index * 200,
      withRepeat(withSequence(withTiming(1, { duration: 300, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 300, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 600 })), -1, false)
    );
  }, [v, index, still]);
  const style = useAnimatedStyle(() => ({ opacity: 0.3 + 0.7 * v.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

/**
 * The assistant's typing bubble: three grey dots blinking in turn, nothing
 * else, the way WhatsApp shows "typing". Fades in and out so it never pops;
 * honours reduced motion (dots stay still).
 */
export function ThinkingBubble({ status }: ThinkingBubbleProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const still = useReducedMotion();
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.bubble} accessibilityRole="progressbar" accessibilityLabel={status}>
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} index={i} still={still} />
        ))}
      </View>
    </Animated.View>
  );
}
