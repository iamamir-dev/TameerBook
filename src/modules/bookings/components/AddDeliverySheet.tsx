import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AccountPickerRow,
  AmountInput,
  AppButton,
  AppIcon,
  AppSheet,
  AppText,
  AppToggle,
  DateField,
  QtyUnitRow,
  SelectSheet,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import { addDelivery, receiveAndPay, updateDelivery, type AccountWithBalance, type MaterialDeliveryRow, type ProjectRow } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';
import { formatQty, formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/AddDeliverySheet.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  bookingProjectId: string | null;
  qtyRemaining: number;
  unit: string | null;
  payRemaining: number;
  accounts: AccountWithBalance[];
  /** Active projects (for the receiving-project picker). */
  projects: ProjectRow[];
  /** Pass a delivery to edit in place; omit/null to record a new one. */
  editing?: MaterialDeliveryRow | null;
  onSaved: () => Promise<void> | void;
}

interface Form {
  qty: number;
  date: string;
  note: string;
  receivingProjectId: string | null;
  paidNow: boolean;
  payAmount: number;
  accountId: string | null;
}

/**
 * Record material arriving against a booking. Quantity via the shared
 * QtyUnitRow; can be routed to a DIFFERENT project (cost follows the material);
 * "also paid now" pays the supplier in the SAME atomic write (receiveAndPay).
 */
export function AddDeliverySheet({
  visible,
  onClose,
  bookingId,
  bookingProjectId,
  qtyRemaining,
  unit,
  payRemaining,
  accounts,
  projects,
  editing,
  onSaved,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const today = todayISO().slice(0, 10);
  const { saving, run: runSave } = useSaveAction();

  const [form, setForm] = useState<Form>({
    qty: 0,
    date: today,
    note: '',
    receivingProjectId: bookingProjectId,
    paidNow: false,
    payAmount: 0,
    accountId: null,
  });
  const patch = (p: Partial<Form>) => setForm((s) => ({ ...s, ...p }));

  useEffect(() => {
    if (!visible) return;
    setForm({
      qty: editing?.qty ?? 0,
      date: editing?.date ?? today,
      note: editing?.note ?? '',
      receivingProjectId: editing ? editing.project_id ?? bookingProjectId : bookingProjectId,
      paidNow: false,
      payAmount: 0,
      accountId: accounts[0]?.id ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Destination: choose which project this delivery lands in. Default is the
  // booking's own project; picking another moves the cost there (project-to-
  // project). A general booking can attribute to a project or stay unassigned.
  const [projectSheet, setProjectSheet] = useState(false);
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE');
  const projectOptions: SelectOption[] = activeProjects.map((p) => ({ id: p.id, label: p.name, icon: 'project' as IconKey }));
  // A destination is required; show the picker when there's a choice OR nothing
  // is selected yet (e.g. a general booking delivering into a project).
  const showProjectPicker = projectOptions.length > 1 || !form.receivingProjectId;
  const receiving = projects.find((p) => p.id === form.receivingProjectId) ?? null;

  const account = accounts.find((a) => a.id === form.accountId) ?? null;
  // Editing frees the edited row's own qty back into the remaining cap.
  const qtyCap = qtyRemaining + (editing?.qty ?? 0);
  const over = form.qty > qtyCap + 0.001;
  const payError =
    !form.paidNow || form.payAmount <= 0
      ? null
      : form.payAmount > payRemaining
        ? t('exceedsRemaining')
        : account && form.payAmount > account.balance
          ? t('insufficientFunds')
          : null;
  const canSave =
    form.qty > 0 &&
    !over &&
    !!form.receivingProjectId &&
    (!form.paidNow || (form.payAmount > 0 && !!form.accountId && !payError));
  const remainingText = `${formatQty(qtyCap)}${unit ? ` ${unit}` : ''}`;

  // project_id sent only when it differs from the booking's own project.
  const deliveryProjectId =
    form.receivingProjectId && form.receivingProjectId !== bookingProjectId ? form.receivingProjectId : null;

  const onSave = () => {
    if (!canSave || saving) return;
    void (async () => {
      const ok = await runSave(async () => {
        if (editing) {
          await updateDelivery(editing.id, {
            qty: form.qty,
            date: form.date,
            projectId: deliveryProjectId,
            note: form.note.trim() || null,
          });
        } else if (form.paidNow && form.accountId) {
          await receiveAndPay({
            bookingId,
            qty: form.qty,
            date: form.date,
            projectId: deliveryProjectId,
            note: form.note.trim() || null,
            payAmount: form.payAmount,
            accountId: form.accountId,
          });
        } else {
          await addDelivery({ bookingId, qty: form.qty, date: form.date, projectId: deliveryProjectId, note: form.note.trim() || null });
        }
        await onSaved();
      });
      if (ok) onClose();
    })();
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={editing ? t('editDelivery') : t('addDelivery')}
      footer={<AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!canSave} />}
    >
      <AppText size="sm" weight="semibold" color="accent">
        {`${t('remainingQty')}: ${remainingText}`}
      </AppText>

      <QtyUnitRow
        unit={{ primary: unit, secondary: null, factor: null }}
        resetToken={visible}
        onQty={(qty) => patch({ qty })}
        error={over ? t('exceedsRemaining') : null}
      />

      {/* Route this delivery to another project (cost follows the material). */}
      {showProjectPicker ? (
        <View style={styles.field}>
          <AppText size="xs" weight="semibold" color="textSecondary">
            {t('deliverToProject')}
          </AppText>
          <Pressable onPress={() => setProjectSheet(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name="project" size={18} color="primary" />
            <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={receiving ? 'textPrimary' : 'textSecondary'}>
              {receiving?.name ?? t('selectProject')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.field}>
        <AppText size="xs" weight="semibold" color="textSecondary">
          {t('date')}
        </AppText>
        <DateField value={form.date} onChange={(d) => patch({ date: d })} maxDate={today} />
      </View>

      <FloatingLabelInput label={t('note')} value={form.note} onChangeText={(v) => patch({ note: v })} multiline />

      {/* Paying now only makes sense for a NEW delivery; editing a delivery
          leaves the supplier payment to its own edit flow. */}
      {!editing ? (
        <>
          <View style={styles.toggleRow}>
            <AppText size="sm" weight="semibold" style={styles.flex}>
              {t('alsoPaidNow')}
            </AppText>
            <AppToggle value={form.paidNow} onValueChange={(paidNow) => patch({ paidNow })} accessibilityLabel={t('alsoPaidNow')} />
          </View>

          {form.paidNow ? (
            <>
              <Pressable onPress={() => patch({ payAmount: Math.round(payRemaining) })} accessibilityRole="button">
                <AppText size="sm" weight="semibold" color="accent">
                  {`${t('payRemainingLabel')}: ${formatRupees(payRemaining)}`}
                </AppText>
              </Pressable>
              <AmountInput label={t('amount')} value={form.payAmount} onChange={(payAmount) => patch({ payAmount })} floating surface={theme.colors.card} error={payError} />
              <AccountPickerRow accounts={accounts} selectedId={form.accountId} onSelect={(accountId) => patch({ accountId })} />
            </>
          ) : null}
        </>
      ) : null}

      <SelectSheet
        visible={projectSheet}
        onClose={() => setProjectSheet(false)}
        options={projectOptions}
        selectedId={form.receivingProjectId ?? ''}
        title={t('deliverToProject')}
        searchable={false}
        onSelect={(o) => patch({ receivingProjectId: o.id })}
      />
    </AppSheet>
  );
}
