import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AccountPickerRow, AmountInput, AppButton, AppSheet, AppText, DateField } from '@/components/ui';
import { payBooking, type AccountWithBalance, type PurchaseOrderSummary } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/MultiDeliverySheet.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  po: PurchaseOrderSummary;
  accounts: AccountWithBalance[];
  onSaved: () => Promise<void> | void;
}

/** Pay the supplier across a purchase order: an amount per still-owed item. */
export function MultiPaySheet({ visible, onClose, po, accounts, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const today = todayISO().slice(0, 10);
  const { saving, run: runSave } = useSaveAction();

  const items = po.items.filter((i) => i.payRemaining > 0.001);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAmounts({});
    setDate(today);
    setAccountId(accounts[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const total = Object.values(amounts).reduce((s, a) => s + (a || 0), 0);
  const account = accounts.find((a) => a.id === accountId) ?? null;
  const over = items.some((i) => (amounts[i.booking.id] ?? 0) > i.payRemaining + 0.001);
  const payError = account && total > account.balance ? t('insufficientFunds') : null;
  const canSave = total > 0 && !over && !!accountId && !payError;

  const onSave = () => {
    if (!canSave || saving || !accountId) return;
    void (async () => {
      const ok = await runSave(async () => {
        for (const item of items) {
          const amount = amounts[item.booking.id] ?? 0;
          if (amount > 0) await payBooking({ bookingId: item.booking.id, amount, date, accountId });
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
      title={t('payBookingLabel')}
      footer={<AppButton label={t('payBookingLabel')} icon="check" onPress={onSave} loading={saving} disabled={!canSave} />}
    >
      <View style={styles.field}>
        <AppText size="xs" weight="semibold" color="textSecondary">
          {t('date')}
        </AppText>
        <DateField value={date} onChange={setDate} maxDate={today} />
      </View>
      <AccountPickerRow accounts={accounts} selectedId={accountId} onSelect={setAccountId} />

      {items.map((item) => (
        <View key={item.booking.id} style={styles.itemRow}>
          <View style={styles.itemHead}>
            <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
              {item.booking.item_name}
            </AppText>
            <Pressable onPress={() => setAmounts((m) => ({ ...m, [item.booking.id]: Math.round(item.payRemaining) }))} accessibilityRole="button">
              <AppText size="xs" weight="semibold" color="accent">
                {`${t('payRemainingLabel')}: ${formatRupees(item.payRemaining)}`}
              </AppText>
            </Pressable>
          </View>
          <AmountInput
            label={t('amount')}
            value={amounts[item.booking.id] ?? 0}
            onChange={(v) => setAmounts((m) => ({ ...m, [item.booking.id]: v }))}
            floating
            surface={theme.colors.card}
            error={(amounts[item.booking.id] ?? 0) > item.payRemaining + 0.001 ? t('exceedsRemaining') : null}
          />
        </View>
      ))}
    </AppSheet>
  );
}
