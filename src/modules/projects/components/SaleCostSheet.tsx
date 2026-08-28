import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, MoneyEntrySheet } from '@/components/ui';
import {
  addSaleCost,
  updateTransaction,
  type AccountWithBalance,
  type TransactionRow,
} from '@/db';
import { useCategoryLabel, useModuleCategories, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';

import { makeStyles } from '../styled/SaleSheets.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  accounts: AccountWithBalance[];
  /** Pass a sale cost to edit in place; omit/null to add a new one. */
  editing?: TransactionRow | null;
  onSaved: () => Promise<void>;
}

/**
 * A seller-side sale cost (dealer commission / transfer / tax …) — add or edit
 * in place — on the shared `MoneyEntrySheet`. The category chips are the
 * Settings-managed "Sale" section.
 */
export function SaleCostSheet({ visible, onClose, projectId, accounts, editing, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();
  const { data: cats } = useModuleCategories('sale');
  const catLabel = useCategoryLabel();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    setCategoryId(editing?.category_id ?? null);
    setAmount(editing?.amount ?? 0);
    setDate(editing?.date ?? todayISO().slice(0, 10));
    setNote(editing?.description ?? '');
    setAccountId((prev) => editing?.account_id ?? prev ?? accounts[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const account = accounts.find((a) => a.id === accountId) ?? null;
  const ownAmount = editing?.amount ?? 0;
  const accountCap = account ? account.balance + (editing && editing.account_id === account.id ? ownAmount : 0) : 0;
  const amountError = amount > 0 && account && amount > accountCap ? t('insufficientFunds') : null;
  const canSave = amount > 0 && !!accountId && !!categoryId && !amountError;

  const onSave = () => {
    if (!canSave || saving || !accountId || !categoryId) return;
    void run(async () => {
      if (editing) {
        await updateTransaction(editing.id, { amount, date, accountId, categoryId, description: note.trim() || null });
      } else {
        await addSaleCost({ projectId, categoryId, name: note.trim() || null, amount, date, accountId });
      }
      onClose();
      await onSaved();
    });
  };

  const header = (
    <View style={styles.chipRow}>
      {cats.map((c) => {
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
              {catLabel(c)}
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
      title={editing ? t('editExpense') : t('addExpense')}
      header={header}
      amount={amount}
      onAmountChange={setAmount}
      amountError={amountError}
      accounts={accounts}
      accountId={accountId}
      onAccountChange={setAccountId}
      date={date}
      onDateChange={setDate}
      note={note}
      onNoteChange={setNote}
      onSave={onSave}
      saving={saving}
      saveDisabled={!canSave}
    />
  );
}
