import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, MoneyEntrySheet } from '@/components/ui';
import { payLaborer, type AccountWithBalance, type LaborerProjectParticipation } from '@/db';
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
  /** Reload the khata after the payment lands. */
  onSaved: () => Promise<void>;
}

interface Form {
  plId: string | null;
  amount: number;
  accountId: string | null;
  date: string;
}

/**
 * Pay a worker from their khata — on the shared `MoneyEntrySheet`. A payment
 * always books to ONE participation (that project's cost); when owed on several,
 * the header chips pick which. Owed hint quick-fills and caps the amount (V-9),
 * and the date is back-datable.
 */
export function PayWorkerSheet({
  visible,
  onClose,
  participations,
  accounts,
  onSaved,
}: PayWorkerSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();

  const payables = participations.filter((p) => p.balance.balance > 0);
  const [form, setForm] = useState<Form>({ plId: null, amount: 0, accountId: null, date: todayISO().slice(0, 10) });
  const patch = (p: Partial<Form>) => setForm((s) => ({ ...s, ...p }));

  // Reset ONLY when the sheet opens. Keying on participations/accounts (which
  // get new refs on every global data-version bump) used to wipe the amount
  // mid-typing on any unrelated save — the sheet's headline bug.
  useEffect(() => {
    if (!visible) return;
    setForm({
      plId: payables[0]?.projectLaborer.id ?? null,
      amount: 0,
      accountId: accounts[0]?.id ?? null,
      date: todayISO().slice(0, 10),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const selected = payables.find((p) => p.projectLaborer.id === form.plId) ?? null;
  const owed = selected?.balance.balance ?? 0;
  const account = accounts.find((a) => a.id === form.accountId) ?? null;

  const amountError =
    form.amount <= 0
      ? null
      : form.amount > owed
        ? t('exceedsRemaining')
        : account && form.amount > account.balance
          ? t('insufficientFunds')
          : null;

  const canSave =
    form.amount > 0 &&
    form.plId !== null &&
    form.accountId !== null &&
    form.amount <= owed &&
    (!account || form.amount <= account.balance);

  const onSave = (): void => {
    if (!canSave || saving || !form.plId || !form.accountId) return;
    void run(async () => {
      await payLaborer({ projectLaborerId: form.plId!, amount: form.amount, date: form.date, accountId: form.accountId! });
      onClose();
      await onSaved();
    });
  };

  const header = (
    <>
      {payables.length > 1 ? (
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
      icon="moneyOut"
      title={t('payWorker')}
      header={header}
      amount={form.amount}
      onAmountChange={(v) => patch({ amount: v })}
      amountError={amountError}
      accounts={accounts}
      accountId={form.accountId}
      onAccountChange={(id) => patch({ accountId: id })}
      date={form.date}
      onDateChange={(d) => patch({ date: d })}
      onSave={onSave}
      saving={saving}
      saveLabel={t('payWorker')}
      saveDisabled={!canSave}
    />
  );
}
