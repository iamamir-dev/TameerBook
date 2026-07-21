import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StageBadge } from '@/components/StageBadge';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import {
  ActionsDrawer,
  AppCard,
  AppHeader,
  AppText,
  LabelValueRow,
  LedgerTable,
  LoadErrorState,
  type LedgerRow,
} from '@/components/ui';
import { cancelBooking, deleteDelivery, type TransactionRow } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { formatDisplayDate } from '@/utils/date';
import { formatPakistaniGrouping, formatRupees } from '@/utils/money';

import { AddDeliverySheet } from '../components/AddDeliverySheet';
import { PayBookingSheet } from '../components/PayBookingSheet';
import { useBookingDetail } from '../hooks/useBookings';
import { bookingStatusMeta } from '../utils/status';
import { makeStyles } from '../styled/BookingDetailScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type BookingRoute = RouteProp<RootStackParamList, 'BookingDetail'>;

export function BookingDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { bookingId } = useRoute<BookingRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { data, loadFailed, reload } = useBookingDetail(bookingId);
  const { summary, deliveries, payments, accounts, projects } = data;
  const { run: runSave } = useSaveAction();

  const [txnDetail, setTxnDetail] = useState<TransactionRow | null>(null);
  const [deliverySheet, setDeliverySheet] = useState(false);
  const [crossDeliver, setCrossDeliver] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [paySheet, setPaySheet] = useState(false);

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

  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? '';

  if (!summary) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('bookingsTitle')} onBack={() => navigation.goBack()} />
        {loadFailed ? <LoadErrorState onRetry={reload} /> : null}
      </View>
    );
  }

  const { booking, qtyReceived, qtyRemaining, paid, payRemaining } = summary;
  const { tone, labelKey } = bookingStatusMeta(booking.status);
  const active = booking.status === 'OPEN';
  const unitSuffix = booking.unit ? ` ${booking.unit}` : '';
  const fmtQty = (n: number) => `${formatPakistaniGrouping(n)}${unitSuffix}`;
  const showDelivery = active && qtyRemaining > 0;
  const showPay = active && payRemaining > 0;
  // Cross-project delivery is a separate, deliberate action (kept out of the
  // simple Add-Delivery drawer) — only when there's another active project.
  const otherActive = projects.filter((p) => p.status === 'ACTIVE' && p.id !== booking.project_id);
  const showCrossDeliver = showDelivery && !!booking.project_id && otherActive.length > 0;
  // Any action to offer? If not (a CLOSED or CANCELLED booking), hide the "+"
  // so it can never open an empty actions drawer.
  const hasActions = showDelivery || showPay || active;

  const onDeleteDelivery = (id: string) => {
    Alert.alert(t('addDelivery'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => void runSave(async () => {
          await deleteDelivery(id);
          await reload();
        }),
      },
    ]);
  };

  const onCancelBooking = () => {
    Alert.alert(booking.item_name, t('cancelBookingConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('cancelBookingLabel'),
        style: 'destructive',
        onPress: () => void runSave(async () => {
          await cancelBooking(booking.id);
          await reload();
        }),
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        title={booking.item_name}
        onBack={() => navigation.goBack()}
        rightAction={hasActions ? { icon: 'add', onPress: () => setActionsOpen(true), accessibilityLabel: t('actions') } : undefined}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
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
            <StageBadge tone={tone} label={t(labelKey)} />
          </View>
          <View style={styles.divider} />
          <View style={styles.columns}>
            <View style={styles.col}>
              <LabelValueRow label={t('receivedQty')} value={fmtQty(qtyReceived)} valueColor="success" />
              <LabelValueRow label={t('remainingQty')} value={fmtQty(qtyRemaining)} />
            </View>
            <View style={styles.vDivider} />
            <View style={styles.col}>
              <LabelValueRow label={t('paidLabel')} value={formatRupees(paid)} valueColor="danger" />
              <LabelValueRow label={t('payRemainingLabel')} value={formatRupees(payRemaining)} valueColor={payRemaining > 0 ? 'danger' : 'textPrimary'} />
            </View>
          </View>
        </AppCard>

        {/* Deliveries: material in (long-press to remove a wrong entry). */}
        {deliveries.length > 0 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('receivedQty')}
            </AppText>
            <AppCard compact>
              {deliveries.map((d, i) => {
                const toOther = d.project_id && d.project_id !== booking.project_id;
                return (
                  <Pressable
                    key={d.id}
                    onLongPress={() => onDeleteDelivery(d.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('delete')}
                    style={({ pressed }) => [styles.deliveryRow, i > 0 && styles.ruled, pressed && styles.pressed]}
                  >
                    <View style={styles.deliveryLeft}>
                      <AppText size="sm" color="textSecondary">
                        {formatDisplayDate(d.date)}
                      </AppText>
                      {toOther ? (
                        <AppText size="xs" weight="semibold" color="accent" numberOfLines={1}>
                          {`→ ${projectName(d.project_id)}`}
                        </AppText>
                      ) : null}
                    </View>
                    <AppText size="sm" weight="bold" color="success" tabular>
                      {`+ ${fmtQty(d.qty)}`}
                    </AppText>
                  </Pressable>
                );
              })}
            </AppCard>
          </>
        ) : null}

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
            ? [{ icon: 'material' as const, label: t('addDelivery'), onPress: () => { setCrossDeliver(false); setDeliverySheet(true); } }]
            : []),
          ...(showCrossDeliver
            ? [{ icon: 'project' as const, label: t('deliverToProject'), onPress: () => { setCrossDeliver(true); setDeliverySheet(true); } }]
            : []),
          ...(showPay ? [{ icon: 'moneyOut' as const, label: t('payBookingLabel'), onPress: () => setPaySheet(true) }] : []),
          ...(active ? [{ icon: 'trash' as const, label: t('cancelBookingLabel'), onPress: onCancelBooking }] : []),
        ]}
      />

      <AddDeliverySheet
        visible={deliverySheet}
        onClose={() => setDeliverySheet(false)}
        bookingId={booking.id}
        bookingProjectId={booking.project_id}
        qtyRemaining={qtyRemaining}
        unit={booking.unit}
        payRemaining={payRemaining}
        accounts={accounts}
        projects={projects}
        allowProject={crossDeliver}
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
