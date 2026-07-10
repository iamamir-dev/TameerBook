import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import type { ConstructionSummary } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

interface CategoryBarsProps {
  byCategory: ConstructionSummary['byCategory'];
  /** Accrued labor wages, shown as its own bar after the categories. */
  laborAccrued: number;
}

/**
 * "Top categories" card: one proportional bar per construction spend category
 * plus a labor bar (matches ReportScreen's expense bars). Renders nothing
 * when there is no spend yet.
 */
export function CategoryBars({ byCategory, laborAccrued }: CategoryBarsProps): React.JSX.Element | null {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const styles = makeStyles(theme);

  const maxBar = useMemo(
    () => Math.max(laborAccrued, ...byCategory.map((c) => c.total), 1),
    [byCategory, laborAccrued]
  );

  if (byCategory.length === 0 && laborAccrued <= 0) return null;

  return (
    <AppCard>
      <AppText size="md" weight="bold" style={styles.cardTitle}>
        {t('topCategories')}
      </AppText>
      {byCategory.map((c) => (
        <View key={c.categoryId} style={styles.barRow}>
          <AppText size="xs" numberOfLines={1} style={styles.barLabel}>
            {language === 'ur' ? c.nameUr : c.nameEn}
          </AppText>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(c.total / maxBar) * 100}%` }]} />
          </View>
          <AppText size="xs" weight="bold" tabular style={styles.barVal}>
            {formatRupees(c.total)}
          </AppText>
        </View>
      ))}
      {laborAccrued > 0 ? (
        <View style={styles.barRow}>
          <AppText size="xs" numberOfLines={1} style={styles.barLabel}>
            {t('laborTitle')}
          </AppText>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(laborAccrued / maxBar) * 100}%` }]} />
          </View>
          <AppText size="xs" weight="bold" tabular style={styles.barVal}>
            {formatRupees(laborAccrued)}
          </AppText>
        </View>
      ) : null}
    </AppCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    cardTitle: { marginBottom: theme.spacing.sm },
    /* category bars (matches ReportScreen's expense bars) */
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    barLabel: { width: 84 },
    barTrack: {
      flex: 1,
      height: 8,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
      overflow: 'hidden',
    },
    barFill: { height: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.accent },
    barVal: { width: 84, textAlign: 'right' },
  });
