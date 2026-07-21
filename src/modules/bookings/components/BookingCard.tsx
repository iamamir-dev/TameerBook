import React from 'react';
import { View } from 'react-native';

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
  const { tone, labelKey } = bookingStatusMeta(summary);
  const unitSuffix = booking.unit ? ` ${booking.unit}` : '';

  return (
    <AppCard onPress={onPress} style={styles.card}>
      {/* Item + status badge */}
      <View style={styles.header}>
        <View style={[styles.iconChip, { backgroundColor: softToneColor(theme, tone) }]}>
          <AppIcon name="material" size={22} color={tone} />
        </View>
        <View style={styles.title}>
          <AppText size="md" weight="bold" numberOfLines={1}>
            {booking.item_name}
          </AppText>
        </View>
        <StageBadge tone={tone} label={t(labelKey)} />
      </View>

      {/* The deal + parties as separate badges (wrap to the next line). */}
      <View style={styles.metaRow}>
        <View style={styles.pill}>
          <AppIcon name="material" size={12} color="primary" />
          <AppText size="xs" weight="bold" color="textPrimary" tabular>
            {`${formatPakistaniGrouping(booking.qty)}${unitSuffix}`}
          </AppText>
        </View>
        <View style={styles.pill}>
          <AppIcon name="rupee" size={12} color="primary" />
          <AppText size="xs" weight="bold" color="textPrimary" tabular>
            {`${formatRupees(booking.rate)}`}
          </AppText>
        </View>
        {booking.supplier_name ? (
          <View style={styles.pill}>
            <AppIcon name="investor" size={12} color="primary" />
            <AppText size="xs" weight="semibold" color="textPrimary" style={styles.pillText}>
              {booking.supplier_name}
            </AppText>
          </View>
        ) : null}
        {projectName ? (
          <View style={styles.pill}>
            <AppIcon name="project" size={12} color="primary" />
            <AppText size="xs" weight="semibold" color="textPrimary" style={styles.pillText}>
              {projectName}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.divider} />

      {/* Material side: received / booked */}
      <View style={styles.block}>
        <LabelValueRow
          label={t('receivedQty')}
          value={`${formatPakistaniGrouping(qtyReceived)} / ${formatPakistaniGrouping(booking.qty)}${unitSuffix}`}
        />
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
