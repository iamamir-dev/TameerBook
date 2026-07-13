import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, AppIcon, AppText } from '@/components/ui';
import type { IconKey } from '@/components/ui';
import { categoryIdByName } from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
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

/** The quick-entry actions, in user-facing Roman Urdu terms. */
const TILES: Tile[] = [
  { labelKey: 'kharcha', icon: 'kharcha', tone: 'danger' },
  { labelKey: 'aamdani', icon: 'aamdani', tone: 'success' },
  { labelKey: 'material', icon: 'material', tone: 'primary' },
  { labelKey: 'transferTitleV2', icon: 'netFlow', tone: 'accent' },
  { labelKey: 'udhaar', icon: 'investor', tone: 'gold' },
  { labelKey: 'investor', icon: 'investor', tone: 'accent' },
  { labelKey: 'dehari', icon: 'dehari', tone: 'primary' },
  { labelKey: 'gharKharcha', icon: 'home', tone: 'danger' },
];

/**
 * Quick Entry launcher: one clean grid of color-coded tiles, each a soft-tinted
 * icon disc over its label. Tiles PUSH their screen (not replace), so the back
 * button returns here rather than skipping past to the dashboard.
 */
export function QuickEntryScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const openTile = (tile: Tile) => {
    if (tile.labelKey === 'kharcha') navigation.navigate('Entry', { direction: 'OUT' });
    else if (tile.labelKey === 'aamdani') navigation.navigate('Entry', { direction: 'IN' });
    else if (tile.labelKey === 'material') navigation.navigate('MaterialEntry');
    else if (tile.labelKey === 'transferTitleV2') navigation.navigate('Transfer');
    else if (tile.labelKey === 'udhaar') navigation.navigate('Udhaar');
    else if (tile.labelKey === 'investor') navigation.navigate('Investment');
    else if (tile.labelKey === 'dehari') navigation.navigate('Labor');
    else if (tile.labelKey === 'gharKharcha') {
      // Personal/home spending: an OUT entry pre-tagged with the Home Expense
      // category (created on first use).
      void (async () => {
        const catId = await categoryIdByName('Home Expense', 'EXPENSE', 'Ghar ka kharcha');
        navigation.navigate('Entry', { direction: 'OUT', prefill: { categoryId: catId } });
      })().catch(swallow('quickEntry:ghar'));
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('quickEntry')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {TILES.map((tile) => (
            <Pressable
              key={tile.labelKey}
              onPress={() => openTile(tile)}
              accessibilityRole="button"
              accessibilityLabel={t(tile.labelKey)}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            >
              <View style={[styles.tileIcon, { backgroundColor: softToneColor(theme, tile.tone) }]}>
                <AppIcon name={tile.icon} size={30} color={tile.tone} />
              </View>
              <AppText size="md" weight="bold" center numberOfLines={2}>
                {t(tile.labelKey)}
              </AppText>
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
  });
