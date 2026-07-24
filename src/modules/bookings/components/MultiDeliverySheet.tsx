import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
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
import {
  addDelivery,
  deleteDelivery,
  payBooking,
  receiveAndPay,
  updateBookingPayment,
  updateDelivery,
  uuid,
  voidTransaction,
  type AccountWithBalance,
  type PurchaseOrderSummary,
} from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';
import { formatSplitQty } from '@/utils/units';

import type { PoHistoryEntry } from '../hooks/useBookings';
import { bookingUnit } from '../utils/unit';
import { makeStyles } from '../styled/MultiDeliverySheet.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  po: PurchaseOrderSummary;
  accounts: AccountWithBalance[];
  /** Pass a history batch to edit the whole entry in place; omit to add a new one. */
  editing?: PoHistoryEntry | null;
  onSaved: () => Promise<void> | void;
}

interface Row {
  qty: number;
  price: number;
}

/**
 * Record — or edit — a delivery for a whole purchase order in one action: every
 * item is listed with a quantity and an optional price paid now. Everything
 * saved together shares one batch id, so it reads as a single history entry.
 */
export function MultiDeliverySheet({ visible, onClose, po, accounts, editing, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const today = todayISO().slice(0, 10);
  const { saving, run: runSave } = useSaveAction();

  const exDel = (bid: string) => editing?.deliveries.find((d) => d.booking_id === bid) ?? null;
  const exPay = (bid: string) => editing?.payments.find((p) => p.booking_id === bid) ?? null;

  // Add: every item still owing material. Edit: exactly the batch's items.
  const items = editing
    ? po.items.filter((i) => editing.bookingIds.includes(i.booking.id))
    : po.items.filter((i) => i.qtyRemaining > 0.001);

  const [rows, setRows] = useState<Record<string, Row>>({});
  const [date, setDate] = useState(today);
  const [paidNow, setPaidNow] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  // Delivery and payment each keep their own note (batch-level, kept separate).
  const [deliveryNote, setDeliveryNote] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      const seeded: Record<string, Row> = {};
      for (const bid of editing.bookingIds) seeded[bid] = { qty: exDel(bid)?.qty ?? 0, price: exPay(bid)?.amount ?? 0 };
      setRows(seeded);
      setPaidNow(editing.payments.length > 0);
      setDate(editing.date || today);
      setAccountId(editing.payments[0]?.account_id ?? accounts[0]?.id ?? null);
      setDeliveryNote(editing.deliveries[0]?.note ?? '');
      setPaymentNote(editing.payments[0]?.description ?? '');
    } else {
      setRows({});
      setDate(today);
      setPaidNow(false);
      setAccountId(accounts[0]?.id ?? null);
      setDeliveryNote('');
      setPaymentNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const setRow = (id: string, p: Partial<Row>) =>
    setRows((m) => ({ ...m, [id]: { ...(m[id] ?? { qty: 0, price: 0 }), ...p } }));

  // Editing frees each row's own already-recorded qty/amount back into its cap.
  const qtyCap = (bid: string, remaining: number) => remaining + (exDel(bid)?.qty ?? 0);
  const payCap = (bid: string, remaining: number) => remaining + (exPay(bid)?.amount ?? 0);

  const totalPrice = paidNow ? Object.values(rows).reduce((s, r) => s + (r.price || 0), 0) : 0;
  const account = accounts.find((a) => a.id === accountId) ?? null;
  const anyQty = items.some((i) => (rows[i.booking.id]?.qty ?? 0) > 0);
  const anyValue = anyQty || totalPrice > 0; // a batch needs at least one qty or payment
  const overQty = items.some((i) => (rows[i.booking.id]?.qty ?? 0) > qtyCap(i.booking.id, i.qtyRemaining) + 0.001);
  const overPay = paidNow && items.some((i) => (rows[i.booking.id]?.price ?? 0) > payCap(i.booking.id, i.payRemaining) + 0.001);
  const payError = paidNow && totalPrice > 0 && account && totalPrice > account.balance ? t('insufficientFunds') : null;
  const canSave = anyValue && !overQty && !overPay && (!paidNow || totalPrice === 0 || (!!accountId && !payError));

  const onSave = () => {
    if (!canSave || saving) return;
    void (async () => {
      const ok = await runSave(async () => {
        const batchId = editing?.batchId ?? uuid();
        const dNote = deliveryNote.trim() || null;
        const pNote = paymentNote.trim() || null;
        for (const item of items) {
          const bid = item.booking.id;
          const qty = rows[bid]?.qty ?? 0;
          const price = paidNow ? rows[bid]?.price ?? 0 : 0;

          if (editing) {
            const dRow = exDel(bid);
            const pRow = exPay(bid);
            // Delivery part.
            if (dRow && qty > 0) await updateDelivery(dRow.id, { qty, date, projectId: dRow.project_id, note: dNote });
            else if (dRow && qty <= 0) await deleteDelivery(dRow.id);
            else if (qty > 0) await addDelivery({ bookingId: bid, qty, date, batchId, note: dNote });
            // Payment part.
            if (pRow && price > 0) await updateBookingPayment(pRow.id, { amount: price, date, accountId: accountId ?? pRow.account_id ?? undefined, note: pNote });
            else if (pRow && price <= 0) await voidTransaction(pRow.id);
            else if (price > 0 && accountId) await payBooking({ bookingId: bid, amount: price, date, accountId, batchId, note: pNote });
          } else {
            if (qty <= 0 && price <= 0) continue;
            if (qty > 0 && price > 0 && accountId) await receiveAndPay({ bookingId: bid, qty, date, payAmount: price, accountId, batchId, note: dNote, payNote: pNote });
            else if (qty > 0) await addDelivery({ bookingId: bid, qty, date, batchId, note: dNote });
            else if (price > 0 && accountId) await payBooking({ bookingId: bid, amount: price, date, accountId, batchId, note: pNote });
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
      title={editing ? t('editEntry') : t('addDelivery')}
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
        const bid = item.booking.id;
        const r = rows[bid];
        const cap = qtyCap(bid, item.qtyRemaining);
        return (
          <View key={bid} style={styles.itemRow}>
            <View style={styles.itemHead}>
              <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
                {item.booking.item_name}
              </AppText>
              <AppText size="xs" color="textSecondary">
                {`${t('remainingQty')}: ${formatSplitQty(cap, unit)}`}
              </AppText>
            </View>
            <QtyUnitRow
              unit={unit}
              resetToken={visible}
              initialPrimary={editing ? exDel(bid)?.qty ?? 0 : undefined}
              onQty={(qty) => setRow(bid, { qty })}
              error={(r?.qty ?? 0) > cap + 0.001 ? t('exceedsRemaining') : null}
            />
            {paidNow ? (
              <AmountInput
                label={`${t('amount')} (${formatRupees(payCap(bid, item.payRemaining))})`}
                value={r?.price ?? 0}
                onChange={(price) => setRow(bid, { price })}
                floating
                surface={theme.colors.card}
                error={(r?.price ?? 0) > payCap(bid, item.payRemaining) + 0.001 ? t('exceedsRemaining') : null}
              />
            ) : null}
          </View>
        );
      })}

      {/* Delivery + payment each keep their own note, at the bottom. */}
      <FloatingLabelInput label={t('deliveryNote')} value={deliveryNote} onChangeText={setDeliveryNote} multiline />
      {paidNow ? (
        <FloatingLabelInput label={t('paymentNote')} value={paymentNote} onChangeText={setPaymentNote} multiline />
      ) : null}
    </AppSheet>
  );
}
