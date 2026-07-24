import React from 'react';
import { Pressable, View } from 'react-native';

import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppIcon, AppText } from '@/components/ui';
import { SIZE_UNIT_LABEL_KEYS, type PlotSummary, type ProjectRow } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { PlotSummaryRow } from './PlotSummaryRow';
import { plotStatusMeta } from '../utils/status';
import { makeStyles } from '../styled/PlotHeroCard.styles';

interface Props {
  summary: PlotSummary;
  linkedProject: ProjectRow | null;
  onOpenProject: () => void;
}

/** The plot's cost-math hero: auto status, total cost, size, the deal
 *  breakdown, and (when included) a tap-through to its project. */
export function PlotHeroCard({ summary, linkedProject, onOpenProject }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { plot, dealPrice, paidToSeller, remaining, expenses, totalCost } = summary;
  const { tone, labelKey } = plotStatusMeta(summary);
  const sizeText = plot.size_value ? `${plot.size_value} ${t(SIZE_UNIT_LABEL_KEYS[plot.size_unit ?? 'MARLA'])}` : null;

  return (
    <AppCard style={styles.hero}>
      <View style={styles.badgeRow}>
        <StageBadge tone={tone} label={t(labelKey)} />
      </View>
      <AppText size="overline" weight="bold" color="textSecondary" uppercase>
        {t('totalCostLabel')}
      </AppText>
      <AppText size="display" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
        {formatRupees(totalCost)}
      </AppText>
      {sizeText ? (
        <AppText size="sm" color="textSecondary" numberOfLines={1}>
          {sizeText}
        </AppText>
      ) : null}

      <View style={styles.divider} />
      <PlotSummaryRow label={t('dealPrice')} value={formatRupees(dealPrice)} />
      <PlotSummaryRow label={t('paidToSeller')} value={formatRupees(paidToSeller)} valueColor="danger" />
      <PlotSummaryRow label={t('remaining')} value={formatRupees(remaining)} />
      <PlotSummaryRow label={t('plotExpensesLabel')} value={formatRupees(expenses)} valueColor="danger" />

      {plot.project_id ? (
        <>
          <View style={styles.divider} />
          <Pressable
            onPress={onOpenProject}
            accessibilityRole="button"
            style={({ pressed }) => [styles.linkRow, pressed && styles.pressedDim]}
          >
            <AppIcon name="project" size={20} color="primary" />
            <AppText size="sm" weight="bold" style={styles.flex} numberOfLines={1}>
              {linkedProject?.name ?? t('plotInProject')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>
        </>
      ) : null}
    </AppCard>
  );
}
