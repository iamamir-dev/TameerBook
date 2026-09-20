import React from 'react';
import Animated from 'react-native-reanimated';

import { useEnter } from '../utils/motion';

/**
 * One piece of a reply (a card, a choice list, a confirmation) entering on the
 * turn's shared curve, a beat after the piece before it. Keeps the sentence,
 * the card and the chips reading as one arrival instead of three pop-ins.
 */
export function TurnPiece({ step, children }: { step: number; children: React.ReactNode }): React.JSX.Element {
  return <Animated.View entering={useEnter(step)}>{children}</Animated.View>;
}
