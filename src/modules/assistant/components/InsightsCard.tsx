import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { AppIcon, AppText, SkeletonBlock } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { describeInsight, type Insight, type InsightTarget } from '@/utils/insights';
import { formatRupees } from '@/utils/money';
import { softToneColor } from '@/utils/tones';

import { makeStyles } from '../styled/InsightsCard.styles';
import { INSIGHT_ICON, SEVERITY_TONE, insightLabels } from '../utils/insightLabels';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface InsightsCardProps {
  insights: Insight[];
  /** False until the first load — shows a skeleton instead of "all good". */
  loaded: boolean;
  /** Cap the rows shown (Home shows a few; the assistant shows them all). */
  limit?: number;
}

/** Navigate to the screen an insight is about. */
export function openInsightTarget(nav: Nav, target: InsightTarget): void {
  switch (target.screen) {
    case 'LaborerDetail':
      nav.navigate('LaborerDetail', { laborerId: target.laborerId });
      return;
    case 'PlotDetail':
      nav.navigate('PlotDetail', { plotId: target.plotId });
      return;
    case 'SaleDetail':
      nav.navigate('SaleDetail', { projectId: target.projectId });
      return;
    case 'UdhaarDetail':
      nav.navigate('UdhaarDetail', { udhaarId: target.udhaarId });
      return;
    case 'PurchaseOrderDetail':
      nav.navigate('PurchaseOrderDetail', { poId: target.poId });
      return;
    case 'ConstructionDetail':
      nav.navigate('ConstructionDetail', { projectId: target.projectId });
      return;
    case 'Cash':
      nav.navigate('Cash');
      return;
  }
}

/**
 * The assistant's proactive suggestions as ruled rows: a tone-tinted icon
 * chip, one plain sentence, and a chevron. Tapping a row opens the thing it
 * talks about (the worker, the plot, the order…). Offline — pure ledger math.
 */
export function InsightsCard({ insights, loaded, limit }: InsightsCardProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);
  const labels = useMemo(() => insightLabels(t), [t]);
  const rows = limit ? insights.slice(0, limit) : insights;

  if (!loaded) {
    return (
      <View style={styles.card}>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.skeletonRow, i > 0 && styles.ruled]}>
            <SkeletonBlock width={36} height={36} round />
            <View style={styles.skeletonText}>
              <SkeletonBlock width="80%" />
              <SkeletonBlock width="40%" height={10} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.quiet}>
          <View style={[styles.iconChip, { backgroundColor: theme.colors.successSoft }]}>
            <AppIcon name="checkCircle" size={20} color="success" />
          </View>
          <AppText size="sm" color="textSecondary" style={styles.text}>
            {t('insightsAllGood')}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {rows.map((i, idx) => {
        const tone = SEVERITY_TONE[i.severity];
        return (
          <Pressable
            key={i.id}
            onPress={() => openInsightTarget(navigation, i.target)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, idx > 0 && styles.ruled, pressed && styles.pressed]}
          >
            <View style={[styles.iconChip, { backgroundColor: softToneColor(theme, tone) }]}>
              <AppIcon name={INSIGHT_ICON[i.kind]} size={18} color={tone} />
            </View>
            <AppText size="sm" weight="semibold" style={styles.text} numberOfLines={2}>
              {describeInsight(i, labels, formatRupees)}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>
        );
      })}
    </View>
  );
}
