import React, { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { AppText, MoneyEntrySheet } from '@/components/ui';
import { payBooking, updateBookingPayment, type AccountWithBalance, type TransactionRow } from '@/db';
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
  /** Pass a payment to edit in place; omit/null to add a new one. */
  editing?: TransactionRow | null;
  onSaved: () => Promise<void> | void;
}

interface Form {
  amount: number;
  accountId: string | null;
  date: string;
  note: string;
}

/**
 * Pay the supplier — or edit an existing payment in place — on the shared
 * MoneyEntrySheet. Edit mode frees the edited row's own amount back into the
 * owed cap so it can be adjusted up to the full outstanding.
 */
export function PayBookingSheet({ visible, onClose, bookingId, payRemaining, accounts, editing, onSaved }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const today = todayISO().slice(0, 10);
  const { saving, run: runSave } = useSaveAction();

  const [form, setForm] = useState<Form>({ amount: 0, accountId: null, date: today, note: '' });
  const patch = (p: Partial<Form>) => setForm((s) => ({ ...s, ...p }));

  useEffect(() => {
    if (!visible) return;
    setForm({
      amount: editing?.amount ?? 0,
      accountId: editing?.account_id ?? accounts[0]?.id ?? null,
      date: editing?.date ?? today,
      note: editing?.description ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const account = accounts.find((a) => a.id === form.accountId) ?? null;
  // Edit frees this row's own amount back into both caps (owed + account balance).
  const ownAmount = editing?.amount ?? 0;
  const payCap = payRemaining + ownAmount;
  const accountCap = account ? account.balance + (editing && editing.account_id === account.id ? ownAmount : 0) : 0;
  const amountError =
    form.amount <= 0
      ? null
      : form.amount > payCap
        ? t('exceedsRemaining')
        : account && form.amount > accountCap
          ? t('insufficientFunds')
          : null;
  const canSave = form.amount > 0 && !!form.accountId && !amountError;

  const onPay = () => {
    if (!canSave || saving || !form.accountId) return;
    void (async () => {
      const ok = await runSave(async () => {
        if (editing) {
          await updateBookingPayment(editing.id, {
            amount: form.amount,
            date: form.date,
            accountId: form.accountId!,
            note: form.note.trim() || null,
          });
        } else {
          await payBooking({ bookingId, amount: form.amount, date: form.date, accountId: form.accountId!, note: form.note.trim() || null });
        }
        await onSaved();
      });
      if (ok) onClose();
    })();
  };

  return (
    <MoneyEntrySheet
      visible={visible}
      onClose={onClose}
      title={editing ? t('editPayment') : t('payBookingLabel')}
      header={
        <Pressable onPress={() => patch({ amount: Math.round(payCap) })} accessibilityRole="button">
          <AppText size="sm" weight="semibold" color="accent">
            {`${t('payRemainingLabel')}: ${formatRupees(payCap)}`}
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
      saveLabel={editing ? t('save') : t('payBookingLabel')}
      saveDisabled={!canSave}
    />
  );
}
