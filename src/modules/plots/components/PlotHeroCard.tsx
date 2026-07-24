import React from 'react';
import { Pressable, View } from 'react-native';

import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppIcon, AppText } from '@/components/ui';
import { SIZE_UNIT_LABEL_KEYS, type PlotSummary, type ProjectRow, type StageRow } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';
import { softToneColor, stageTone, type ColorKey } from '@/utils/tones';

import { PlotSummaryRow } from './PlotSummaryRow';
import { makeStyles } from '../styled/PlotHeroCard.styles';

interface Props {
  summary: PlotSummary;
  /** The plot's current display status row (Settings → Statuses), or null. */
  stage: StageRow | null;
  readOnly: boolean;
  onPressStage: () => void;
  linkedProject: ProjectRow | null;
  onOpenProject: () => void;
}

/** The plot's cost-math hero: total cost, location, status pill, the deal
 *  breakdown, and (when included) a tap-through to its project. */
export function PlotHeroCard({ summary, stage, readOnly, onPressStage, linkedProject, onOpenProject }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const styles = makeStyles(theme);
  const { plot, dealPrice, paidToSeller, remaining, expenses, totalCost } = summary;
  const sold = plot.status === 'SOLD';
  const sizeText = plot.size_value ? `${plot.size_value} ${t(SIZE_UNIT_LABEL_KEYS[plot.size_unit ?? 'MARLA'])}` : null;
  const location = [plot.society, plot.block, plot.plot_no, sizeText].filter(Boolean).join(' · ');
  const tone: ColorKey = stage ? stageTone(stage) : 'accent';

  return (
    <AppCard style={styles.hero}>
      {sold ? (
        <View style={styles.badgeRow}>
          <StageBadge tone="gold" label={t('plotSold')} />
        </View>
      ) : null}
      <AppText size="overline" weight="bold" color="textSecondary" uppercase>
        {t('totalCostLabel')}
      </AppText>
      <AppText size="display" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
        {formatRupees(totalCost)}
      </AppText>
      {location ? (
        <AppText size="sm" color="textSecondary" numberOfLines={1}>
          {location}
        </AppText>
      ) : null}

      <Pressable
        onPress={() => !readOnly && onPressStage()}
        accessibilityRole="button"
        style={[styles.stagePill, { backgroundColor: softToneColor(theme, tone) }]}
      >
        <AppIcon name="tag" size={14} color={tone} />
        <AppText size="xs" weight="bold" color={tone}>
          {stage ? (language === 'ur' ? stage.name_ur : stage.name_en) : t('setStatusLabel')}
        </AppText>
      </Pressable>

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
