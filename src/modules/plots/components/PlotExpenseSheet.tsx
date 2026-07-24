import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  AppIcon,
  AppText,
  ICONS,
  MoneyEntrySheet,
  ReceiptPhotoField,
  SelectSheet,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import { addPlotExpense, type AccountWithBalance, type PlotSummary } from '@/db';
import { useCategoryLabel, useModuleCategories, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';

import { makeStyles } from '../styled/PlotExpenseSheet.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  summary: PlotSummary;
  accounts: AccountWithBalance[];
  onSaved: () => Promise<void>;
}

interface Form {
  categoryId: string | null;
  amount: number;
  accountId: string | null;
  date: string;
  note: string;
  receiptUri: string | null;
}

/**
 * A plot-side expense (tax, transfer fee, naqsha, …) on the shared
 * `MoneyEntrySheet`. The category chip offers ONLY the Settings-managed "Plot"
 * categories (via `useModuleCategories('plot')`) — never another module's.
 */
export function PlotExpenseSheet({ visible, onClose, summary, accounts, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();
  const { data: categories } = useModuleCategories('plot');
  const catName = useCategoryLabel();

  const [form, setForm] = useState<Form>({ categoryId: null, amount: 0, accountId: null, date: todayISO().slice(0, 10), note: '', receiptUri: null });
  const patch = (p: Partial<Form>) => setForm((s) => ({ ...s, ...p }));
  const [catSheet, setCatSheet] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm({ categoryId: null, amount: 0, accountId: accounts[0]?.id ?? null, date: todayISO().slice(0, 10), note: '', receiptUri: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const categoryOptions: SelectOption[] = useMemo(
    () =>
      categories.map((c) => ({
        id: c.id,
        label: catName(c),
        icon: (c.icon && c.icon in ICONS ? c.icon : 'kharcha') as IconKey,
      })),
    [categories, catName]
  );

  const category = categories.find((c) => c.id === form.categoryId) ?? null;
  const account = accounts.find((a) => a.id === form.accountId) ?? null;
  const amountError = form.amount > 0 && account && form.amount > account.balance ? t('insufficientFunds') : null;
  const canSave = form.amount > 0 && form.accountId !== null && form.categoryId !== null && !amountError;

  const onSave = () => {
    if (!canSave || saving || !form.accountId || !form.categoryId) return;
    void run(async () => {
      await addPlotExpense({
        plotId: summary.plot.id,
        categoryId: form.categoryId!,
        amount: form.amount,
        date: form.date,
        accountId: form.accountId!,
        note: form.note.trim() || null,
        receiptUri: form.receiptUri,
      });
      onClose();
      await onSaved();
    });
  };

  const header = (
    <>
      <Pressable onPress={() => setCatSheet(true)} style={styles.catRow} accessibilityRole="button">
        <AppIcon name="kharcha" size={18} color="primary" />
        <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={category ? 'textPrimary' : 'textSecondary'}>
          {category ? catName(category) : t('category')}
        </AppText>
        <AppIcon name="forward" size={18} color="textSecondary" />
      </Pressable>
      <SelectSheet
        visible={catSheet}
        onClose={() => setCatSheet(false)}
        options={categoryOptions}
        selectedId={form.categoryId ?? undefined}
        title={t('category')}
        searchable={false}
        onSelect={(o) => patch({ categoryId: o.id })}
      />
    </>
  );

  return (
    <MoneyEntrySheet
      visible={visible}
      onClose={onClose}
      title={t('addExpense')}
      header={header}
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
      extra={<ReceiptPhotoField uri={form.receiptUri} onChange={(receiptUri) => patch({ receiptUri })} />}
      onSave={onSave}
      saving={saving}
      saveDisabled={!canSave}
    />
  );
}
