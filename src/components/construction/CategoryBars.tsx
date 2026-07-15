import React from 'react';
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

  if (byCategory.length === 0 && laborAccrued <= 0) return null;

  return (
    <AppCard>
      <AppText size="md" weight="bold" style={styles.cardTitle}>
        {t('topCategories')}
      </AppText>
      {byCategory.map((c, i) => (
        <View key={c.categoryId} style={[styles.listRow, i > 0 && styles.ruled]}>
          <AppText size="sm" color="textSecondary" numberOfLines={1} style={styles.listLabel}>
            {language === 'ur' ? c.nameUr : c.nameEn}
          </AppText>
          <AppText size="sm" weight="bold" tabular>
            {formatRupees(c.total)}
          </AppText>
        </View>
      ))}
      {laborAccrued > 0 ? (
        <View style={[styles.listRow, byCategory.length > 0 && styles.ruled]}>
          <AppText size="sm" color="textSecondary" numberOfLines={1} style={styles.listLabel}>
            {t('laborTitle')}
          </AppText>
          <AppText size="sm" weight="bold" tabular>
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
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    ruled: { borderTopWidth: 0.5, borderTopColor: theme.colors.border },
    listLabel: { flex: 1 },
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
