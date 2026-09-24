import { createContext, useContext } from 'react';
import { FadeInUp, type EntryExitAnimationFunction } from 'react-native-reanimated';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * ONE MOTION LANGUAGE FOR A TURN.
 *
 * A reply is not one object: it is a sentence, then a card, then the chips.
 * Animating only the sentence made the card underneath pop in half a beat
 * later, which read as a glitch. Everything in a turn now rises into place
 * with the same short curve, staggered in reading order, so the eye follows
 * the answer down the screen.
 *
 * Durations stay short because the target phones are slow: motion should be
 * felt, not waited for. Reduced motion removes it entirely.
 */

/** Rise-and-fade, the only entrance the chat uses. */
const DURATION = 200;
/** Gap between the pieces of one reply (sentence → card → chips). */
const STAGGER = 60;

export type Entering = ReturnType<typeof FadeInUp.duration> | EntryExitAnimationFunction | undefined;

/**
 * Whether the pieces inside may animate in. Turns restored from the saved
 * chat mount all at once; on the new architecture an entering animation on
 * those left cards laid out but unpainted until the next scroll. They were
 * already there when the user arrived, so they do not need an entrance.
 */
export const MotionContext = createContext(true);

/**
 * The entrance for the `step`-th piece of a turn (0 = the sentence).
 * `undefined` when the user asked for reduced motion, so nothing moves.
 */
export function useEnter(step = 0): Entering {
  const still = useReducedMotion();
  const allowed = useContext(MotionContext);
  if (still || !allowed) return undefined;
  return FadeInUp.duration(DURATION).delay(step * STAGGER);
}
