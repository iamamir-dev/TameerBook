import { useEffect, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// One calm curve for EVERY drawer/dropdown/modal, both directions: ease-in-out
// quad — soft start, soft landing, and long enough that the mid-animation
// velocity never reads as a jump.
const OPEN = { duration: 380, easing: Easing.inOut(Easing.quad) };
const CLOSE = { duration: 320, easing: Easing.inOut(Easing.quad) };

/**
 * Buttery bottom-sheet open/close on the UI thread: the backdrop fades and the
 * sheet slides up from below — no white/black flash, no dark-overlay wipe (the
 * problems with `Modal animationType="slide"`). Keep the `Modal` mounted while
 * closing so the exit animation can finish before it unmounts.
 *
 * Usage: `visible` drives it; render `<Modal visible={mounted} animationType="none">`,
 * put `backdropStyle` on the overlay `Animated.View` and `sheetStyle` +
 * `onLayout={onSheetLayout}` on the sheet. `onSheetLayout` matters for smooth
 * motion: it makes the slide distance the sheet's OWN height, so a short
 * drawer glides in at the same gentle speed as a tall one instead of flying
 * across the whole screen. Centered dialogs use `dialogStyle` (fade + settle)
 * instead of the slide.
 */
export function useSheetAnimation(visible: boolean) {
  const { height } = useWindowDimensions();
  const progress = useSharedValue(0);
  const sheetH = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, OPEN);
    } else {
      progress.value = withTiming(0, CLOSE, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onSheetLayout = (e: LayoutChangeEvent) => {
    sheetH.value = e.nativeEvent.layout.height;
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  // Slide by the measured sheet height (+ a shadow margin) once known; the
  // full screen height is only the first-frame fallback.
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * (sheetH.value > 0 ? sheetH.value + 24 : height) }],
  }));
  // Centered dialogs (date picker, confirms): fade + a gentle settle-in scale.
  const dialogStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.96 + progress.value * 0.04 }],
  }));

  return { mounted, backdropStyle, sheetStyle, dialogStyle, onSheetLayout };
}
