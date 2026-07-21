import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, MoneyEntrySheet } from '@/components/ui';
import { payLaborer, updateLaborPayment, type AccountWithBalance, type LaborerProjectParticipation, type TransactionRow } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/PayWorkerSheet.styles';

interface PayWorkerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** All of the worker's participations; only those still owed are payable. */
  participations: LaborerProjectParticipation[];
  accounts: AccountWithBalance[];
  /** Pass a payment to edit in place; omit/null to add a new one. */
  editing?: TransactionRow | null;
  /** Reload the khata after the payment lands. */
  onSaved: () => Promise<void>;
}

interface Form {
  plId: string | null;
  amount: number;
  accountId: string | null;
  date: string;
  note: string;
}

/**
 * Pay a worker — or edit a wage payment in place — on the shared `MoneyEntrySheet`.
 * A payment always books to ONE participation (that project's cost); the header
 * chips pick which when adding. Editing fixes the participation to the payment's
 * own and frees its amount back into the owed cap.
 */
export function PayWorkerSheet({
  visible,
  onClose,
  participations,
  accounts,
  editing,
  onSaved,
}: PayWorkerSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();

  const payables = participations.filter((p) => p.balance.balance > 0);
  const [form, setForm] = useState<Form>({ plId: null, amount: 0, accountId: null, date: todayISO().slice(0, 10), note: '' });
  const patch = (p: Partial<Form>) => setForm((s) => ({ ...s, ...p }));

  // Reset ONLY when the sheet opens. Keying on participations/accounts (which
  // get new refs on every global data-version bump) used to wipe the amount
  // mid-typing on any unrelated save — the sheet's headline bug.
  useEffect(() => {
    if (!visible) return;
    setForm({
      plId: editing?.labor_id ?? payables[0]?.projectLaborer.id ?? null,
      amount: editing?.amount ?? 0,
      accountId: editing?.account_id ?? accounts[0]?.id ?? null,
      date: editing?.date ?? todayISO().slice(0, 10),
      note: editing?.description ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Editing fixes the participation to the payment's own (even if now fully paid).
  const selected = editing
    ? participations.find((p) => p.projectLaborer.id === editing.labor_id) ?? null
    : payables.find((p) => p.projectLaborer.id === form.plId) ?? null;
  const ownAmount = editing?.amount ?? 0;
  const owed = (selected?.balance.balance ?? 0) + ownAmount;
  const account = accounts.find((a) => a.id === form.accountId) ?? null;
  const accountCap = account ? account.balance + (editing && editing.account_id === account.id ? ownAmount : 0) : 0;

  const amountError =
    form.amount <= 0
      ? null
      : form.amount > owed
        ? t('exceedsRemaining')
        : account && form.amount > accountCap
          ? t('insufficientFunds')
          : null;

  const canSave = form.amount > 0 && form.plId !== null && form.accountId !== null && !amountError;

  const onSave = (): void => {
    if (!canSave || saving || !form.plId || !form.accountId) return;
    void run(async () => {
      if (editing) {
        await updateLaborPayment(editing.id, {
          amount: form.amount,
          date: form.date,
          accountId: form.accountId!,
          note: form.note.trim() || null,
        });
      } else {
        await payLaborer({ projectLaborerId: form.plId!, amount: form.amount, date: form.date, accountId: form.accountId!, note: form.note.trim() || null });
      }
      onClose();
      await onSaved();
    });
  };

  const header = (
    <>
      {!editing && payables.length > 1 ? (
        <View style={styles.chipWrap}>
          {payables.map((p) => {
            const sel = form.plId === p.projectLaborer.id;
            return (
              <Pressable
                key={p.projectLaborer.id}
                onPress={() => patch({ plId: p.projectLaborer.id })}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                style={[styles.pillChip, sel && styles.pillChipActive]}
              >
                <AppText size="sm" weight="semibold" color={sel ? 'accent' : 'textPrimary'}>
                  {`${p.projectName} · ${formatRupees(p.balance.balance)}`}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Pressable
        onPress={() => patch({ amount: owed })}
        accessibilityRole="button"
        accessibilityLabel={`${t('owedToWorker')} ${formatRupees(owed)}`}
      >
        <AppText size="sm" weight="semibold" color="accent">
          {`${t('owedToWorker')}: ${formatRupees(owed)}`}
        </AppText>
      </Pressable>
    </>
  );

  return (
    <MoneyEntrySheet
      visible={visible}
      onClose={onClose}
      title={editing ? t('editPayment') : t('payWorker')}
      header={header}
      amount={form.amount}
      onAmountChange={(v) => patch({ amount: v })}
      amountError={amountError}
      accounts={accounts}
      accountId={form.accountId}
      onAccountChange={(id) => patch({ accountId: id })}
      date={form.date}
      onDateChange={(d) => patch({ date: d })}
      note={form.note}
      onNoteChange={(note) => patch({ note })}
      onSave={onSave}
      saving={saving}
      saveLabel={editing ? t('save') : t('payWorker')}
      saveDisabled={!canSave}
    />
  );
}
