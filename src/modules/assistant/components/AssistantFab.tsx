import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

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
 * The way into the assistant from Home: one solid charcoal circle with the
 * magic wand, springing in on mount and dipping on press. No gradients, no
 * glow: the wand is the whole message.
 */
export function AssistantFab({ bottom }: AssistantFabProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);

  const enter = useSharedValue(0);
  const press = useSharedValue(1);
  useEffect(() => {
    enter.value = withDelay(250, withSpring(1, { damping: 14, stiffness: 160 }));
  }, [enter]);
  const wrapStyle = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ scale: enter.value * press.value }] }));

  return (
    <Animated.View style={[styles.anchor, { bottom }, wrapStyle]} pointerEvents="box-none">
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
        <AppIcon name="assistant" size={26} color="onPrimary" strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}
