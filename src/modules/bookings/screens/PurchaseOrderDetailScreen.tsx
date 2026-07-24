import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StageBadge } from '@/components/StageBadge';
import { ActionsDrawer, AppCard, AppHeader, AppText, LabelValueRow, LoadErrorState, PhoneChip } from '@/components/ui';
import { cancelPurchaseOrder, deletePoBatch } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/money';
import { formatSplitQty } from '@/utils/units';

import { MultiDeliverySheet } from '../components/MultiDeliverySheet';
import { MultiPaySheet } from '../components/MultiPaySheet';
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
  const { poId, focusTxnId } = useRoute<PoRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { data, loadFailed, reload } = usePurchaseOrderDetail(poId);
  const { po, supplierPhone, accounts, history } = data;
  const { run: runSave } = useSaveAction();

  const [actionsOpen, setActionsOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [entryDetail, setEntryDetail] = useState<PoHistoryEntry | null>(null);
  const [editBatch, setEditBatch] = useState<PoHistoryEntry | null>(null);
  const pdf = usePurchaseOrder(po, supplierPhone);

  // Arriving from a linked transaction (e.g. Home activity): flash + scroll to
  // its history entry once the list has laid out.
  const scrollRef = useRef<ScrollView>(null);
  const historyYRef = useRef(0);
  const rowYsRef = useRef<Record<string, number>>({});
  const focusHandled = useRef(false);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  useEffect(() => {
    if (!focusTxnId || focusHandled.current || history.length === 0) return;
    const entry = history.find(
      (e) => e.payments.some((p) => p.id === focusTxnId) || e.deliveries.some((d) => d.id === focusTxnId)
    );
    if (!entry) return;
    focusHandled.current = true;
    setHighlightKey(entry.key);
    const toScroll = setTimeout(() => {
      const y = historyYRef.current + (rowYsRef.current[entry.key] ?? 0) - 80;
      scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
    }, 350);
    const toClear = setTimeout(() => setHighlightKey(null), 3200);
    return () => {
      clearTimeout(toScroll);
      clearTimeout(toClear);
    };
  }, [focusTxnId, history]);

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
  const unitFor = (bookingId: string) => bookingUnit(itemOf(bookingId).booking);
  const entryTitle = (e: PoHistoryEntry) => e.itemName ?? `${e.itemCount} ${t('items')}`;
  const entryNote = (e: PoHistoryEntry) =>
    e.deliveries.find((d) => d.note)?.note ?? e.payments.find((p) => p.description)?.description ?? null;

  const onDeleteEntry = (entry: PoHistoryEntry) => {
    Alert.alert(entryTitle(entry), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => void runSave(async () => {
          await deletePoBatch(
            entry.deliveries.map((d) => d.id),
            entry.payments.map((p) => p.id)
          );
          await reload();
        }),
      },
    ]);
  };

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
        ref={scrollRef}
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
            {/* Only surface "to pay" while money is still owed. */}
            {po.payRemaining >= 1 ? (
              <>
                <View style={styles.vDivider} />
                <View style={styles.col}>
                  <LabelValueRow label={t('payRemainingLabel')} value={formatRupees(po.payRemaining)} valueColor="danger" />
                </View>
              </>
            ) : null}
          </View>
        </AppCard>

        {/* All items in one container. */}
        <AppText size="lg" weight="bold">
          {t('items')}
        </AppText>
        <AppCard compact>
          {po.items.map((item, i) => {
            const unit = bookingUnit(item.booking);
            const fullyReceived = item.qtyRemaining <= 0.001;
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
                  {/* Fully received → just the total (green); otherwise received / total. */}
                  <AppText size="xs" weight="semibold" color={fullyReceived ? 'success' : 'textSecondary'}>
                    {fullyReceived
                      ? formatSplitQty(item.booking.qty, unit)
                      : `${formatSplitQty(item.qtyReceived, unit)} / ${formatSplitQty(item.booking.qty, unit)}`}
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
            <View onLayout={(ev) => { historyYRef.current = ev.nativeEvent.layout.y; }}>
            <AppCard compact>
              {history.map((e, i) => {
                const single = e.itemCount === 1;
                const soleDelivery = single ? e.deliveries[0] : null;
                const note = entryNote(e);
                const typeLabel = e.kind === 'both' ? t('receivedAndPaid') : e.kind === 'delivery' ? t('receivedQty') : t('payBookingLabel');
                return (
                  <Pressable
                    key={e.key}
                    onPress={() => setEntryDetail(e)}
                    onLayout={(ev) => { rowYsRef.current[e.key] = ev.nativeEvent.layout.y; }}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.histRow, i > 0 && styles.ruled, highlightKey === e.key && styles.histHighlight, pressed && styles.pressed]}
                  >
                    <View style={styles.histLeft}>
                      <View style={styles.histTitleRow}>
                        <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
                          {typeLabel}
                        </AppText>
                        {e.totalPaid > 0 ? (
                          <AppText size="sm" weight="bold" color="danger" tabular>
                            {`− ${formatRupees(e.totalPaid)}`}
                          </AppText>
                        ) : soleDelivery ? (
                          <AppText size="sm" weight="bold" color="success" tabular>
                            {`+ ${formatSplitQty(soleDelivery.qty, unitFor(e.bookingIds[0]))}`}
                          </AppText>
                        ) : null}
                      </View>
                      <View style={styles.histTitleRow}>
                        <AppText size="xs" color="textSecondary" numberOfLines={1} style={styles.flex}>
                          {formatDisplayDate(e.date)}
                        </AppText>
                        {e.itemCount > 1 ? (
                          <AppText size="xs" weight="semibold" color="textSecondary">
                            {`${e.itemCount} ${t('items')}`}
                          </AppText>
                        ) : null}
                      </View>
                      {note ? (
                        <AppText size="xs" color="textSecondary" numberOfLines={1} style={styles.histNote}>
                          {note}
                        </AppText>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </AppCard>
            </View>
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

      <MultiDeliverySheet
        visible={deliverOpen || !!editBatch}
        onClose={() => {
          setDeliverOpen(false);
          setEditBatch(null);
        }}
        po={po}
        accounts={accounts}
        editing={editBatch}
        onSaved={reload}
      />
      <MultiPaySheet visible={payOpen} onClose={() => setPayOpen(false)} po={po} accounts={accounts} onSaved={reload} />

      <PoEntryDetailSheet
        visible={!!entryDetail}
        onClose={() => setEntryDetail(null)}
        entry={entryDetail}
        unitFor={unitFor}
        onEdit={() => {
          const e = entryDetail;
          setEntryDetail(null);
          setEditBatch(e);
        }}
        onDelete={() => {
          const e = entryDetail;
          setEntryDetail(null);
          if (e) onDeleteEntry(e);
        }}
      />
    </View>
  );
}
