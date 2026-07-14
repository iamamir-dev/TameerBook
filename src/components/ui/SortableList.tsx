import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Shift a {key:index} map when an item moves from → to (worklet). */
function shift(obj: Record<string, number>, from: number, to: number): Record<string, number> {
  'worklet';
  const next: Record<string, number> = {};
  for (const key in obj) {
    const p = obj[key];
    if (p === from) next[key] = to;
    else if (from < to && p > from && p <= to) next[key] = p - 1;
    else if (from > to && p < from && p >= to) next[key] = p + 1;
    else next[key] = p;
  }
  return next;
}

interface SortableListProps<T> {
  items: T[];
  keyOf: (item: T) => string;
  /** Fixed row height (incl. its own margin) — rows are absolutely positioned. */
  rowHeight: number;
  renderItem: (item: T) => React.ReactNode;
  onReorder: (orderedIds: string[]) => void;
}

/**
 * A vertical long-press-drag reorder list (like moving items on a phone). Rows
 * are fixed-height and absolutely positioned; long-press a row to pick it up,
 * drag, and the rest reflow. Persisted order is handed back via `onReorder`.
 */
export function SortableList<T>({ items, keyOf, rowHeight, renderItem, onReorder }: SortableListProps<T>) {
  const ids = items.map(keyOf);
  const positions = useSharedValue<Record<string, number>>(
    Object.fromEntries(ids.map((id, i) => [id, i]))
  );
  React.useEffect(() => {
    positions.value = Object.fromEntries(items.map((it, i) => [keyOf(it), i]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const commit = React.useCallback(
    (map: Record<string, number>) => onReorder(Object.keys(map).sort((a, b) => map[a] - map[b])),
    [onReorder]
  );

  return (
    <View style={{ height: items.length * rowHeight }}>
      {items.map((item) => (
        <Row
          key={keyOf(item)}
          id={keyOf(item)}
          positions={positions}
          count={items.length}
          rowHeight={rowHeight}
          onCommit={commit}
        >
          {renderItem(item)}
        </Row>
      ))}
    </View>
  );
}

interface RowProps {
  id: string;
  positions: SharedValue<Record<string, number>>;
  count: number;
  rowHeight: number;
  onCommit: (map: Record<string, number>) => void;
  children: React.ReactNode;
}

function Row({ id, positions, count, rowHeight, onCommit, children }: RowProps): React.JSX.Element {
  const active = useSharedValue(false);
  const y = useSharedValue((positions.value[id] ?? 0) * rowHeight);
  const startY = useSharedValue(0);

  useAnimatedReaction(
    () => positions.value[id],
    (index) => {
      if (index == null || active.value) return;
      y.value = withSpring(index * rowHeight);
    }
  );

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      active.value = true;
      startY.value = (positions.value[id] ?? 0) * rowHeight;
    })
    .onUpdate((e) => {
      y.value = startY.value + e.translationY;
      const target = Math.max(0, Math.min(count - 1, Math.round(y.value / rowHeight)));
      const idx = positions.value[id];
      if (target !== idx) positions.value = shift(positions.value, idx, target);
    })
    .onEnd(() => {
      y.value = withSpring((positions.value[id] ?? 0) * rowHeight);
      active.value = false;
      runOnJS(onCommit)(positions.value);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scale: withTiming(active.value ? 1.03 : 1, { duration: 120 }) }],
    zIndex: active.value ? 20 : 0,
    opacity: withTiming(active.value ? 0.95 : 1, { duration: 120 }),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.row, { height: rowHeight }, style]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', left: 0, right: 0, top: 0, justifyContent: 'center' },
});
