import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, MoneyEntrySheet, ReceiptPhotoField } from '@/components/ui';
import {
  addPlotPayment,
  listUsedPayTypes,
  ONCE_PAY_TYPES,
  PAY_TYPE_LABEL_KEYS,
  PAY_TYPES,
  updatePlotPayment,
  type AccountWithBalance,
  type PayType,
  type PlotSummary,
  type TransactionRow,
} from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/PaymentSheet.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  summary: PlotSummary;
  accounts: AccountWithBalance[];
  /** Pass a payment to edit in place; omit/null to add a new one. */
  editing?: TransactionRow | null;
  onSaved: () => Promise<void>;
}

interface Form {
  payType: PayType;
  amount: number;
  accountId: string | null;
  date: string;
  receiptUri: string | null;
}

/**
 * Pay the seller — or edit a seller payment in place — on the shared
 * `MoneyEntrySheet`. Pay-type chips pick the milestone when adding (fixed on
 * edit); a one-time type already used on this plot is hidden. Capped at what is
 * still owed, freeing an edited row's own amount back into the cap.
 */
export function SellerPaymentSheet({ visible, onClose, summary, accounts, editing, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();

  const [usedPayTypes, setUsedPayTypes] = useState<PayType[]>([]);
  const available = PAY_TYPES.filter((pt) => !ONCE_PAY_TYPES.includes(pt) || !usedPayTypes.includes(pt));

  const [form, setForm] = useState<Form>({ payType: 'INSTALLMENT', amount: 0, accountId: null, date: todayISO().slice(0, 10), receiptUri: null });
  const patch = (p: Partial<Form>) => setForm((s) => ({ ...s, ...p }));

  // Reset only when the sheet opens (avoids wiping the form on data bumps).
  useEffect(() => {
    if (!visible) return;
    setForm({
      payType: (editing?.pay_type as PayType) ?? 'INSTALLMENT',
      amount: editing?.amount ?? 0,
      accountId: editing?.account_id ?? accounts[0]?.id ?? null,
      date: editing?.date ?? todayISO().slice(0, 10),
      receiptUri: null,
    });
    if (!editing) listUsedPayTypes(summary.plot.id, 'PLOT', 'OUT').then(setUsedPayTypes).catch(() => setUsedPayTypes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Keep the selected pay-type valid once the used list arrives (add mode only).
  useEffect(() => {
    if (!editing && !available.some((pt) => pt === form.payType) && available[0]) patch({ payType: available[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usedPayTypes]);

  const ownAmount = editing?.amount ?? 0;
  const remainingCap = summary.remaining + ownAmount;
  const account = accounts.find((a) => a.id === form.accountId) ?? null;
  const accountCap = account ? account.balance + (editing && editing.account_id === account.id ? ownAmount : 0) : 0;
  const amountError =
    form.amount <= 0
      ? null
      : form.amount > remainingCap
        ? t('exceedsRemaining')
        : account && form.amount > accountCap
          ? t('insufficientFunds')
          : null;
  const canSave = form.amount > 0 && form.accountId !== null && !amountError;

  const onSave = () => {
    if (!canSave || saving || !form.accountId) return;
    void run(async () => {
      if (editing) {
        await updatePlotPayment(editing.id, { amount: form.amount, date: form.date, accountId: form.accountId! });
      } else {
        await addPlotPayment({
          plotId: summary.plot.id,
          payType: form.payType,
          amount: form.amount,
          date: form.date,
          accountId: form.accountId!,
          receiptUri: form.receiptUri,
        });
      }
      onClose();
      await onSaved();
    });
  };

  const header = editing ? null : (
    <View style={styles.chipRow}>
      {available.map((pt) => {
        const sel = pt === form.payType;
        return (
          <Pressable
            key={pt}
            onPress={() => patch({ payType: pt })}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            style={[styles.chip, sel && styles.chipActive]}
          >
            <AppText size="sm" weight={sel ? 'bold' : 'semibold'} color={sel ? 'accent' : 'textSecondary'}>
              {t(PAY_TYPE_LABEL_KEYS[pt])}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <MoneyEntrySheet
      visible={visible}
      onClose={onClose}
      title={editing ? t('editPayment') : t('sellerPayment')}
      subtitle={`${t('remaining')}: ${formatRupees(remainingCap)}`}
      header={header}
      amount={form.amount}
      onAmountChange={(amount) => patch({ amount })}
      amountError={amountError}
      accounts={accounts}
      accountId={form.accountId}
      onAccountChange={(accountId) => patch({ accountId })}
      date={form.date}
      onDateChange={(date) => patch({ date })}
      extra={editing ? undefined : <ReceiptPhotoField uri={form.receiptUri} onChange={(receiptUri) => patch({ receiptUri })} />}
      onSave={onSave}
      saving={saving}
      saveLabel={editing ? t('save') : undefined}
      saveDisabled={!canSave}
    />
  );
}
