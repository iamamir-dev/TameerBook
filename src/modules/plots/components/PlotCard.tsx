import React from 'react';
import { View } from 'react-native';

import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppIcon, AppText } from '@/components/ui';
import { SIZE_UNIT_LABEL_KEYS, type PlotStatus, type PlotSummary } from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';
import { softToneColor, type ColorKey } from '@/utils/tones';

import { PlotSummaryRow } from './PlotSummaryRow';
import { makeStyles } from '../styled/PlotCard.styles';

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

interface Props {
  summary: PlotSummary;
  /** User-set display status (Settings → Statuses); null = none. */
  stageLabel: string | null;
  /** The status's own color; null = default lifecycle tone. */
  stageBadgeTone: ColorKey | null;
  onPress: () => void;
}

/** One plot card, laid out exactly like the owner reads his notebook. */
export function PlotCard({ summary, stageLabel, stageBadgeTone, onPress }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { plot, projectName, dealPrice, paidToSeller, remaining, expenses, totalCost } = summary;
  const tone = STATUS_TONE[plot.status];
  const subtitle = [plot.society, plot.block, plot.plot_no].filter(Boolean).join(' · ');
  const sizeText = plot.size_value ? `${plot.size_value} ${t(SIZE_UNIT_LABEL_KEYS[plot.size_unit ?? 'MARLA'])}` : null;

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
            <StageBadge
              tone={stageLabel && stageBadgeTone ? stageBadgeTone : tone}
              label={stageLabel ?? (plot.status === 'IN_PROJECT' && projectName ? projectName : t(STATUS_LABEL[plot.status]))}
            />
            {sizeText ? (
              <View style={[styles.sizePill, { backgroundColor: softToneColor(theme, 'gold') }]}>
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
        <PlotSummaryRow label={t('dealPrice')} value={formatRupees(dealPrice)} />
        <PlotSummaryRow label={t('paidToSeller')} value={formatRupees(paidToSeller)} valueColor="danger" />
        <PlotSummaryRow label={t('remaining')} value={formatRupees(remaining)} />
        <PlotSummaryRow label={t('plotExpensesLabel')} value={formatRupees(expenses)} valueColor="danger" />
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
