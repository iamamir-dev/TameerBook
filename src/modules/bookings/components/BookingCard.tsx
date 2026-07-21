import React from 'react';
import { View } from 'react-native';

import { ProgressBar } from '@/components/ProgressBar';
import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppIcon, AppText, LabelValueRow } from '@/components/ui';
import type { BookingSummary } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatPakistaniGrouping, formatRupees } from '@/utils/money';
import { softToneColor } from '@/utils/tones';

import { bookingStatusMeta } from '../utils/status';
import { makeStyles } from '../styled/BookingCard.styles';

interface BookingCardProps {
  summary: BookingSummary;
  onPress: () => void;
}

/**
 * One material booking. Reads top-down: item + the deal (qty @ rate), then the
 * supplier / project as separate pills, then the two balances — material still
 * to receive (with a bar) and money still to pay.
 */
export function BookingCard({ summary, onPress }: BookingCardProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const { booking, qtyReceived, paid, payRemaining, projectName } = summary;
  const { tone, labelKey } = bookingStatusMeta(booking.status);
  const percent = booking.qty > 0 ? (qtyReceived / booking.qty) * 100 : 0;
  const unitSuffix = booking.unit ? ` ${booking.unit}` : '';
  const deal = `${formatPakistaniGrouping(booking.qty)}${unitSuffix} @ ${formatRupees(booking.rate)}`;

  return (
    <AppCard onPress={onPress} style={styles.card}>
      {/* Item + the deal, with the status badge */}
      <View style={styles.header}>
        <View style={[styles.iconChip, { backgroundColor: softToneColor(theme, tone) }]}>
          <AppIcon name="material" size={22} color={tone} />
        </View>
        <View style={styles.title}>
          <AppText size="md" weight="bold" numberOfLines={1}>
            {booking.item_name}
          </AppText>
          <AppText size="xs" color="textSecondary" numberOfLines={1} tabular>
            {deal}
          </AppText>
        </View>
        <StageBadge tone={tone} label={t(labelKey)} />
      </View>

      {/* Supplier / project as separate, readable pills */}
      {booking.supplier_name || projectName ? (
        <View style={styles.metaRow}>
          {booking.supplier_name ? (
            <View style={styles.pill}>
              <AppIcon name="investor" size={12} color="textSecondary" />
              <AppText size="xs" weight="semibold" color="textSecondary" numberOfLines={1}>
                {booking.supplier_name}
              </AppText>
            </View>
          ) : null}
          {projectName ? (
            <View style={styles.pill}>
              <AppIcon name="project" size={12} color="textSecondary" />
              <AppText size="xs" weight="semibold" color="textSecondary" numberOfLines={1}>
                {projectName}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.divider} />

      {/* Material side: received / booked with a slim progress bar */}
      <View style={styles.block}>
        <LabelValueRow
          label={t('receivedQty')}
          value={`${formatPakistaniGrouping(qtyReceived)} / ${formatPakistaniGrouping(booking.qty)}${unitSuffix}`}
        />
        <ProgressBar percent={percent} tone={tone} />
      </View>

      {/* Money side: paid vs total, with what is still owed in danger */}
      <View style={styles.block}>
        <LabelValueRow label={t('paidLabel')} value={`${formatRupees(paid)} / ${formatRupees(booking.total)}`} />
        {payRemaining > 0 ? (
          <LabelValueRow label={t('payRemainingLabel')} value={formatRupees(payRemaining)} valueColor="danger" />
        ) : null}
      </View>
    </AppCard>
  );
}
