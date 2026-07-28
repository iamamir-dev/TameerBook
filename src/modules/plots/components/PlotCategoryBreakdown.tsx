import React from 'react';
import { View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/PlotCategoryBreakdown.styles';

export interface BreakdownRow {
  id: string;
  label: string;
  total: number;
}

/**
 * "By category" card: how much of the plot's spend went to each category
 * (seller-payment milestones + expense categories), largest first. Renders
 * nothing when there's no spend yet.
 */
export function PlotCategoryBreakdown({ rows }: { rows: BreakdownRow[] }): React.JSX.Element | null {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  if (rows.length === 0) return null;

  return (
    <AppCard>
      <AppText size="md" weight="bold" style={styles.title}>
        {t('topCategories')}
      </AppText>
      {rows.map((r, i) => (
        <View key={r.id} style={[styles.row, i > 0 && styles.ruled]}>
          <AppText size="sm" color="textSecondary" numberOfLines={1} style={styles.label}>
            {r.label}
          </AppText>
          <AppText size="sm" weight="bold" tabular>
            {formatRupees(r.total)}
          </AppText>
        </View>
      ))}
    </AppCard>
  );
}
