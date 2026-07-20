import React, { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { AppText, MoneyEntrySheet } from '@/components/ui';
import { payBooking, type AccountWithBalance } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

interface Props {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  /** What is still owed on the booking — a payment can never exceed it. */
  payRemaining: number;
  accounts: AccountWithBalance[];
  onSaved: () => Promise<void> | void;
}

interface Form {
  amount: number;
  accountId: string | null;
  date: string;
  note: string;
}

/** Pay the supplier some of the booking value — on the shared MoneyEntrySheet. */
export function PayBookingSheet({ visible, onClose, bookingId, payRemaining, accounts, onSaved }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const today = todayISO().slice(0, 10);
  const { saving, run: runSave } = useSaveAction();

  const [form, setForm] = useState<Form>({ amount: 0, accountId: null, date: today, note: '' });
  const patch = (p: Partial<Form>) => setForm((s) => ({ ...s, ...p }));

  useEffect(() => {
    if (!visible) return;
    setForm({ amount: 0, accountId: accounts[0]?.id ?? null, date: today, note: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const account = accounts.find((a) => a.id === form.accountId) ?? null;
  const amountError =
    form.amount <= 0
      ? null
      : form.amount > payRemaining
        ? t('exceedsRemaining')
        : account && form.amount > account.balance
          ? t('insufficientFunds')
          : null;
  const canSave = form.amount > 0 && !!form.accountId && !amountError;

  const onPay = () => {
    if (!canSave || saving || !form.accountId) return;
    void (async () => {
      const ok = await runSave(async () => {
        await payBooking({ bookingId, amount: form.amount, date: form.date, accountId: form.accountId!, note: form.note.trim() || null });
        await onSaved();
      });
      if (ok) onClose();
    })();
  };

  return (
    <MoneyEntrySheet
      visible={visible}
      onClose={onClose}
      title={t('payBookingLabel')}
      header={
        <Pressable onPress={() => patch({ amount: Math.round(payRemaining) })} accessibilityRole="button">
          <AppText size="sm" weight="semibold" color="accent">
            {`${t('payRemainingLabel')}: ${formatRupees(payRemaining)}`}
          </AppText>
        </Pressable>
      }
      amount={form.amount}
      onAmountChange={(amount) => patch({ amount })}
      amountError={amountError}
      accounts={accounts}
      accountId={form.accountId}
      onAccountChange={(accountId) => patch({ accountId })}
      date={form.date}
      onDateChange={(date) => patch({ date })}
      note={form.note}
      onNoteChange={(note) => patch({ note })}
      onSave={onPay}
      saving={saving}
      saveLabel={t('payBookingLabel')}
      saveDisabled={!canSave}
    />
  );
}
