import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { ProjectCost } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

interface Props {
  cost: ProjectCost;
}

type Tone = 'gold' | 'accent' | 'success';

/** Same fixed phase→tone map as ProjectCostCard so bar and legend agree. */
const SEGMENTS: { key: keyof ProjectCost; labelKey: 'phasePlot' | 'phaseConstruction' | 'phaseSale'; tone: Tone }[] = [
  { key: 'plotCost', labelKey: 'phasePlot', tone: 'gold' },
  { key: 'constructionCost', labelKey: 'phaseConstruction', tone: 'accent' },
  { key: 'saleCost', labelKey: 'phaseSale', tone: 'success' },
];

/**
 * Compact cost-split for the allocation cards: a slim proportion bar
 * (plot / construction / sale) over an inline legend of dot + phase + amount.
 * Reuses ProjectCostCard's color language (Plot=gold, Construction=accent,
 * Sale=success) in a single tighter row so several fit on one screen.
 */
export function CostSplitBar({ cost }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const segs = SEGMENTS.map((s) => ({ ...s, value: cost[s.key], color: theme.colors[s.tone] }));
  const total = cost.totalCost;

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {total > 0 ? (
          segs.map((s) =>
            s.value > 0 ? <View key={s.key} style={{ flex: s.value, backgroundColor: s.color }} /> : null
          )
        ) : (
          <View style={styles.barEmpty} />
        )}
      </View>

      <View style={styles.legend}>
        {segs.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <AppText size="xs" color="textSecondary" numberOfLines={1}>
              {t(s.labelKey)}
            </AppText>
            <AppText size="xs" weight="semibold" tabular numberOfLines={1}>
              {formatRupees(s.value)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: theme.spacing.sm },
    bar: {
      flexDirection: 'row',
      height: 8,
      borderRadius: theme.radius.pill,
      overflow: 'hidden',
      backgroundColor: theme.colors.track,
    },
    barEmpty: { flex: 1, backgroundColor: theme.colors.track },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    dot: { width: 8, height: 8, borderRadius: 4 },
  });
