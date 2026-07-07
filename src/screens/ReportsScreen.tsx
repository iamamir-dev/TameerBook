import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, AppIcon, AppText, type IconKey } from '@/components/ui';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { ColorPalette, Theme } from '@/theme/theme';
import { softToneColor } from '@/utils/tones';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ReportType = RootStackParamList['Report']['type'];
type ColorKey = keyof ColorPalette;

const TILES: { type: ReportType; labelKey: TranslationKey; icon: IconKey; tone: ColorKey }[] = [
  { type: 'summary', labelKey: 'rptSummary', icon: 'projects', tone: 'primary' },
  { type: 'pnl', labelKey: 'rptPnl', icon: 'trendUp', tone: 'success' },
  { type: 'cashflow', labelKey: 'rptCashflow', icon: 'netFlow', tone: 'accent' },
  { type: 'expense', labelKey: 'rptExpense', icon: 'moneyOut', tone: 'danger' },
  { type: 'investment', labelKey: 'rptInvestment', icon: 'investors', tone: 'gold' },
  { type: 'roi', labelKey: 'rptRoi', icon: 'activity', tone: 'primary' },
  { type: 'accounts', labelKey: 'accountsTitle', icon: 'bank', tone: 'accent' },
];

export function ReportsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  return (
    <View style={styles.screen}>
      <AppHeader title={t('reports')} onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        <View style={styles.grid}>
          {TILES.map((tile) => (
            <Pressable
              key={tile.type}
              onPress={() => navigation.navigate('Report', { type: tile.type })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            >
              <View style={[styles.icon, { backgroundColor: softToneColor(theme, tile.tone) }]}>
                <AppIcon name={tile.icon} size={28} color={tile.tone} />
              </View>
              <AppText size="sm" weight="bold" center>
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
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
    tile: {
      width: '47%',
      flexGrow: 1,
      minHeight: 130,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
    },
    pressed: { opacity: 0.85 },
    icon: {
      width: 56,
      height: 56,
      borderRadius: theme.radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
