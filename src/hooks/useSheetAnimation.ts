import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const OPEN = { duration: 280, easing: Easing.bezier(0.16, 1, 0.3, 1) }; // gentle overshoot-free ease-out
const CLOSE = { duration: 200, easing: Easing.in(Easing.cubic) };

/**
 * Buttery bottom-sheet open/close on the UI thread: the backdrop fades and the
 * sheet slides up from below — no white/black flash, no dark-overlay wipe (the
 * problems with `Modal animationType="slide"`). Keep the `Modal` mounted while
 * closing so the exit animation can finish before it unmounts.
 *
 * Usage: `visible` drives it; render `<Modal visible={mounted} animationType="none">`,
 * put `backdropStyle` on the overlay `Animated.View` and `sheetStyle` on the sheet.
 */
export function useSheetAnimation(visible: boolean) {
  const { height } = useWindowDimensions();
  const progress = useSharedValue(0);
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

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * height }] }));

  return { mounted, backdropStyle, sheetStyle };
}
