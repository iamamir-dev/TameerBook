import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, AppIcon, AppText, SelectSheet } from '@/components/ui';
import type { IconKey } from '@/components/ui';
import { categoryIdByName, listPlots, listProjects, type PlotRow, type ProjectRow } from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { softToneColor, type ColorKey } from '@/utils/tones';
import { swallow } from '@/utils/log';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Tile {
  labelKey: TranslationKey;
  icon: IconKey;
  tone: ColorKey;
}

/** The quick-entry actions, keyed by labelKey (order comes from settings). */
const TILES: Record<string, Tile> = {
  kharcha: { labelKey: 'kharcha', icon: 'kharcha', tone: 'danger' },
  // Keyed 'aamdani' so saved orders keep working; the tile is the Payment In
  // hub — it asks WHERE the money is from and routes to the right flow.
  aamdani: { labelKey: 'paymentIn', icon: 'aamdani', tone: 'success' },
  material: { labelKey: 'material', icon: 'material', tone: 'primary' },
  booking: { labelKey: 'bookingTile', icon: 'truck', tone: 'gold' },
  transferTitleV2: { labelKey: 'transferTitleV2', icon: 'netFlow', tone: 'accent' },
  udhaar: { labelKey: 'udhaar', icon: 'ledger', tone: 'gold' },
  investor: { labelKey: 'investor', icon: 'investor', tone: 'accent' },
  dehari: { labelKey: 'dehari', icon: 'dehari', tone: 'primary' },
  gharKharcha: { labelKey: 'gharKharcha', icon: 'home', tone: 'danger' },
};

const COLS = 2;
const TILE_H = 140;

/** Shift-reorder a {key:index} map when an item moves from → to (worklet). */
function shiftPositions(
  obj: Record<string, number>,
  from: number,
  to: number
): Record<string, number> {
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

/**
 * Quick Entry launcher: a grid of color-coded tiles. Tap a tile to open it;
 * LONG-PRESS then drag to reorder (like moving app icons) — the new order is
 * saved to settings. Tiles PUSH their screen, so Back returns here.
 */
export function QuickEntryScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const quickOrder = useSettingsStore((s) => s.quickOrder);
  const setQuickOrder = useSettingsStore((s) => s.setQuickOrder);

  // Only keys that map to a real tile, in saved order.
  const keys = useMemo(() => quickOrder.filter((k) => TILES[k]), [quickOrder]);

  // Payment In hub: chooser → the correct existing flow (one write-path per
  // money type). Project/plot receipts need a target, so two small pickers.
  const [payInOpen, setPayInOpen] = useState(false);
  const [projectPick, setProjectPick] = useState<ProjectRow[] | null>(null);
  const [plotPick, setPlotPick] = useState<PlotRow[] | null>(null);

  const onPaymentSource = useCallback(
    (source: string) => {
      setPayInOpen(false);
      if (source === 'investor') navigation.navigate('Investment');
      else if (source === 'udhaarReturn') navigation.navigate('Udhaar');
      else if (source === 'otherIncome') navigation.navigate('Entry', { direction: 'IN' });
      else if (source === 'projectSale') {
        listProjects()
          .then((rows) => setProjectPick(rows.filter((p) => p.status === 'ACTIVE')))
          .catch(swallow('quickEntry:projects'));
      } else if (source === 'plotSale') {
        // Standalone sale: a plot that isn't in a project and isn't sold yet.
        listPlots()
          .then((rows) => setPlotPick(rows.filter((p) => !p.project_id && p.status !== 'SOLD')))
          .catch(swallow('quickEntry:plots'));
      }
    },
    [navigation]
  );

  const openKey = useCallback(
    (key: string) => {
      if (key === 'kharcha') navigation.navigate('Entry', { direction: 'OUT' });
      else if (key === 'aamdani') setPayInOpen(true);
      else if (key === 'material') navigation.navigate('MaterialEntry');
      else if (key === 'booking') navigation.navigate('Bookings');
      else if (key === 'transferTitleV2') navigation.navigate('Transfer');
      else if (key === 'udhaar') navigation.navigate('Udhaar');
      else if (key === 'investor') navigation.navigate('Investment');
      else if (key === 'dehari') navigation.navigate('Labor');
      else if (key === 'gharKharcha') {
        void (async () => {
          const catId = await categoryIdByName('Home Expense', 'EXPENSE', 'گھر کا خرچ', true);
          navigation.navigate('Entry', { direction: 'OUT', prefill: { categoryId: catId } });
        })().catch(swallow('quickEntry:ghar'));
      }
    },
    [navigation]
  );

  const [gridW, setGridW] = useState(0);
  const gap = theme.spacing.lg;
  const cellW = gridW > 0 ? (gridW - gap) / COLS : 0;
  const rowH = TILE_H + gap;
  const gridH = Math.ceil(keys.length / COLS) * rowH;

  // Shared source of truth for tile positions (key → index).
  const positions = useSharedValue<Record<string, number>>(
    Object.fromEntries(keys.map((k, i) => [k, i]))
  );
  useEffect(() => {
    positions.value = Object.fromEntries(keys.map((k, i) => [k, i]));
  }, [keys, positions]);

  const commitOrder = useCallback(
    (map: Record<string, number>) => {
      const ordered = Object.keys(map).sort((a, b) => map[a] - map[b]);
      // Preserve any stale keys that aren't tiles (kept at the end).
      const stale = quickOrder.filter((k) => !TILES[k]);
      setQuickOrder([...ordered, ...stale]);
    },
    [quickOrder, setQuickOrder]
  );

  return (
    <View style={styles.screen}>
      <AppHeader title={t('quickEntry')} onBack={() => navigation.goBack()} />

      <View style={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}>
        <AppText size="sm" color="textSecondary" center style={styles.hint}>
          {t('reorderHint')}
        </AppText>

        <View style={{ height: gridH }} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
          {cellW > 0
            ? keys.map((key) => (
                <DraggableTile
                  key={key}
                  itemKey={key}
                  tile={TILES[key]}
                  positions={positions}
                  count={keys.length}
                  cellW={cellW}
                  gap={gap}
                  rowH={rowH}
                  onOpen={openKey}
                  onCommit={commitOrder}
                  styles={styles}
                  theme={theme}
                  label={t(TILES[key].labelKey)}
                />
              ))
            : null}
        </View>
      </View>

      {/* Payment In: where is this money from? */}
      <SelectSheet
        visible={payInOpen}
        onClose={() => setPayInOpen(false)}
        title={t('paymentFromTitle')}
        searchable={false}
        options={[
          { id: 'investor', label: t('fromInvestor'), icon: 'investor' },
          { id: 'projectSale', label: t('fromProjectSale'), icon: 'project' },
          { id: 'plotSale', label: t('fromPlotSale'), icon: 'plot' },
          { id: 'udhaarReturn', label: t('fromUdhaarReturn'), icon: 'ledger' },
          { id: 'otherIncome', label: t('otherIncomeLabel'), icon: 'aamdani' },
        ]}
        onSelect={(o) => onPaymentSource(o.id)}
      />

      {/* Which project's sale is the buyer paying? */}
      <SelectSheet
        visible={projectPick !== null}
        onClose={() => setProjectPick(null)}
        title={t('selectProject')}
        options={(projectPick ?? []).map((p) => ({ id: p.id, label: p.name, icon: 'project' as const }))}
        onSelect={(o) => {
          setProjectPick(null);
          navigation.navigate('SaleDetail', { projectId: o.id });
        }}
      />

      {/* Which plot's buyer is paying? */}
      <SelectSheet
        visible={plotPick !== null}
        onClose={() => setPlotPick(null)}
        title={t('selectPlot')}
        options={(plotPick ?? []).map((p) => ({
          id: p.id,
          label: p.name,
          subtitle: p.society ?? undefined,
          icon: 'plot' as const,
        }))}
        onSelect={(o) => {
          setPlotPick(null);
          navigation.navigate('PlotDetail', { plotId: o.id });
        }}
      />
    </View>
  );
}

interface DraggableTileProps {
  itemKey: string;
  tile: Tile;
  positions: ReturnType<typeof useSharedValue<Record<string, number>>>;
  count: number;
  cellW: number;
  gap: number;
  rowH: number;
  onOpen: (key: string) => void;
  onCommit: (map: Record<string, number>) => void;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
  label: string;
}

function DraggableTile({
  itemKey,
  tile,
  positions,
  count,
  cellW,
  gap,
  rowH,
  onOpen,
  onCommit,
  styles,
  theme,
  label,
}: DraggableTileProps): React.JSX.Element {
  const active = useSharedValue(false);
  const startIndex = positions.value[itemKey] ?? 0;
  const tx = useSharedValue((startIndex % COLS) * (cellW + gap));
  const ty = useSharedValue(Math.floor(startIndex / COLS) * rowH);
  // Pixel origin captured at long-press; the tile then follows the finger from
  // HERE (not from its live index, which shifts as other tiles move — that was
  // what made it jump to random spots).
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // While not being dragged, glide to the slot dictated by `positions`.
  useAnimatedReaction(
    () => positions.value[itemKey],
    (index) => {
      if (index == null || active.value) return;
      tx.value = withSpring((index % COLS) * (cellW + gap));
      ty.value = withSpring(Math.floor(index / COLS) * rowH);
    }
  );

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      active.value = true;
      const idx = positions.value[itemKey];
      startX.value = (idx % COLS) * (cellW + gap);
      startY.value = Math.floor(idx / COLS) * rowH;
    })
    .onUpdate((e) => {
      // Follow the finger from the fixed pickup origin.
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
      const col = Math.max(0, Math.min(COLS - 1, Math.round(tx.value / (cellW + gap))));
      const row = Math.max(0, Math.round(ty.value / rowH));
      const target = Math.max(0, Math.min(count - 1, row * COLS + col));
      const idx = positions.value[itemKey];
      if (target !== idx) positions.value = shiftPositions(positions.value, idx, target);
    })
    .onEnd(() => {
      const idx = positions.value[itemKey];
      tx.value = withSpring((idx % COLS) * (cellW + gap));
      ty.value = withSpring(Math.floor(idx / COLS) * rowH);
      active.value = false;
      runOnJS(onCommit)(positions.value);
    });

  const tap = Gesture.Tap()
    .maxDuration(220)
    .onEnd((_e, success) => {
      if (success) runOnJS(onOpen)(itemKey);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: withTiming(active.value ? 1.06 : 1, { duration: 140 }) },
    ],
    zIndex: active.value ? 20 : 0,
    shadowOpacity: active.value ? 0.25 : 0,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.tileWrap, { width: cellW, height: TILE_H }, animStyle]}>
        <View style={styles.tile}>
          <View style={[styles.tileIcon, { backgroundColor: softToneColor(theme, tile.tone) }]}>
            <AppIcon name={tile.icon} size={30} color={tile.tone} />
          </View>
          <AppText size="md" weight="bold" center numberOfLines={2}>
            {label}
          </AppText>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { flex: 1, padding: theme.spacing.lg },
    hint: { marginBottom: theme.spacing.md },
    tileWrap: { position: 'absolute', top: 0, left: 0 },
    tile: {
      flex: 1,
      borderRadius: theme.radius.hero,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      ...theme.shadows.card,
    },
    tileIcon: {
      width: 62,
      height: 62,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
