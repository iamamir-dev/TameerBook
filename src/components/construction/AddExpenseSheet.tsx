import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AccountPickerRow,
  AmountInput,
  AppButton,
  AppIcon,
  AppSheet,
  AppText,
  DateField,
  ICONS,
  QtyUnitRow,
  SelectSheet,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import { addTransaction, type AccountWithBalance, type CategoryRow } from '@/db';
import { useCategoryLabel, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import type { UnitDef } from '@/utils/units';

interface AddExpenseSheetProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  /** Construction-phase expense categories (pre-filtered by the screen). */
  categories: CategoryRow[];
  accounts: AccountWithBalance[];
  onSaved: () => Promise<void>;
}

/**
 * Post a construction-phase expense: category (required, V-11) + amount + qty
 * (secondary-unit aware via QtyUnitRow) + account + note. On the shared AppSheet.
 */
export function AddExpenseSheet({
  visible,
  onClose,
  projectId,
  categories,
  accounts,
  onSaved,
}: AddExpenseSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const catLabel = useCategoryLabel();
  const { saving, run } = useSaveAction();

  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [qty, setQty] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [catSheet, setCatSheet] = useState(false);

  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  useEffect(() => {
    if (!visible) return;
    setAmount(0);
    setCategoryId(null);
    setQty(0);
    setNote('');
    setDate(todayISO().slice(0, 10));
    setAccountId((prev) => prev ?? accountsRef.current[0]?.id ?? null);
  }, [visible]);

  const categoryOptions: SelectOption[] = useMemo(
    () =>
      categories.map((c) => ({
        id: c.id,
        label: catLabel(c),
        icon: (c.icon && c.icon in ICONS ? c.icon : 'kharcha') as IconKey,
      })),
    [categories, catLabel]
  );

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;
  const unit: UnitDef | null = selectedCategory?.default_unit
    ? { primary: selectedCategory.default_unit, secondary: selectedCategory.secondary_unit, factor: selectedCategory.secondary_factor }
    : null;

  const onSave = (): void => {
    if (amount <= 0 || !accountId || !categoryId) return;
    void run(async () => {
      await addTransaction({
        direction: 'OUT',
        amount,
        date,
        accountId,
        projectId,
        phase: 'CONSTRUCTION',
        categoryId,
        qty: qty > 0 ? qty : null,
        description: note || null,
      });
      onClose();
      await onSaved();
    });
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={t('addExpense')}
      footer={
        <AppButton
          label={t('save')}
          icon="check"
          onPress={onSave}
          loading={saving}
          disabled={amount <= 0 || !accountId || !categoryId || (!!selectedAccount && amount > selectedAccount.balance)}
        />
      }
    >
      <Pressable onPress={() => setCatSheet(true)} style={styles.rowChip} accessibilityRole="button">
        <AppIcon name="kharcha" size={18} color="primary" />
        <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={selectedCategory ? 'textPrimary' : 'textSecondary'}>
          {selectedCategory ? catLabel(selectedCategory) : t('category')}
        </AppText>
        <AppIcon name="forward" size={18} color="textSecondary" />
      </Pressable>
      {!categoryId ? (
        <AppText size="xs" color="textSecondary" style={styles.hint}>
          {t('categoryRequired')}
        </AppText>
      ) : null}

      <AmountInput
        value={amount}
        onChange={setAmount}
        floating
        surface={theme.colors.card}
        error={amount > 0 && !!selectedAccount && amount > selectedAccount.balance ? t('insufficientFunds') : null}
      />

      <AccountPickerRow accounts={accounts} selectedId={accountId} onSelect={setAccountId} />

      {/* Quantity — secondary-unit aware when the category carries a unit. */}
      {unit ? <QtyUnitRow unit={unit} resetToken={`${visible}-${categoryId}`} onQty={setQty} /> : null}

      <FloatingLabelInput label={t('note')} value={note} onChangeText={setNote} />
      <DateField value={date} onChange={setDate} />

      <SelectSheet
        visible={catSheet}
        onClose={() => setCatSheet(false)}
        options={categoryOptions}
        selectedId={categoryId ?? undefined}
        title={t('category')}
        onSelect={(o) => setCategoryId(o.id)}
      />
    </AppSheet>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    hint: { paddingHorizontal: theme.spacing.sm, marginTop: -theme.spacing.xs },
    rowChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      minHeight: theme.touch.minTarget,
    },
  });
