import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, AppIcon, AppText } from '@/components/ui';
import type { IconKey } from '@/components/ui';
import { categoryIdByName } from '@/db';
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
  aamdani: { labelKey: 'aamdani', icon: 'aamdani', tone: 'success' },
  material: { labelKey: 'material', icon: 'material', tone: 'primary' },
  transferTitleV2: { labelKey: 'transferTitleV2', icon: 'netFlow', tone: 'accent' },
  udhaar: { labelKey: 'udhaar', icon: 'investor', tone: 'gold' },
  investor: { labelKey: 'investor', icon: 'investor', tone: 'accent' },
  dehari: { labelKey: 'dehari', icon: 'dehari', tone: 'primary' },
  gharKharcha: { labelKey: 'gharKharcha', icon: 'home', tone: 'danger' },
};

/**
 * Quick Entry launcher: one clean grid of color-coded tiles the user can
 * REORDER (tap the reorder button, then use the ‹ › arrows on each tile; the
 * order is saved). Tiles PUSH their screen, so back returns here.
 */
export function QuickEntryScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const quickOrder = useSettingsStore((s) => s.quickOrder);
  const setQuickOrder = useSettingsStore((s) => s.setQuickOrder);
  const [editing, setEditing] = useState(false);

  // Resolve the saved order into concrete tiles (ignoring any stale keys).
  const tiles = useMemo(
    () => quickOrder.map((k) => TILES[k]).filter((x): x is Tile => Boolean(x)),
    [quickOrder]
  );

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= tiles.length) return;
    const order = [...quickOrder];
    [order[index], order[next]] = [order[next], order[index]];
    setQuickOrder(order);
  };

  const openTile = (tile: Tile) => {
    if (editing) return; // reorder mode: taps don't navigate
    if (tile.labelKey === 'kharcha') navigation.navigate('Entry', { direction: 'OUT' });
    else if (tile.labelKey === 'aamdani') navigation.navigate('Entry', { direction: 'IN' });
    else if (tile.labelKey === 'material') navigation.navigate('MaterialEntry');
    else if (tile.labelKey === 'transferTitleV2') navigation.navigate('Transfer');
    else if (tile.labelKey === 'udhaar') navigation.navigate('Udhaar');
    else if (tile.labelKey === 'investor') navigation.navigate('Investment');
    else if (tile.labelKey === 'dehari') navigation.navigate('Labor');
    else if (tile.labelKey === 'gharKharcha') {
      void (async () => {
        const catId = await categoryIdByName('Home Expense', 'EXPENSE', 'Ghar ka kharcha');
        navigation.navigate('Entry', { direction: 'OUT', prefill: { categoryId: catId } });
      })().catch(swallow('quickEntry:ghar'));
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('quickEntry')}
        onBack={() => navigation.goBack()}
        rightAction={{
          icon: editing ? 'check' : 'reorder',
          onPress: () => setEditing((e) => !e),
          accessibilityLabel: editing ? t('done') : t('reorderTiles'),
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {editing ? (
          <AppText size="sm" color="textSecondary" center style={styles.hint}>
            {t('reorderHint')}
          </AppText>
        ) : null}

        <View style={styles.grid}>
          {tiles.map((tile, index) => (
            <Pressable
              key={tile.labelKey}
              onPress={() => openTile(tile)}
              disabled={editing}
              accessibilityRole="button"
              accessibilityLabel={t(tile.labelKey)}
              style={({ pressed }) => [styles.tile, !editing && pressed && styles.tilePressed]}
            >
              <View style={[styles.tileIcon, { backgroundColor: softToneColor(theme, tile.tone) }]}>
                <AppIcon name={tile.icon} size={30} color={tile.tone} />
              </View>
              <AppText size="md" weight="bold" center numberOfLines={2}>
                {t(tile.labelKey)}
              </AppText>

              {editing ? (
                <View style={styles.moveRow}>
                  <Pressable
                    onPress={() => move(index, -1)}
                    disabled={index === 0}
                    hitSlop={theme.touch.hitSlop}
                    accessibilityRole="button"
                    style={[styles.moveBtn, index === 0 && styles.moveDisabled]}
                  >
                    <AppIcon name="back" size={18} color={index === 0 ? 'textSecondary' : 'primary'} />
                  </Pressable>
                  <Pressable
                    onPress={() => move(index, 1)}
                    disabled={index === tiles.length - 1}
                    hitSlop={theme.touch.hitSlop}
                    accessibilityRole="button"
                    style={[styles.moveBtn, index === tiles.length - 1 && styles.moveDisabled]}
                  >
                    <AppIcon name="forward" size={18} color={index === tiles.length - 1 ? 'textSecondary' : 'primary'} />
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.lg,
    },
    hint: {
      marginBottom: theme.spacing.md,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: theme.spacing.lg,
    },
    tile: {
      width: '48%',
      minHeight: 130,
      borderRadius: theme.radius.hero,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
      ...theme.shadows.card,
    },
    tilePressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },
    tileIcon: {
      width: 62,
      height: 62,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moveRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    moveBtn: {
      width: 40,
      height: 34,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moveDisabled: { opacity: 0.4 },
  });
