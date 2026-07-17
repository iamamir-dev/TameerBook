import React, { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import {
  AppIcon,
  AppText,
  MoneyEntrySheet,
  SelectSheet,
  type IconKey,
} from '@/components/ui';
import {
  addInvestment,
  investFromBalance,
  updateTransaction,
  type AccountWithBalance,
  type TransactionRow,
} from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/InvestorMoneySheet.styles';

export type MoneyMode = 'new' | 'balance' | 'edit' | null;

interface ProjectOption {
  id: string;
  name: string;
}

interface InvestorMoneySheetProps {
  investorId: string;
  mode: MoneyMode;
  editTxn?: TransactionRow | null;
  projects: ProjectOption[];
  accounts: AccountWithBalance[];
  available: number;
  defaultProjectId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  amount: number;
  date: string;
  projectId: string | null;
  accountId: string | null;
  note: string;
}

/**
 * The ONE investor money sheet — new investment (fresh cash), invest from
 * existing balance (returned capital + profit, no new cash), or edit an existing
 * cash transaction in place. All three share the `MoneyEntrySheet` layout; the
 * only differences are the account row (hidden for from-balance) and the target
 * project chip (hidden when editing).
 */
export function InvestorMoneySheet({
  investorId,
  mode,
  editTxn,
  projects,
  accounts,
  available,
  defaultProjectId,
  onClose,
  onSaved,
}: InvestorMoneySheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run: runSave } = useSaveAction();

  const [form, setForm] = useState<FormState>({
    amount: 0,
    date: todayISO().slice(0, 10),
    projectId: defaultProjectId,
    accountId: accounts[0]?.id ?? null,
    note: '',
  });
  const [projectSheet, setProjectSheet] = useState(false);

  // Reset the form whenever the sheet opens in a mode / for a txn.
  useEffect(() => {
    if (!mode) return;
    if (mode === 'edit' && editTxn) {
      setForm({
        amount: editTxn.amount,
        date: editTxn.date.slice(0, 10),
        projectId: editTxn.project_id,
        accountId: editTxn.account_id,
        note: editTxn.description ?? '',
      });
    } else {
      setForm({
        amount: 0,
        date: todayISO().slice(0, 10),
        projectId: defaultProjectId,
        accountId: accounts[0]?.id ?? null,
        note: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, editTxn]);

  const patch = (p: Partial<FormState>) => setForm((s) => ({ ...s, ...p }));

  const amountError =
    mode === 'balance' && form.amount > available + 0.001
      ? `${t('availableBalance')}: ${formatRupees(available)}`
      : null;

  const saveDisabled =
    form.amount <= 0 ||
    (mode !== 'edit' && !form.projectId) ||
    (mode === 'new' && !form.accountId) ||
    !!amountError;

  const onSave = async () => {
    if (!mode || saveDisabled) return;
    const ok = await runSave(async () => {
      if (mode === 'new') {
        await addInvestment({
          investorId,
          projectId: form.projectId!,
          amount: form.amount,
          date: form.date,
          accountId: form.accountId!,
        });
      } else if (mode === 'balance') {
        await investFromBalance({
          investorId,
          projectId: form.projectId!,
          amount: form.amount,
          date: form.date,
        });
      } else if (editTxn) {
        await updateTransaction(editTxn.id, {
          amount: form.amount,
          date: form.date,
          accountId: form.accountId,
          description: form.note || null,
        });
      }
    });
    if (ok) onSaved();
  };

  const selectedProject = projects.find((p) => p.id === form.projectId) ?? null;
  const title = mode === 'new' ? t('newInvestment') : mode === 'balance' ? t('investFromBalance') : t('edit');

  return (
    <>
      {mode ? (
        <MoneyEntrySheet
          visible
          onClose={onClose}
          title={title}
          amount={form.amount}
          onAmountChange={(v) => patch({ amount: v })}
          amountError={amountError}
          accounts={mode === 'balance' ? undefined : accounts}
          accountId={form.accountId}
          onAccountChange={mode === 'balance' ? undefined : (id) => patch({ accountId: id })}
          date={form.date}
          onDateChange={(d) => patch({ date: d })}
          note={form.note}
          onNoteChange={(v) => patch({ note: v })}
          onSave={onSave}
          saving={saving}
          saveDisabled={saveDisabled}
          header={
            mode !== 'edit' ? (
              <Pressable onPress={() => setProjectSheet(true)} style={styles.projectChip} accessibilityRole="button">
                <AppIcon name="project" size={18} color="primary" />
                <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
                  {selectedProject?.name ?? t('selectProject')}
                </AppText>
                <AppIcon name="forward" size={18} color="textSecondary" />
              </Pressable>
            ) : undefined
          }
        />
      ) : null}

      <SelectSheet
        visible={projectSheet}
        onClose={() => setProjectSheet(false)}
        options={projects.map((p) => ({ id: p.id, label: p.name, icon: 'project' as IconKey }))}
        selectedId={form.projectId ?? undefined}
        title={t('selectProject')}
        onSelect={(o) => patch({ projectId: o.id })}
      />
    </>
  );
}
