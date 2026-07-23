import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  AccountPickerRow,
  AmountInput,
  AppButton,
  AppSheet,
  AppText,
  AppToggle,
  DateField,
  QtyUnitRow,
} from '@/components/ui';
import { addDelivery, payBooking, receiveAndPay, type AccountWithBalance, type PurchaseOrderSummary } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';
import { formatSplitQty } from '@/utils/units';

import { bookingUnit } from '../utils/unit';
import { makeStyles } from '../styled/MultiDeliverySheet.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  po: PurchaseOrderSummary;
  accounts: AccountWithBalance[];
  onSaved: () => Promise<void> | void;
}

interface Row {
  qty: number;
  price: number;
}

/**
 * Record a delivery for a whole purchase order in one go: every unreceived item
 * is listed with a quantity field, and an optional price paid now (a payment to
 * the supplier for that item). Shared date + account.
 */
export function MultiDeliverySheet({ visible, onClose, po, accounts, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const today = todayISO().slice(0, 10);
  const { saving, run: runSave } = useSaveAction();

  const items = po.items.filter((i) => i.qtyRemaining > 0.001);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [date, setDate] = useState(today);
  const [paidNow, setPaidNow] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setRows({});
    setDate(today);
    setPaidNow(false);
    setAccountId(accounts[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const setRow = (id: string, p: Partial<Row>) =>
    setRows((m) => ({ ...m, [id]: { ...(m[id] ?? { qty: 0, price: 0 }), ...p } }));

  const totalPrice = Object.values(rows).reduce((s, r) => s + (r.price || 0), 0);
  const account = accounts.find((a) => a.id === accountId) ?? null;
  const anyQty = items.some((i) => (rows[i.booking.id]?.qty ?? 0) > 0);
  const overQty = items.some((i) => (rows[i.booking.id]?.qty ?? 0) > i.qtyRemaining + 0.001);
  const overPay = items.some((i) => (rows[i.booking.id]?.price ?? 0) > i.payRemaining + 0.001);
  const payError = paidNow && totalPrice > 0 && account && totalPrice > account.balance ? t('insufficientFunds') : null;
  const canSave =
    anyQty && !overQty && !overPay && (!paidNow || totalPrice === 0 || (!!accountId && !payError));

  const onSave = () => {
    if (!canSave || saving) return;
    void (async () => {
      const ok = await runSave(async () => {
        for (const item of items) {
          const r = rows[item.booking.id];
          const qty = r?.qty ?? 0;
          const price = paidNow ? r?.price ?? 0 : 0;
          if (qty <= 0 && price <= 0) continue;
          const bookingId = item.booking.id;
          if (qty > 0 && price > 0 && accountId) {
            await receiveAndPay({ bookingId, qty, date, payAmount: price, accountId });
          } else if (qty > 0) {
            await addDelivery({ bookingId, qty, date });
          } else if (price > 0 && accountId) {
            await payBooking({ bookingId, amount: price, date, accountId });
          }
        }
        await onSaved();
      });
      if (ok) onClose();
    })();
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={t('addDelivery')}
      footer={<AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!canSave} />}
    >
      <View style={styles.field}>
        <AppText size="xs" weight="semibold" color="textSecondary">
          {t('date')}
        </AppText>
        <DateField value={date} onChange={setDate} maxDate={today} />
      </View>

      <View style={styles.toggleRow}>
        <AppText size="sm" weight="semibold" style={styles.flex}>
          {t('alsoPaidNow')}
        </AppText>
        <AppToggle value={paidNow} onValueChange={setPaidNow} accessibilityLabel={t('alsoPaidNow')} />
      </View>
      {paidNow && totalPrice > 0 ? (
        <AccountPickerRow accounts={accounts} selectedId={accountId} onSelect={setAccountId} />
      ) : null}

      {items.map((item) => {
        const unit = bookingUnit(item.booking);
        const r = rows[item.booking.id];
        return (
          <View key={item.booking.id} style={styles.itemRow}>
            <View style={styles.itemHead}>
              <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
                {item.booking.item_name}
              </AppText>
              <AppText size="xs" color="textSecondary">
                {`${t('remainingQty')}: ${formatSplitQty(item.qtyRemaining, unit)}`}
              </AppText>
            </View>
            <QtyUnitRow
              unit={unit}
              resetToken={visible}
              onQty={(qty) => setRow(item.booking.id, { qty })}
              error={(r?.qty ?? 0) > item.qtyRemaining + 0.001 ? t('exceedsRemaining') : null}
            />
            {paidNow ? (
              <AmountInput
                label={`${t('amount')} (${formatRupees(item.payRemaining)})`}
                value={r?.price ?? 0}
                onChange={(price) => setRow(item.booking.id, { price })}
                floating
                surface={theme.colors.card}
                error={(r?.price ?? 0) > item.payRemaining + 0.001 ? t('exceedsRemaining') : null}
              />
            ) : null}
          </View>
        );
      })}
    </AppSheet>
  );
}
