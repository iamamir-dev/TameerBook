import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AmountInput, AppButton, AppSheet, AppText, MoneyEntrySheet, ReceiptPhotoField } from '@/components/ui';
import {
  addPlotSaleReceipt,
  listUsedPayTypes,
  ONCE_PAY_TYPES,
  PAY_TYPE_LABEL_KEYS,
  PAY_TYPES,
  setPlotSale,
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

/** Which form the sheet shows: agree the deal, or receive buyer money. */
export type SellPlotSheetMode = 'price' | 'receipt';

interface Props {
  visible: boolean;
  mode: SellPlotSheetMode;
  onClose: () => void;
  /** The plot being flipped (must NOT belong to a project — repo guard). */
  summary: PlotSummary;
  accounts: AccountWithBalance[];
  onSaved: () => Promise<void>;
}

/**
 * The STANDALONE plot sale (a flip without a project). `price` mode records the
 * agreed sale price + buyer (`setPlotSale`); `receipt` mode posts buyer money on
 * the shared `MoneyEntrySheet` (`addPlotSaleReceipt`), capped at the outstanding
 * amount. The plot flips to SOLD automatically once fully received.
 */
export function SellPlotSheet({ visible, mode, onClose, summary, accounts, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();
  const { plot } = summary;

  // Price form
  const [price, setPrice] = useState(0);
  const [buyer, setBuyer] = useState('');

  // Receipt form
  const [amount, setAmount] = useState(0);
  const [payType, setPayType] = useState<PayType | null>(null);
  const [usedPayTypes, setUsedPayTypes] = useState<PayType[]>([]);
  const available = PAY_TYPES.filter((pt) => !ONCE_PAY_TYPES.includes(pt) || !usedPayTypes.includes(pt));
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  // Fresh form per open; the account keeps its last choice (default: first).
  useEffect(() => {
    if (!visible) return;
    setPrice(summary.salePrice);
    setBuyer(summary.plot.buyer_name ?? '');
    setAmount(0);
    setPayType(null);
    setDate(todayISO().slice(0, 10));
    setReceiptUri(null);
    setAccountId((prev) => prev ?? accounts[0]?.id ?? null);
    if (mode === 'receipt') {
      listUsedPayTypes(summary.plot.id, 'SALE', 'IN').then(setUsedPayTypes).catch(() => setUsedPayTypes([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode]);

  const onSavePrice = () => {
    if (price <= 0 || saving) return;
    void run(async () => {
      await setPlotSale({ plotId: plot.id, salePrice: price, buyerName: buyer.trim() || null });
      onClose();
      await onSaved();
    });
  };

  const onSaveReceipt = () => {
    if (amount <= 0 || !accountId || saving) return;
    void run(async () => {
      await addPlotSaleReceipt({ plotId: plot.id, amount, date, accountId: accountId!, payType, receiptUri });
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

  const amountError = amount > 0 && amount > summary.saleOutstanding ? t('exceedsRemaining') : null;
  const header = (
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
      title={t('addReceipt')}
      subtitle={`${t('remaining')}: ${formatRupees(summary.saleOutstanding)}`}
      header={header}
      amount={amount}
      onAmountChange={setAmount}
      amountError={amountError}
      accounts={accounts}
      accountId={accountId}
      onAccountChange={setAccountId}
      date={date}
      onDateChange={setDate}
      extra={<ReceiptPhotoField uri={receiptUri} onChange={setReceiptUri} />}
      onSave={onSaveReceipt}
      saving={saving}
      saveDisabled={amount <= 0 || !accountId || !!amountError}
    />
  );
}
