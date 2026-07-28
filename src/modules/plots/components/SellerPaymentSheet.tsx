import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppIcon, AppText, MoneyEntrySheet, ReceiptPhotoField } from '@/components/ui';
import {
  addPlotPayment,
  listSellerPaymentCategories,
  listUsedSellerCategoryIds,
  updatePlotPayment,
  type AccountWithBalance,
  type CategoryRow,
  type PlotSummary,
  type TransactionRow,
} from '@/db';
import { useCategoryLabel, useSaveAction } from '@/hooks';
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
  /** Jump to Settings → Plot to add a new seller-payment category. */
  onAddCategory?: () => void;
  onSaved: () => Promise<void>;
}

interface Form {
  categoryId: string | null;
  amount: number;
  accountId: string | null;
  date: string;
  receiptUri: string | null;
}

/** Seller-payment types that can be used at most once per plot. */
const ONCE_ONLY = ['Token', 'Advance'];

/**
 * Pay the seller — or edit a seller payment in place — on the shared
 * `MoneyEntrySheet`. The milestone chips are the "Seller Payment" categories
 * (the deal defaults plus any custom types the owner added in Settings). Token
 * and Advance can be used once each; the rest repeat. Both count toward the
 * deal; capped at what is still owed (an edited row's own amount freed).
 */
export function SellerPaymentSheet({ visible, onClose, summary, accounts, editing, onAddCategory, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();
  const catName = useCategoryLabel();

  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [usedIds, setUsedIds] = useState<string[]>([]);
  const available = cats.filter((c) => !(ONCE_ONLY.includes(c.name_en) && usedIds.includes(c.id)));

  const [form, setForm] = useState<Form>({ categoryId: null, amount: 0, accountId: null, date: todayISO().slice(0, 10), receiptUri: null });
  const patch = (p: Partial<Form>) => setForm((s) => ({ ...s, ...p }));

  // Reset only when the sheet opens (avoids wiping the form on data bumps).
  useEffect(() => {
    if (!visible) return;
    setForm({
      categoryId: editing?.category_id ?? null,
      amount: editing?.amount ?? 0,
      accountId: editing?.account_id ?? accounts[0]?.id ?? null,
      date: editing?.date ?? todayISO().slice(0, 10),
      receiptUri: null,
    });
    if (!editing) {
      listSellerPaymentCategories().then(setCats).catch(() => setCats([]));
      listUsedSellerCategoryIds(summary.plot.id).then(setUsedIds).catch(() => setUsedIds([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Default to the first available milestone once the list arrives (add mode).
  useEffect(() => {
    if (!editing && form.categoryId === null && available[0]) patch({ categoryId: available[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats, usedIds]);

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
  const canSave = form.amount > 0 && form.accountId !== null && form.categoryId !== null && !amountError;

  const onSave = () => {
    if (!canSave || saving || !form.accountId || !form.categoryId) return;
    void run(async () => {
      if (editing) {
        await updatePlotPayment(editing.id, { amount: form.amount, date: form.date, accountId: form.accountId! });
      } else {
        await addPlotPayment({
          plotId: summary.plot.id,
          categoryId: form.categoryId!,
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
    <View style={styles.chipHeader}>
      <View style={styles.chipRow}>
        {available.map((c) => {
          const sel = form.categoryId === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => patch({ categoryId: c.id })}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              style={[styles.chip, sel && styles.chipActive]}
            >
              <AppText size="xs" weight={sel ? 'bold' : 'semibold'} color={sel ? 'accent' : 'textSecondary'}>
                {catName(c)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {onAddCategory ? (
        <Pressable onPress={onAddCategory} accessibilityRole="button" accessibilityLabel={t('addCategoryLabel')} style={styles.addChip}>
          <AppIcon name="add" size={16} color="accent" />
        </Pressable>
      ) : null}
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
