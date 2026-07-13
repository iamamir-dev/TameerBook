import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppHeader, AppIcon, AppText, EmptyState } from '@/components/ui';
import { listPlotSummaries, type PlotStatus, type PlotSummary } from '@/db';
import { useFocusReload } from '@/hooks';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';
import { softToneColor, type ColorKey } from '@/utils/tones';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_LABEL: Record<PlotStatus, TranslationKey> = {
  OWNED: 'plotOwned',
  IN_PROJECT: 'plotInProject',
  SOLD: 'plotSold',
};

const STATUS_TONE: Record<PlotStatus, ColorKey> = {
  OWNED: 'success',
  IN_PROJECT: 'primary',
  SOLD: 'gold',
};

/** Plots list: one card per plot with the owner's card math, plus a FAB. */
export function PlotsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [items, setItems] = useState<PlotSummary[]>([]);

  const load = useCallback(async () => {
    setItems(await listPlotSummaries());
  }, []);

  useFocusReload(load);

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('plotsTitle')}
        rightAction={{
          icon: 'add',
          onPress: () => navigation.navigate('NewPlot'),
          accessibilityLabel: t('newPlot'),
        }}
      />

      {items.length === 0 ? (
        <EmptyState
          icon="plot"
          title={t('noPlotsYet')}
          message={t('noPlotsDetail')}
          actionLabel={t('newPlot')}
          actionIcon="add"
          onAction={() => navigation.navigate('NewPlot')}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + theme.spacing.xxxl },
          ]}
        >
          {items.map((item) => (
            <PlotCard
              key={item.plot.id}
              summary={item}
              onPress={() => navigation.navigate('PlotDetail', { plotId: item.plot.id })}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** One plot card, laid out exactly like the owner reads his notebook. */
function PlotCard({
  summary,
  onPress,
}: {
  summary: PlotSummary;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { plot, dealPrice, paidToSeller, remaining, expenses, totalCost } = summary;
  const tone = STATUS_TONE[plot.status];

  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconChip, { backgroundColor: softToneColor(theme, tone) }]}>
          <AppIcon name="plot" size={22} color={tone} />
        </View>
        <View style={styles.cardTitle}>
          <AppText size="md" weight="bold" numberOfLines={1}>
            {plot.name}
          </AppText>
          <View style={styles.badgeWrap}>
            <StageBadge tone={tone} label={t(STATUS_LABEL[plot.status])} />
          </View>
        </View>
        <AppIcon name="forward" size={20} color="textSecondary" />
      </View>

      <View style={styles.mathBlock}>
        <MathRow label={t('dealPrice')} value={formatRupees(dealPrice)} />
        <MathRow label={t('paidToSeller')} value={formatRupees(paidToSeller)} valueColor="success" />
        <MathRow label={t('remaining')} value={formatRupees(remaining)} />
        <MathRow label={t('plotExpensesLabel')} value={formatRupees(expenses)} />
        <View style={styles.divider} />
        <View style={styles.mathRow}>
          <AppText size="sm" weight="bold">
            {t('totalCostLabel')}
          </AppText>
          <AppText size="md" weight="bold" tabular>
            {formatRupees(totalCost)}
          </AppText>
        </View>
      </View>
    </AppCard>
  );
}

function MathRow({
  label,
  value,
  valueColor = 'textPrimary',
}: {
  label: string;
  value: string;
  valueColor?: ColorKey;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.mathRow}>
      <AppText size="sm" color="textSecondary">
        {label}
      </AppText>
      <AppText size="sm" weight="semibold" color={valueColor} tabular>
        {value}
      </AppText>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    card: { gap: theme.spacing.md },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    iconChip: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { flex: 1, gap: theme.spacing.xs },
    badgeWrap: { flexDirection: 'row' },
    mathBlock: { gap: theme.spacing.xs },
    mathRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
  });
