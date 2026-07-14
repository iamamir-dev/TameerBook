import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppHeader, AppIcon, AppText, EmptyState, SearchBar } from '@/components/ui';
import { listPlotSummaries, listStages, SIZE_UNIT_LABEL_KEYS, type PlotStatus, type PlotSummary, type StageRow } from '@/db';
import { useFocusReload } from '@/hooks';
import { useTranslation, type TranslationKey } from '@/i18n';
import { FLOATING_BAR_CLEARANCE } from '@/navigation/TabBar';
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
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [items, setItems] = useState<PlotSummary[]>([]);
  const [stages, setStages] = useState<StageRow[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setItems(await listPlotSummaries());
    setStages(await listStages('PLOT'));
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
          bottomInset={insets.bottom + FLOATING_BAR_CLEARANCE}
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
          {items.length > 5 ? <SearchBar value={query} onChange={setQuery} /> : null}
          {items
            .filter((it) => {
              const q = query.trim().toLowerCase();
              if (!q) return true;
              return (
                it.plot.name.toLowerCase().includes(q) ||
                (it.plot.society ?? '').toLowerCase().includes(q)
              );
            })
            .map((item) => (
            <PlotCard
              key={item.plot.id}
              summary={item}
              stageLabel={(() => {
                const st = stages.find((x) => x.id === item.plot.stage_id);
                return st ? (language === 'ur' ? st.name_ur : st.name_en) : null;
              })()}
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
  stageLabel,
  onPress,
}: {
  summary: PlotSummary;
  /** User-set display status (Settings → Statuses); null = none. */
  stageLabel: string | null;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { plot, dealPrice, paidToSeller, remaining, expenses, totalCost } = summary;
  const tone = STATUS_TONE[plot.status];
  const subtitle = [plot.society, plot.block, plot.plot_no].filter(Boolean).join(' · ');
  const sizeText = plot.size_value
    ? `${plot.size_value} ${t(SIZE_UNIT_LABEL_KEYS[plot.size_unit ?? 'MARLA'])}`
    : null;

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
          {subtitle ? (
            <AppText size="xs" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
          <View style={styles.badgeWrap}>
            <StageBadge tone={tone} label={stageLabel ?? t(STATUS_LABEL[plot.status])} />
            {sizeText ? (
              <View style={styles.sizePill}>
                <AppIcon name="plot" size={12} color="gold" />
                <AppText size="xs" weight="bold" color="gold">
                  {sizeText}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
        <AppIcon name="forward" size={20} color="textSecondary" />
      </View>

      <View style={styles.mathBlock}>
        <MathRow label={t('dealPrice')} value={formatRupees(dealPrice)} />
        <MathRow label={t('paidToSeller')} value={formatRupees(paidToSeller)} valueColor="danger" />
        <MathRow label={t('remaining')} value={formatRupees(remaining)} />
        <MathRow label={t('plotExpensesLabel')} value={formatRupees(expenses)} valueColor="danger" />
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
    badgeWrap: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, flexWrap: 'wrap' },
    sizePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingVertical: 2,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      backgroundColor: softToneColor(theme, 'gold'),
    },
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
