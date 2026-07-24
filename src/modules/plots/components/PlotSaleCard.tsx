import React from 'react';
import { View } from 'react-native';

import { StageBadge } from '@/components/StageBadge';
import { AppButton, AppCard, AppText } from '@/components/ui';
import type { PlotSummary } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { PlotSummaryRow } from './PlotSummaryRow';
import { makeStyles } from '../styled/PlotSaleCard.styles';

interface Props {
  summary: PlotSummary;
  onAddReceipt: () => void;
}

/** Standalone-sale summary (price, buyer receipts, outstanding, profit). Actions
 *  live in the ledger "+" drawer; a fully-received sale hides the receipt button. */
export function PlotSaleCard({ summary, onAddReceipt }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { plot, salePrice, saleReceived, saleOutstanding, saleProfit } = summary;
  const sold = plot.status === 'SOLD';

  return (
    <AppCard style={styles.hero}>
      <View style={styles.saleHeader}>
        <AppText size="overline" weight="bold" color="textSecondary" uppercase style={styles.flex}>
          {t('sellPlot')}
        </AppText>
        {sold ? <StageBadge tone="gold" label={t('plotSold')} /> : null}
      </View>
      {plot.buyer_name ? (
        <AppText size="sm" color="textSecondary" numberOfLines={1}>
          {`${t('buyerName')}: ${plot.buyer_name}`}
        </AppText>
      ) : null}
      <PlotSummaryRow label={t('salePriceLabel')} value={formatRupees(salePrice)} />
      <PlotSummaryRow label={t('buyerReceipts')} value={formatRupees(saleReceived)} valueColor="success" />
      <PlotSummaryRow label={t('remaining')} value={formatRupees(saleOutstanding)} />
      <View style={styles.divider} />
      <PlotSummaryRow
        label={t('plotProfit')}
        value={formatRupees(saleProfit)}
        valueColor={saleProfit >= 0 ? 'success' : 'danger'}
      />
      {!sold ? <AppButton label={t('addReceipt')} icon="moneyIn" onPress={onAddReceipt} /> : null}
    </AppCard>
  );
}
