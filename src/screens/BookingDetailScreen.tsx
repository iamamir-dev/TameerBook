import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddDeliverySheet } from '@/components/bookings/AddDeliverySheet';
import { PayBookingSheet } from '@/components/bookings/PayBookingSheet';
import { StageBadge } from '@/components/StageBadge';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import {
  ActionsDrawer,
  AppCard,
  AppHeader,
  AppText,
  LedgerTable,
  type LedgerRow,
} from '@/components/ui';
import {
  type AccountWithBalance,
  type BookingSummary,
  getBookingSummary,
  listAccountsWithBalance,
  listBookingPayments,
  listDeliveries,
  type MaterialDeliveryRow,
  type TransactionRow,
} from '@/db';
import { useFocusReload } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatDisplayDate } from '@/utils/date';
import { formatPakistaniGrouping, formatRupees } from '@/utils/money';
import type { ColorKey } from '@/utils/tones';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type BookingRoute = RouteProp<RootStackParamList, 'BookingDetail'>;

/**
 * One booking's page: the deal on top (total + the two balances side by
 * side), then the two actions that move those balances, then the history —
 * deliveries (material in) and payments (money out).
 */
export function BookingDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { bookingId } = useRoute<BookingRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [summary, setSummary] = useState<BookingSummary | null>(null);
  const [txnDetail, setTxnDetail] = useState<TransactionRow | null>(null);
  const [deliveries, setDeliveries] = useState<MaterialDeliveryRow[]>([]);
  const [payments, setPayments] = useState<TransactionRow[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);

  const [deliverySheet, setDeliverySheet] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [paySheet, setPaySheet] = useState(false);

  const load = useCallback(async () => {
    const [s, ds, ps, accs] = await Promise.all([
      getBookingSummary(bookingId),
      listDeliveries(bookingId),
      listBookingPayments(bookingId),
      listAccountsWithBalance(),
    ]);
    setSummary(s);
    setDeliveries(ds);
    setPayments(ps);
    setAccounts(accs);
  }, [bookingId]);

  const { reload } = useFocusReload(load);

  const ledgerRows: LedgerRow[] = useMemo(
    () =>
      payments.map((txn) => ({
        id: txn.id,
        title: txn.description || t('payBookingLabel'),
        date: txn.date,
        amount: txn.amount,
        direction: 'out' as const,
        typeLabel: t('payBookingLabel'),
        onPress: () => setTxnDetail(txn),
      })),
    [payments, t]
  );

  if (!summary) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('bookingsTitle')} onBack={() => navigation.goBack()} />
      </View>
    );
  }

  const { booking, qtyReceived, qtyRemaining, paid, payRemaining } = summary;
  const closed = booking.status === 'CLOSED';
  const tone: ColorKey = closed ? 'success' : 'accent';
  const unitSuffix = booking.unit ? ` ${booking.unit}` : '';
  const fmtQty = (n: number) => `${formatPakistaniGrouping(n)}${unitSuffix}`;
  const showDelivery = !closed && qtyRemaining > 0;
  const showPay = !closed && payRemaining > 0;

  return (
    <View style={styles.screen}>
      <AppHeader
        title={booking.item_name}
        onBack={() => navigation.goBack()}
        rightAction={
          showDelivery || showPay
            ? { icon: 'add', onPress: () => setActionsOpen(true), accessibilityLabel: t('addDelivery') }
            : undefined
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {/* The deal, then the two balances side by side */}
        <AppCard style={styles.hero}>
          <AppText size="overline" weight="bold" color="textSecondary" uppercase>
            {t('totalLabel')}
          </AppText>
          <AppText size="display" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(booking.total)}
          </AppText>
          <AppText size="sm" color="textSecondary" numberOfLines={1}>
            {[`${fmtQty(booking.qty)} @ ${formatRupees(booking.rate)}`, booking.supplier_name, summary.projectName]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
          <View style={styles.badgeWrap}>
            <StageBadge tone={tone} label={t(closed ? 'statusDone' : 'statusCurrent')} />
          </View>
          <View style={styles.divider} />
          <View style={styles.columns}>
            {/* Material side */}
            <View style={styles.col}>
              <ColumnStat label={t('receivedQty')} value={fmtQty(qtyReceived)} valueColor="success" />
              <ColumnStat label={t('remainingQty')} value={fmtQty(qtyRemaining)} />
            </View>
            <View style={styles.vDivider} />
            {/* Money side */}
            <View style={styles.col}>
              <ColumnStat label={t('paidLabel')} value={formatRupees(paid)} valueColor="danger" />
              <ColumnStat
                label={t('payRemainingLabel')}
                value={formatRupees(payRemaining)}
                valueColor={payRemaining > 0 ? 'danger' : 'textPrimary'}
              />
            </View>
          </View>
        </AppCard>


        {/* Deliveries: material in */}
        {deliveries.length > 0 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('receivedQty')}
            </AppText>
            <AppCard compact>
              {deliveries.map((d, i) => (
                <View key={d.id} style={[styles.deliveryRow, i > 0 && styles.ruled]}>
                  <AppText size="sm" color="textSecondary">
                    {formatDisplayDate(d.date)}
                  </AppText>
                  <AppText size="sm" weight="bold" color="success" tabular>
                    {`+ ${fmtQty(d.qty)}`}
                  </AppText>
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        {/* Payments: money out */}
        {ledgerRows.length > 0 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('paidLabel')}
            </AppText>
            <AppCard compact>
              <LedgerTable rows={ledgerRows} />
            </AppCard>
          </>
        ) : null}
      </ScrollView>

      <ActionsDrawer
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={booking.item_name}
        actions={[
          ...(showDelivery
            ? [{ icon: 'material' as const, label: t('addDelivery'), onPress: () => setDeliverySheet(true) }]
            : []),
          ...(showPay
            ? [{ icon: 'moneyOut' as const, label: t('payBookingLabel'), onPress: () => setPaySheet(true) }]
            : []),
        ]}
      />

      <AddDeliverySheet
        visible={deliverySheet}
        onClose={() => setDeliverySheet(false)}
        bookingId={booking.id}
        qtyRemaining={qtyRemaining}
        unit={booking.unit}
        payRemaining={payRemaining}
        accounts={accounts}
        onSaved={reload}
      />
      <PayBookingSheet
        visible={paySheet}
        onClose={() => setPaySheet(false)}
        bookingId={booking.id}
        payRemaining={payRemaining}
        accounts={accounts}
        onSaved={reload}
      />
      <TransactionDetailSheet txn={txnDetail} onClose={() => setTxnDetail(null)} />
    </View>
  );
}

/** One stacked label+value inside the hero's two-column balance line. */
function ColumnStat({
  label,
  value,
  valueColor = 'textPrimary',
}: {
  label: string;
  value: string;
  valueColor?: ColorKey;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.stat}>
      <AppText size="xs" color="textSecondary">
        {label}
      </AppText>
      <AppText size="sm" weight="bold" color={valueColor} tabular numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    hero: { gap: theme.spacing.xs },
    badgeWrap: { flexDirection: 'row', marginTop: theme.spacing.xs },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      marginVertical: theme.spacing.sm,
    },
    columns: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: theme.spacing.lg,
    },
    col: { flex: 1, gap: theme.spacing.sm },
    vDivider: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: theme.colors.border,
    },
    stat: { gap: 2 },
    actionsRow: { flexDirection: 'row', gap: theme.spacing.sm },
    deliveryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      minHeight: 40,
      paddingVertical: theme.spacing.xs,
    },
    ruled: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
  });
