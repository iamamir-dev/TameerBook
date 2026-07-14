import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/ProgressBar';
import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppIcon, AppText } from '@/components/ui';
import type { BookingSummary } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatPakistaniGrouping, formatRupees } from '@/utils/money';
import { softToneColor, type ColorKey } from '@/utils/tones';

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
  const closed = booking.status === 'CLOSED';
  const tone: ColorKey = closed ? 'success' : 'accent';
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
        <StageBadge tone={tone} label={t(closed ? 'statusDone' : 'statusCurrent')} />
        <AppIcon name="forward" size={20} color="textSecondary" />
      </View>

      {/* Material side: received / booked with a slim progress bar */}
      <View style={styles.block}>
        <View style={styles.row}>
          <AppText size="sm" color="textSecondary">
            {t('receivedQty')}
          </AppText>
          <AppText size="sm" weight="semibold" tabular>
            {`${formatPakistaniGrouping(qtyReceived)} / ${formatPakistaniGrouping(booking.qty)}${unitSuffix}`}
          </AppText>
        </View>
        <ProgressBar percent={percent} tone={tone} />
      </View>

      {/* Money side: paid vs total, with what is still owed in danger */}
      <View style={styles.block}>
        <View style={styles.row}>
          <AppText size="sm" color="textSecondary">
            {t('paidLabel')}
          </AppText>
          <AppText size="sm" weight="semibold" tabular>
            {`${formatRupees(paid)} / ${formatRupees(booking.total)}`}
          </AppText>
        </View>
        {payRemaining > 0 ? (
          <View style={styles.row}>
            <AppText size="sm" color="textSecondary">
              {t('payRemainingLabel')}
            </AppText>
            <AppText size="sm" weight="bold" color="danger" tabular>
              {formatRupees(payRemaining)}
            </AppText>
          </View>
        ) : null}
      </View>
    </AppCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { gap: theme.spacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    iconChip: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { flex: 1, gap: 2 },
    block: { gap: theme.spacing.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
  });
