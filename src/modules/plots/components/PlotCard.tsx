import React from 'react';
import { View } from 'react-native';

import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppIcon, AppText } from '@/components/ui';
import { SIZE_UNIT_LABEL_KEYS, type PlotSummary } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';
import { softToneColor } from '@/utils/tones';

import { PlotSummaryRow } from './PlotSummaryRow';
import { plotStatusMeta } from '../utils/status';
import { makeStyles } from '../styled/PlotCard.styles';

interface Props {
  summary: PlotSummary;
  onPress: () => void;
}

/** One plot card, laid out exactly like the owner reads his notebook. The title
 *  IS the plot's address; its status is auto-derived from the deal/sale state. */
export function PlotCard({ summary, onPress }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { plot, projectName, dealPrice, paidToSeller, remaining, expenses, totalCost } = summary;
  const { tone, labelKey } = plotStatusMeta(summary);
  // In a project we show the project's name on the badge instead of "In project".
  const badgeLabel = plot.status === 'IN_PROJECT' && projectName ? projectName : t(labelKey);
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
          <View style={styles.badgeWrap}>
            <StageBadge tone={tone} label={badgeLabel} />
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
