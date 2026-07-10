import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AmountInput,
  AppButton,
  AppIcon,
  AppText,
  ICONS,
  SelectSheet,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import { addTransaction, type AccountWithBalance, type CategoryRow } from '@/db';
import { useAccountOptions, useCategoryLabel, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

interface AddExpenseSheetProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  /** Construction-phase expense categories (pre-filtered by the screen). */
  categories: CategoryRow[];
  accounts: AccountWithBalance[];
  /** Reload the screen's data after the expense is posted. */
  onSaved: () => Promise<void>;
}

/**
 * Bottom sheet that posts a construction-phase expense: category + amount +
 * paying account + optional note. Owns its own form state; the amount, note
 * and category reset on every open while the chosen account sticks (like the
 * quick-entry screens).
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
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const catLabel = useCategoryLabel();
  const { saving, run } = useSaveAction();

  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [catSheet, setCatSheet] = useState(false);
  const [accountSheet, setAccountSheet] = useState(false);

  // Fresh form per open; the account keeps its last choice (default: first).
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  useEffect(() => {
    if (!visible) return;
    setAmount(0);
    setCategoryId(null);
    setNote('');
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
  const accountOptions = useAccountOptions(accounts);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  const onSave = (): void => {
    if (amount <= 0 || !accountId) return;
    void run(async () => {
      await addTransaction({
        direction: 'OUT',
        amount,
        date: todayISO().slice(0, 10),
        accountId,
        projectId,
        phase: 'CONSTRUCTION',
        categoryId,
        description: note || null,
      });
      onClose();
      await onSaved();
    });
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold">
            {t('addExpense')}
          </AppText>

          {/* Category */}
          <Pressable onPress={() => setCatSheet(true)} style={styles.rowChip} accessibilityRole="button">
            <AppIcon name="material" size={18} color="primary" />
            <AppText
              size="sm"
              weight="semibold"
              numberOfLines={1}
              style={styles.flex}
              color={selectedCategory ? 'textPrimary' : 'textSecondary'}
            >
              {selectedCategory ? catLabel(selectedCategory) : t('material')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <AmountInput value={amount} onChange={setAmount} floating surface={theme.colors.card} />

          {/* Account */}
          <Pressable onPress={() => setAccountSheet(true)} style={styles.rowChip} accessibilityRole="button">
            <AppIcon name={selectedAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
            <AppText
              size="sm"
              weight="semibold"
              numberOfLines={1}
              style={styles.flex}
              color={selectedAccount ? 'textPrimary' : 'textSecondary'}
            >
              {selectedAccount
                ? `${selectedAccount.name} · ${formatRupees(selectedAccount.balance)}`
                : t('selectAccount')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <FloatingLabelInput label={t('note')} value={note} onChangeText={setNote} />

          <AppButton
            label={t('save')}
            icon="check"
            onPress={onSave}
            loading={saving}
            disabled={
              amount <= 0 ||
              !accountId ||
              (!!selectedAccount && amount > selectedAccount.balance)
            }
          />
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <SelectSheet
        visible={catSheet}
        onClose={() => setCatSheet(false)}
        options={categoryOptions}
        selectedId={categoryId ?? undefined}
        title={t('material')}
        onSelect={(o) => setCategoryId(o.id)}
      />
      <SelectSheet
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        options={accountOptions}
        selectedId={accountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setAccountId(o.id)}
      />
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
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
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.overlay,
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
      ...theme.shadows.raised,
    },
    grabber: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
    },
  });
