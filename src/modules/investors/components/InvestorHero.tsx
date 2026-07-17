import React from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import type { InvestorSummary } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/InvestorHero.styles';

/**
 * Investor standing hero: the big Total (which now INCLUDES realized profit),
 * with a breakdown of total invested, profit earned, and re-deployable balance.
 */
export function InvestorHero({ summary }: { summary: InvestorSummary | null }): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const total = summary?.total ?? 0;
  const invested = summary?.invested ?? 0;
  const profit = summary?.profit ?? 0;
  const available = summary?.available ?? 0;

  return (
    <View style={styles.hero}>
      <AppText size="overline" weight="semibold" color="onPrimaryMuted" uppercase>
        {t('totalLabel')}
      </AppText>
      <AppText size="display" weight="bold" color="onHero" tabular numberOfLines={1} adjustsFontSizeToFit>
        {formatRupees(total)}
      </AppText>

      <View style={styles.breakdown}>
        <View style={styles.row}>
          <AppText size="sm" color="onPrimaryMuted">
            {t('totalInvested')}
          </AppText>
          <AppText size="sm" weight="bold" color="onHero" tabular>
            {formatRupees(invested)}
          </AppText>
        </View>
        {profit !== 0 ? (
          <View style={styles.row}>
            <AppText size="sm" color="onPrimaryMuted">
              {t('profitEarned')}
            </AppText>
            <AppText size="sm" weight="bold" color={profit >= 0 ? 'success' : 'danger'} tabular>
              {`${profit >= 0 ? '+ ' : '− '}${formatRupees(Math.abs(profit))}`}
            </AppText>
          </View>
        ) : null}
        {available > 0 ? (
          <View style={styles.row}>
            <AppText size="sm" color="onPrimaryMuted">
              {t('availableBalance')}
            </AppText>
            <AppText size="sm" weight="bold" color="gold" tabular>
              {formatRupees(available)}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}
