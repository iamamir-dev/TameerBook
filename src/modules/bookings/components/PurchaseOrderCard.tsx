import React from 'react';
import { View } from 'react-native';

import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppIcon, AppText, LabelValueRow } from '@/components/ui';
import type { PurchaseOrderSummary } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';
import { softToneColor } from '@/utils/tones';

import { purchaseOrderStatusMeta } from '../utils/status';
import { makeStyles } from '../styled/PurchaseOrderCard.styles';

interface Props {
  po: PurchaseOrderSummary;
  onPress: () => void;
}

/**
 * One purchase order (a group of material line-items): PO number + status, a
 * quiet supplier · project caption, then item count, total and what's still owed.
 */
export function PurchaseOrderCard({ po, onPress }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { tone, labelKey } = purchaseOrderStatusMeta(po);
  const caption = [po.supplierName, po.projectName].filter(Boolean).join(' · ');

  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconChip, { backgroundColor: softToneColor(theme, tone) }]}>
          <AppIcon name="material" size={22} color={tone} />
        </View>
        <View style={styles.title}>
          <AppText size="md" weight="bold" numberOfLines={1}>
            {po.poNumber}
          </AppText>
          {caption ? (
            <AppText size="xs" color="textSecondary" numberOfLines={1}>
              {caption}
            </AppText>
          ) : null}
        </View>
        <StageBadge tone={tone} label={t(labelKey)} />
      </View>

      <View style={styles.divider} />

      <View style={styles.block}>
        <LabelValueRow label={t('items')} value={String(po.itemCount)} />
        <LabelValueRow label={t('totalLabel')} value={formatRupees(po.total)} />
        {po.payRemaining > 0 ? (
          <LabelValueRow label={t('payRemainingLabel')} value={formatRupees(po.payRemaining)} valueColor="danger" />
        ) : null}
      </View>
    </AppCard>
  );
}
