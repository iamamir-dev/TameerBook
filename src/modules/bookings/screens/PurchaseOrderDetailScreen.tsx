import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StageBadge } from '@/components/StageBadge';
import { ActionsDrawer, AppCard, AppHeader, AppText, LabelValueRow, LoadErrorState, PhoneChip } from '@/components/ui';
import { cancelPurchaseOrder } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/money';
import { formatSplitQty } from '@/utils/units';

import { MultiDeliverySheet } from '../components/MultiDeliverySheet';
import { MultiPaySheet } from '../components/MultiPaySheet';
import { usePurchaseOrder } from '../hooks/usePurchaseOrder';
import { usePurchaseOrderDetail } from '../hooks/useBookings';
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
  const { po, supplierPhone, accounts, deliveries, payments } = data;
  const { run: runSave } = useSaveAction();

  const [actionsOpen, setActionsOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
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

        {/* PO-level delivery history. */}
        {deliveries.length > 0 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('deliveries')}
            </AppText>
            <AppCard compact>
              {deliveries.map((d, i) => (
                <View key={d.id} style={[styles.histRow, i > 0 && styles.ruled]}>
                  <View style={styles.histLeft}>
                    <AppText size="sm" weight="semibold" numberOfLines={1}>
                      {d.itemName}
                    </AppText>
                    <AppText size="xs" color="textSecondary">
                      {formatDisplayDate(d.date)}
                    </AppText>
                  </View>
                  <AppText size="sm" weight="bold" color="success" tabular>
                    {`+ ${formatSplitQty(d.qty, bookingUnit(po.items.find((it) => it.booking.id === d.booking_id)?.booking ?? po.items[0].booking))}`}
                  </AppText>
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        {/* PO-level payment history. */}
        {payments.length > 0 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('paidLabel')}
            </AppText>
            <AppCard compact>
              {payments.map((p, i) => (
                <View key={p.id} style={[styles.histRow, i > 0 && styles.ruled]}>
                  <View style={styles.histLeft}>
                    <AppText size="sm" weight="semibold" numberOfLines={1}>
                      {p.itemName}
                    </AppText>
                    <AppText size="xs" color="textSecondary">
                      {formatDisplayDate(p.date)}
                    </AppText>
                  </View>
                  <AppText size="sm" weight="bold" color="danger" tabular>
                    {`− ${formatRupees(p.amount)}`}
                  </AppText>
                </View>
              ))}
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
    </View>
  );
}
