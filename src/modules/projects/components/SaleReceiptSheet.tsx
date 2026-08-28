import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, MoneyEntrySheet, ReceiptPhotoField } from '@/components/ui';
import {
  addSaleReceipt,
  ONCE_PAY_TYPES,
  PAY_TYPE_LABEL_KEYS,
  PAY_TYPES,
  updateSaleReceipt,
  type AccountWithBalance,
  type PayType,
  type SaleSummary,
  type TransactionRow,
} from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/SaleSheets.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The sale being paid (sale must exist when the sheet opens). */
  summary: SaleSummary;
  accounts: AccountWithBalance[];
  /** Pass a buyer receipt to edit in place; omit/null to add a new one. */
  editing?: TransactionRow | null;
  onSaved: () => Promise<void>;
}

/**
 * Buyer money on the project sale — add or edit in place — on the shared
 * `MoneyEntrySheet`. Milestone chips (Token/Advance once each) when adding;
 * capped at the outstanding amount, an edited receipt's own amount freed.
 */
export function SaleReceiptSheet({ visible, onClose, summary, accounts, editing, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();

  const available = PAY_TYPES.filter(
    (pt) => !ONCE_PAY_TYPES.includes(pt) || !summary.receipts.some((r) => r.pay_type === pt)
  );

  const [payType, setPayType] = useState<PayType | null>(null);
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  // Reset only when the sheet opens (data bumps must not wipe typing).
  useEffect(() => {
    if (!visible) return;
    setPayType((editing?.pay_type as PayType) ?? null);
    setAmount(editing?.amount ?? 0);
    setDate(editing?.date ?? todayISO().slice(0, 10));
    setReceiptUri(null);
    setAccountId((prev) => editing?.account_id ?? prev ?? accounts[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const ownAmount = editing?.amount ?? 0;
  const cap = summary.outstanding + ownAmount;
  const amountError = amount > 0 && amount > cap ? t('exceedsRemaining') : null;
  const canSave = amount > 0 && !!accountId && !amountError;

  const onSave = () => {
    if (!canSave || saving || !accountId || !summary.sale) return;
    void run(async () => {
      if (editing) {
        await updateSaleReceipt(editing.id, { amount, date, accountId });
      } else {
        await addSaleReceipt({ saleId: summary.sale!.id, amount, date, accountId, payType, receiptUri });
      }
      onClose();
      await onSaved();
    });
  };

  const header = editing ? null : (
    <View style={styles.chipRow}>
      {available.map((pt) => {
        const sel = payType === pt;
        return (
          <Pressable
            key={pt}
            onPress={() => setPayType(sel ? null : pt)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            style={[styles.chip, sel && styles.chipActive]}
          >
            <AppText size="xs" weight={sel ? 'bold' : 'semibold'} color={sel ? 'accent' : 'textSecondary'}>
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
      title={editing ? t('editReceipt') : t('addReceipt')}
      subtitle={`${t('remaining')}: ${formatRupees(cap)}`}
      header={header}
      amount={amount}
      onAmountChange={setAmount}
      amountError={amountError}
      accounts={accounts}
      accountId={accountId}
      onAccountChange={setAccountId}
      date={date}
      onDateChange={setDate}
      extra={editing ? undefined : <ReceiptPhotoField uri={receiptUri} onChange={setReceiptUri} />}
      onSave={onSave}
      saving={saving}
      saveDisabled={!canSave}
    />
  );
}
