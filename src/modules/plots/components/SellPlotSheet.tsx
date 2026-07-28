import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AmountInput, AppButton, AppIcon, AppSheet, AppText, MoneyEntrySheet, ReceiptPhotoField } from '@/components/ui';
import {
  addPlotSaleReceipt,
  listBuyerPaymentCategories,
  listUsedBuyerCategoryIds,
  setPlotSale,
  updatePlotSaleReceipt,
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

/** Which form the sheet shows: agree the deal, or receive buyer money. */
export type SellPlotSheetMode = 'price' | 'receipt';

/** Buyer-payment types usable at most once per sale. */
const ONCE_ONLY = ['Token', 'Advance'];

interface Props {
  visible: boolean;
  mode: SellPlotSheetMode;
  onClose: () => void;
  /** The plot being flipped (must NOT belong to a project — repo guard). */
  summary: PlotSummary;
  accounts: AccountWithBalance[];
  /** Pass a buyer payment to edit in place (receipt mode only). */
  editing?: TransactionRow | null;
  /** Jump to Settings → Plot to add a new buyer-payment category. */
  onAddCategory?: () => void;
  onSaved: () => Promise<void>;
}

/**
 * The STANDALONE plot sale (a flip without a project). `price` mode records the
 * agreed sale price + buyer (`setPlotSale`); `receipt` mode posts — or edits —
 * buyer money on the shared `MoneyEntrySheet`. The milestone chips are the
 * Settings-managed "Buyer Payment" categories. Capped at the outstanding amount;
 * the plot flips to SOLD once fully received, and back when a payment is removed.
 */
export function SellPlotSheet({ visible, mode, onClose, summary, accounts, editing, onAddCategory, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();
  const catName = useCategoryLabel();
  const { plot } = summary;

  // Price form
  const [price, setPrice] = useState(0);
  const [buyer, setBuyer] = useState('');

  // Receipt form
  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [usedIds, setUsedIds] = useState<string[]>([]);
  const available = cats.filter((c) => !(ONCE_ONLY.includes(c.name_en) && usedIds.includes(c.id)));
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  // Fresh form per open; the account keeps its last choice (default: first).
  useEffect(() => {
    if (!visible) return;
    setPrice(summary.salePrice);
    setBuyer(summary.plot.buyer_name ?? '');
    setAmount(editing?.amount ?? 0);
    setCategoryId(editing?.category_id ?? null);
    setDate(editing?.date ?? todayISO().slice(0, 10));
    setReceiptUri(null);
    setAccountId((prev) => editing?.account_id ?? prev ?? accounts[0]?.id ?? null);
    if (mode === 'receipt' && !editing) {
      listBuyerPaymentCategories().then(setCats).catch(() => setCats([]));
      listUsedBuyerCategoryIds(summary.plot.id).then(setUsedIds).catch(() => setUsedIds([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode]);

  // Default to the first available milestone once the list arrives (add mode).
  useEffect(() => {
    if (mode === 'receipt' && !editing && categoryId === null && available[0]) setCategoryId(available[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats, usedIds]);

  const onSavePrice = () => {
    if (price <= 0 || saving) return;
    void run(async () => {
      await setPlotSale({ plotId: plot.id, salePrice: price, buyerName: buyer.trim() || null });
      onClose();
      await onSaved();
    });
  };

  const ownAmount = editing?.amount ?? 0;
  const outstandingCap = summary.saleOutstanding + ownAmount;

  const onSaveReceipt = () => {
    if (amount <= 0 || !accountId || saving) return;
    void run(async () => {
      if (editing) {
        await updatePlotSaleReceipt(editing.id, { amount, date, accountId: accountId! });
      } else {
        await addPlotSaleReceipt({ plotId: plot.id, amount, date, accountId: accountId!, categoryId, receiptUri });
      }
      onClose();
      await onSaved();
    });
  };

  if (mode === 'price') {
    return (
      <AppSheet
        visible={visible}
        onClose={onClose}
        title={t('sellPlot')}
        footer={<AppButton label={t('save')} icon="check" onPress={onSavePrice} loading={saving} disabled={price <= 0} fullWidth />}
      >
        <AmountInput label={t('salePriceLabel')} value={price} onChange={setPrice} floating surface={theme.colors.card} autoFocus />
        <FloatingLabelInput label={t('buyerName')} value={buyer} onChangeText={setBuyer} />
      </AppSheet>
    );
  }

  const amountError = amount > 0 && amount > outstandingCap ? t('exceedsRemaining') : null;
  const canSave = amount > 0 && !!accountId && categoryId !== null && !amountError;
  const header = editing ? null : (
    <View style={styles.chipHeader}>
      <View style={styles.chipRow}>
        {available.map((c) => {
          const sel = categoryId === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(c.id)}
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
      title={editing ? t('editReceipt') : t('addReceipt')}
      subtitle={`${t('remaining')}: ${formatRupees(outstandingCap)}`}
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
      onSave={onSaveReceipt}
      saving={saving}
      saveDisabled={!canSave}
    />
  );
}
