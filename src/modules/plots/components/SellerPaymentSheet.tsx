import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, MoneyEntrySheet, ReceiptPhotoField } from '@/components/ui';
import {
  addPlotPayment,
  listUsedPayTypes,
  ONCE_PAY_TYPES,
  PAY_TYPE_LABEL_KEYS,
  PAY_TYPES,
  type AccountWithBalance,
  type PayType,
  type PlotSummary,
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
 * Pay the seller an instalment of the deal (token / bayana / instalment / final)
 * on the shared `MoneyEntrySheet`. Pay-type chips pick the milestone; a one-time
 * type already used on this plot is hidden. Capped at what is still owed.
 */
export function SellerPaymentSheet({ visible, onClose, summary, accounts, onSaved }: Props): React.JSX.Element {
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
    setForm({ payType: 'INSTALLMENT', amount: 0, accountId: accounts[0]?.id ?? null, date: todayISO().slice(0, 10), receiptUri: null });
    listUsedPayTypes(summary.plot.id, 'PLOT', 'OUT').then(setUsedPayTypes).catch(() => setUsedPayTypes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Keep the selected pay-type valid once the used list arrives.
  useEffect(() => {
    if (!available.some((pt) => pt === form.payType) && available[0]) patch({ payType: available[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usedPayTypes]);

  const account = accounts.find((a) => a.id === form.accountId) ?? null;
  const amountError =
    form.amount <= 0
      ? null
      : form.amount > summary.remaining
        ? t('exceedsRemaining')
        : account && form.amount > account.balance
          ? t('insufficientFunds')
          : null;
  const canSave = form.amount > 0 && form.accountId !== null && !amountError;

  const onSave = () => {
    if (!canSave || saving || !form.accountId) return;
    void run(async () => {
      await addPlotPayment({
        plotId: summary.plot.id,
        payType: form.payType,
        amount: form.amount,
        date: form.date,
        accountId: form.accountId!,
        receiptUri: form.receiptUri,
      });
      onClose();
      await onSaved();
    });
  };

  const header = (
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
      title={t('sellerPayment')}
      subtitle={`${t('remaining')}: ${formatRupees(summary.remaining)}`}
      header={header}
      amount={form.amount}
      onAmountChange={(amount) => patch({ amount })}
      amountError={amountError}
      accounts={accounts}
      accountId={form.accountId}
      onAccountChange={(accountId) => patch({ accountId })}
      date={form.date}
      onDateChange={(date) => patch({ date })}
      extra={<ReceiptPhotoField uri={form.receiptUri} onChange={(receiptUri) => patch({ receiptUri })} />}
      onSave={onSave}
      saving={saving}
      saveDisabled={!canSave}
    />
  );
}
