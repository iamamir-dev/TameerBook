import React from 'react';
import { View } from 'react-native';

import { ProgressBar } from '@/components/ProgressBar';
import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppIcon, AppText } from '@/components/ui';
import type { ProjectSummary } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';
import { softToneColor, type ColorKey } from '@/utils/tones';

import { projectStatusMeta } from '../utils/status';
import { makeStyles } from '../styled/ProjectCard.styles';

/** One project card: auto-derived status badge, lifecycle progress, and the
 *  plot/construction/total cost math read like the owner's notebook. */
export function ProjectCard({ summary, onPress }: { summary: ProjectSummary; onPress: () => void }): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { project, progressPercent, cost, saleReceived } = summary;
  const { tone, labelKey } = projectStatusMeta(summary);
  const completed = project.status === 'COMPLETED';
  const shownProgress = completed ? 100 : Math.round(progressPercent);

  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconChip, { backgroundColor: softToneColor(theme, tone) }]}>
          <AppIcon name="project" size={22} color={tone} />
        </View>
        <View style={styles.cardTitle}>
          <AppText size="md" weight="bold" numberOfLines={1}>
            {project.name}
          </AppText>
          <View style={styles.badgeWrap}>
            <StageBadge tone={tone} label={t(labelKey)} />
          </View>
        </View>
        <AppIcon name="forward" size={20} color="textSecondary" />
      </View>

      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <ProgressBar percent={shownProgress} tone={completed ? 'success' : tone} />
        </View>
        <AppText size="xs" weight="bold" color={completed ? 'success' : 'textSecondary'} tabular>
          {`${shownProgress}%`}
        </AppText>
      </View>

      <View style={styles.mathBlock}>
        <MathRow label={t('phasePlot')} value={formatRupees(cost.plotCost)} />
        <MathRow label={t('phaseConstruction')} value={formatRupees(cost.constructionCost)} />
        <View style={styles.divider} />
        <View style={styles.mathRow}>
          <AppText size="sm" weight="bold">
            {t('projectTotalCost')}
          </AppText>
          <AppText size="md" weight="bold" tabular>
            {formatRupees(cost.totalCost)}
          </AppText>
        </View>
        {saleReceived > 0 ? (
          <View style={[styles.mathRow, styles.saleRow]}>
            <AppText size="sm" color="textSecondary">
              {t('phaseSale')}
            </AppText>
            <AppText size="sm" weight="semibold" color="success" tabular>
              {formatRupees(saleReceived)}
            </AppText>
          </View>
        ) : null}
      </View>
    </AppCard>
  );
}

function MathRow({ label, value, valueColor = 'textPrimary' }: { label: string; value: string; valueColor?: ColorKey }): React.JSX.Element {
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
