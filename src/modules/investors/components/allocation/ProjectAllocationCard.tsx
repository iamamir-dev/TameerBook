import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import type { ProjectCapitalSummary, ProjectSummary } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

import { CostSplitBar } from './CostSplitBar';

interface Props {
  summary: ProjectSummary;
  capital: ProjectCapitalSummary;
}

/**
 * One project's money story for the "By project" section: the total capital
 * invested (Σ paid-in shares), a compact plot/construction/sale cost split,
 * and each investor's stake (name + amount + ownership %). Completed projects
 * render dimmed so live ones read first.
 */
export function ProjectAllocationCard({ summary, capital }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const done = summary.project.status === 'COMPLETED';

  return (
    <AppCard style={[styles.card, done && styles.dimmed]}>
      <View style={styles.head}>
        <AppText size="md" weight="bold" numberOfLines={1} style={styles.name}>
          {summary.project.name}
        </AppText>
        <AppText size="xs" weight="semibold" color={done ? 'textSecondary' : 'accent'}>
          {done ? t('statusDone') : t('statusCurrent')}
        </AppText>
      </View>

      <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
        {t('totalInvested')}
      </AppText>
      <AppText size="xxl" weight="bold" color="gold" tabular numberOfLines={1} adjustsFontSizeToFit>
        {formatRupees(capital.totalCapital)}
      </AppText>

      <CostSplitBar cost={summary.cost} />

      {capital.shares.length > 0 ? (
        <View style={styles.shares}>
          {capital.shares.map((s) => (
            <View key={s.projectInvestorId} style={styles.shareRow}>
              <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.shareName}>
                {s.name}
              </AppText>
              <AppText size="sm" weight="bold" tabular>
                {formatRupees(s.capital)}
              </AppText>
              <AppText size="xs" color="textSecondary" tabular style={styles.sharePct}>
                {s.ownershipPct.toFixed(0)}%
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </AppCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { gap: theme.spacing.sm },
    dimmed: { opacity: 0.6 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
    name: { flex: 1 },
    shares: { gap: theme.spacing.sm, marginTop: theme.spacing.xs },
    shareRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    shareName: { flex: 1 },
    sharePct: { width: 44, textAlign: 'right' },
  });
