import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StageBadge } from '@/components/StageBadge';
import { ActionsDrawer, AppCard, AppHeader, AppText, LabelValueRow, LoadErrorState, PhoneChip } from '@/components/ui';
import { cancelPurchaseOrder, deleteDelivery, deletePoEntry, type MaterialDeliveryRow, type TransactionRow } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/money';
import { formatSplitQty } from '@/utils/units';

import { AddDeliverySheet } from '../components/AddDeliverySheet';
import { MultiDeliverySheet } from '../components/MultiDeliverySheet';
import { MultiPaySheet } from '../components/MultiPaySheet';
import { PayBookingSheet } from '../components/PayBookingSheet';
import { PoEntryDetailSheet } from '../components/PoEntryDetailSheet';
import { usePurchaseOrder } from '../hooks/usePurchaseOrder';
import { type PoHistoryEntry, usePurchaseOrderDetail } from '../hooks/useBookings';
import { purchaseOrderStatusMeta } from '../utils/status';
import { bookingUnit } from '../utils/unit';
import { makeStyles } from '../styled/PurchaseOrderDetailScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type PoRoute = RouteProp<RootStackParamList, 'PurchaseOrderDetail'>;

export function PurchaseOrderDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { poId } = useRoute<PoRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { data, loadFailed, reload } = usePurchaseOrderDetail(poId);
  const { po, supplierPhone, accounts, projects, history } = data;
  const { run: runSave } = useSaveAction();

  const [actionsOpen, setActionsOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [entryDetail, setEntryDetail] = useState<PoHistoryEntry | null>(null);
  const [editDelivery, setEditDelivery] = useState<MaterialDeliveryRow | null>(null);
  const [editPayment, setEditPayment] = useState<TransactionRow | null>(null);
  const pdf = usePurchaseOrder(po, supplierPhone);

  if (!po) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('purchaseOrder')} onBack={() => navigation.goBack()} />
        {loadFailed ? <LoadErrorState onRetry={reload} /> : null}
      </View>
    );
  }

  const { tone, labelKey } = purchaseOrderStatusMeta(po);
  const caption = [po.supplierName, po.projectName].filter(Boolean).join(' · ');
  const active = po.status === 'OPEN';
  const canReceive = po.items.some((i) => i.qtyRemaining > 0.001);
  const canPay = po.items.some((i) => i.payRemaining >= 1);

  const itemOf = (bookingId: string) => po.items.find((i) => i.booking.id === bookingId) ?? po.items[0];
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? '';

  const onDeleteEntry = (entry: PoHistoryEntry) => {
    Alert.alert(entry.itemName, t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => void runSave(async () => {
          if (!entry.delivery) return;
          if (entry.kind === 'both') await deletePoEntry(entry.delivery.id);
          else await deleteDelivery(entry.delivery.id);
          await reload();
        }),
      },
    ]);
  };

  const editItem = editDelivery ? itemOf(editDelivery.booking_id) : editPayment ? itemOf(editPayment.booking_id!) : null;

  const onCancel = () => {
    Alert.alert(po.poNumber, t('cancelBookingConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('cancelBookingLabel'),
        style: 'destructive',
        onPress: () => void runSave(async () => {
          await cancelPurchaseOrder(po.poId);
          await reload();
        }),
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        title={po.poNumber}
        subtitle={t('purchaseOrder')}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'more', onPress: () => setActionsOpen(true), accessibilityLabel: t('actions') }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        <AppCard style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.flex}>
              <AppText size="overline" weight="bold" color="textSecondary" uppercase>
                {t('totalLabel')}
              </AppText>
              <AppText size="display" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
                {formatRupees(po.total)}
              </AppText>
              {caption ? (
                <AppText size="sm" color="textSecondary" numberOfLines={1} style={styles.caption}>
                  {caption}
                </AppText>
              ) : null}
            </View>
            <StageBadge tone={tone} label={t(labelKey)} />
          </View>

          {supplierPhone ? (
            <View style={styles.metaRow}>
              <PhoneChip phone={supplierPhone} />
            </View>
          ) : null}

          <View style={styles.divider} />
          <View style={styles.columns}>
            <View style={styles.col}>
              <LabelValueRow label={t('paidLabel')} value={formatRupees(po.paid)} valueColor="danger" />
            </View>
            <View style={styles.vDivider} />
            <View style={styles.col}>
              <LabelValueRow
                label={t('payRemainingLabel')}
                value={formatRupees(po.payRemaining)}
                valueColor={po.payRemaining > 0 ? 'danger' : 'textPrimary'}
              />
            </View>
          </View>
        </AppCard>

        {/* All items in one container. */}
        <AppText size="lg" weight="bold">
          {t('items')}
        </AppText>
        <AppCard compact>
          {po.items.map((item, i) => {
            const unit = bookingUnit(item.booking);
            return (
              <View key={item.booking.id} style={[styles.itemRow, i > 0 && styles.ruled]}>
                <View style={styles.itemTop}>
                  <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
                    {item.booking.item_name}
                  </AppText>
                  <AppText size="sm" weight="bold" tabular>
                    {formatRupees(item.booking.total)}
                  </AppText>
                </View>
                <View style={styles.itemSub}>
                  <AppText size="xs" color="textSecondary">
                    {`${formatSplitQty(item.booking.qty, unit)} × ${formatRupees(item.booking.rate)}`}
                  </AppText>
                  <AppText size="xs" weight="semibold" color={item.qtyRemaining <= 0.001 ? 'success' : 'textSecondary'}>
                    {`${t('receivedQty')}: ${formatSplitQty(item.qtyReceived, unit)} / ${formatSplitQty(item.booking.qty, unit)}`}
                  </AppText>
                </View>
              </View>
            );
          })}
        </AppCard>

        {/* Unified history: deliveries, payments, and combined receive-and-pay
            entries — tap a row for detail + edit. */}
        {history.length > 0 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('history')}
            </AppText>
            <AppCard compact>
              {history.map((e, i) => {
                const unit = bookingUnit(itemOf(e.bookingId).booking);
                const toOther =
                  e.delivery && e.delivery.project_id && e.delivery.project_id !== itemOf(e.bookingId).booking.project_id;
                return (
                  <Pressable
                    key={e.key}
                    onPress={() => setEntryDetail(e)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.histRow, i > 0 && styles.ruled, pressed && styles.pressed]}
                  >
                    <View style={styles.histLeft}>
                      <AppText size="sm" weight="semibold" numberOfLines={1}>
                        {e.itemName}
                      </AppText>
                      <AppText size="xs" color="textSecondary" numberOfLines={1}>
                        {toOther ? `${formatDisplayDate(e.date)} · → ${projectName(e.delivery!.project_id)}` : formatDisplayDate(e.date)}
                      </AppText>
                    </View>
                    <View style={styles.histRight}>
                      {e.delivery ? (
                        <AppText size="sm" weight="bold" color="success" tabular>
                          {`+ ${formatSplitQty(e.delivery.qty, unit)}`}
                        </AppText>
                      ) : null}
                      {e.payment ? (
                        <AppText size="sm" weight="bold" color="danger" tabular>
                          {`− ${formatRupees(e.payment.amount)}`}
                        </AppText>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </AppCard>
          </>
        ) : null}
      </ScrollView>

      <ActionsDrawer
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={po.poNumber}
        actions={[
          ...(canReceive ? [{ icon: 'material' as const, label: t('addDelivery'), onPress: () => setDeliverOpen(true) }] : []),
          ...(canPay ? [{ icon: 'moneyOut' as const, label: t('payBookingLabel'), onPress: () => setPayOpen(true) }] : []),
          ...(active ? [{ icon: 'edit' as const, label: t('editBooking'), onPress: () => navigation.navigate('NewPurchaseOrder', { poId: po.poId }) }] : []),
          { icon: 'print' as const, label: t('printLabel'), onPress: pdf.preview },
          { icon: 'share' as const, label: t('shareLabel'), onPress: pdf.share },
          ...(active ? [{ icon: 'trash' as const, label: t('cancelBookingLabel'), onPress: onCancel }] : []),
        ]}
      />

      <MultiDeliverySheet visible={deliverOpen} onClose={() => setDeliverOpen(false)} po={po} accounts={accounts} onSaved={reload} />
      <MultiPaySheet visible={payOpen} onClose={() => setPayOpen(false)} po={po} accounts={accounts} onSaved={reload} />

      <PoEntryDetailSheet
        visible={!!entryDetail}
        onClose={() => setEntryDetail(null)}
        entry={entryDetail}
        unit={bookingUnit(itemOf(entryDetail?.bookingId ?? '').booking)}
        destinationName={
          entryDetail?.delivery && entryDetail.delivery.project_id && entryDetail.delivery.project_id !== itemOf(entryDetail.bookingId).booking.project_id
            ? projectName(entryDetail.delivery.project_id)
            : null
        }
        onEditDelivery={() => {
          const d = entryDetail?.delivery ?? null;
          setEntryDetail(null);
          setEditDelivery(d);
        }}
        onEditPayment={() => {
          const p = entryDetail?.payment ?? null;
          setEntryDetail(null);
          setEditPayment(p);
        }}
        onDelete={() => {
          const e = entryDetail;
          setEntryDetail(null);
          if (e) onDeleteEntry(e);
        }}
      />

      {editItem ? (
        <>
          <AddDeliverySheet
            visible={!!editDelivery}
            onClose={() => setEditDelivery(null)}
            bookingId={editItem.booking.id}
            bookingProjectId={editItem.booking.project_id}
            qtyRemaining={editItem.qtyRemaining}
            unit={bookingUnit(editItem.booking)}
            payRemaining={editItem.payRemaining}
            accounts={accounts}
            projects={projects}
            editing={editDelivery}
            onSaved={reload}
          />
          <PayBookingSheet
            visible={!!editPayment}
            onClose={() => setEditPayment(null)}
            bookingId={editItem.booking.id}
            payRemaining={editItem.payRemaining}
            accounts={accounts}
            editing={editPayment}
            onSaved={reload}
          />
        </>
      ) : null}
    </View>
  );
}
