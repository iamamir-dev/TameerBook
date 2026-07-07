import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppHeader, AppIcon, AppText } from '@/components/ui';
import type { ColorPalette } from '@/theme/theme';
import type { IconKey } from '@/components/ui';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ToneKey = keyof ColorPalette;

interface Tile {
  labelKey: TranslationKey;
  icon: IconKey;
  tone: ToneKey;
}

/** The six quick-entry actions, in user-facing Roman Urdu terms. */
const TILES: Tile[] = [
  { labelKey: 'kharcha', icon: 'kharcha', tone: 'danger' },
  { labelKey: 'aamdani', icon: 'aamdani', tone: 'success' },
  { labelKey: 'material', icon: 'material', tone: 'primary' },
  { labelKey: 'transferTitleV2', icon: 'netFlow', tone: 'accent' },
  { labelKey: 'udhaar', icon: 'investor', tone: 'gold' },
  { labelKey: 'investor', icon: 'investor', tone: 'accent' },
];

/**
 * Full-screen Quick Entry launcher. Six big, color-coded tiles  each well
 * above the 56px minimum  let a user start the right kind of entry with one
 * tap.
 */
export function QuickEntryScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);

  const openTile = (tile: Tile) => {
    if (tile.labelKey === 'kharcha') navigation.replace('Entry', { direction: 'OUT' });
    else if (tile.labelKey === 'aamdani') navigation.replace('Entry', { direction: 'IN' });
    else if (tile.labelKey === 'material') navigation.replace('MaterialEntry');
    else if (tile.labelKey === 'transferTitleV2') navigation.replace('Transfer');
    else if (tile.labelKey === 'udhaar') navigation.replace('Udhaar');
    else if (tile.labelKey === 'investor') navigation.replace('Investment');
    else navigation.replace('ComingSoon', { titleKey: tile.labelKey });
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('quickEntry')} onBack={() => navigation.goBack()} />

      <View style={styles.grid}>
        {TILES.map((tile) => {
          return (
            <Pressable
              key={tile.labelKey}
              onPress={() => openTile(tile)}
              accessibilityRole="button"
              accessibilityLabel={t(tile.labelKey)}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            >
              <View style={[styles.tileIcon, { backgroundColor: softFor(theme, tile.tone) }]}>
                <AppIcon name={tile.icon} size={32} color={tile.tone} />
              </View>
              <AppText size="md" weight="semibold" center>
                {t(tile.labelKey)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Soft background tint for a given tone, falling back to primary-soft. */
function softFor(theme: Theme, tone: ToneKey): string {
  switch (tone) {
    case 'success':
      return theme.colors.successSoft;
    case 'danger':
      return theme.colors.dangerSoft;
    case 'accent':
      return theme.colors.accentSoft;
    default:
      return theme.colors.primarySoft;
  }
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: theme.spacing.lg,
      padding: theme.spacing.lg,
    },
    tile: {
      width: '46%',
      flexGrow: 1,
      minHeight: 140,
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
    },
    tilePressed: {
      opacity: 0.85,
    },
    tileIcon: {
      width: 64,
      height: 64,
      borderRadius: theme.radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
