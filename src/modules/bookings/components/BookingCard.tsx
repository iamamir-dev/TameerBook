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
 * One material booking, read the way the owner reads it: "5000 bricks booked,
 * 1000 aa gayi (progress bar), Rs 3,000 diye — Rs 47,000 baqi."
 */
export function BookingCard({ summary, onPress }: BookingCardProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const { booking, qtyReceived, paid, payRemaining, projectName } = summary;
  const subtitle = [booking.supplier_name, projectName].filter(Boolean).join(' · ');
  const { tone, labelKey } = bookingStatusMeta(booking.status);
  const percent = booking.qty > 0 ? (qtyReceived / booking.qty) * 100 : 0;
  const unitSuffix = booking.unit ? ` ${booking.unit}` : '';

  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconChip, { backgroundColor: softToneColor(theme, tone) }]}>
          <AppIcon name="material" size={22} color={tone} />
        </View>
        <View style={styles.title}>
          <AppText size="md" weight="bold" numberOfLines={1}>
            {booking.item_name}
          </AppText>
          {subtitle ? (
            <AppText size="xs" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <StageBadge tone={tone} label={t(labelKey)} />
        <AppIcon name="forward" size={20} color="textSecondary" />
      </View>

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
