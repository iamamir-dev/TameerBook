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
import { addDelivery, receiveAndPay, type AccountWithBalance, type ProjectRow } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';
import { formatPakistaniGrouping, formatRupees } from '@/utils/money';

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
  /** Active projects (for the cross-project receiving picker). */
  projects: ProjectRow[];
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
      qty: 0,
      date: today,
      note: '',
      receivingProjectId: bookingProjectId,
      paidNow: false,
      payAmount: 0,
      accountId: accounts[0]?.id ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Cross-project only offered when the booking belongs to a project.
  const otherProjects = bookingProjectId ? projects.filter((p) => p.status === 'ACTIVE') : [];
  const showProjectPicker = otherProjects.length > 1;
  const [projectSheet, setProjectSheet] = useState(false);
  const receiving = projects.find((p) => p.id === form.receivingProjectId) ?? null;
  const projectOptions: SelectOption[] = otherProjects.map((p) => ({ id: p.id, label: p.name, icon: 'project' as IconKey }));

  const account = accounts.find((a) => a.id === form.accountId) ?? null;
  const over = form.qty > qtyRemaining + 0.001;
  const payError =
    !form.paidNow || form.payAmount <= 0
      ? null
      : form.payAmount > payRemaining
        ? t('exceedsRemaining')
        : account && form.payAmount > account.balance
          ? t('insufficientFunds')
          : null;
  const canSave = form.qty > 0 && !over && (!form.paidNow || (form.payAmount > 0 && !!form.accountId && !payError));
  const remainingText = `${formatPakistaniGrouping(qtyRemaining)}${unit ? ` ${unit}` : ''}`;

  // project_id sent only when it differs from the booking's own project.
  const deliveryProjectId =
    form.receivingProjectId && form.receivingProjectId !== bookingProjectId ? form.receivingProjectId : null;

  const onSave = () => {
    if (!canSave || saving) return;
    void (async () => {
      const ok = await runSave(async () => {
        if (form.paidNow && form.accountId) {
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
      title={t('addDelivery')}
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
            <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex}>
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

      <FloatingLabelInput label={t('note')} value={form.note} onChangeText={(v) => patch({ note: v })} />

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

      <SelectSheet
        visible={projectSheet}
        onClose={() => setProjectSheet(false)}
        options={projectOptions}
        selectedId={form.receivingProjectId ?? undefined}
        title={t('deliverToProject')}
        searchable={false}
        onSelect={(o) => patch({ receivingProjectId: o.id })}
      />
    </AppSheet>
  );
}
