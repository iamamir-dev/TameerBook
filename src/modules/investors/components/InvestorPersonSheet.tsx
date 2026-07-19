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
  Avatar,
  DateField,
  SelectSheet,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import {
  addInvestor,
  addInvestorPayment,
  listAccountsWithBalance,
  updateInvestor,
  type AccountWithBalance,
  type InvestorRow,
} from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import { captureReceipt } from '@/utils/photo';

import { makeStyles } from '../styled/InvestorPersonSheet.styles';

interface InvestorPersonSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Pass an investor to edit; omit/null to add a new one. */
  editing?: InvestorRow | null;
  /** Called after the investor is created/updated. */
  onSaved: (investor: InvestorRow) => void;
}

interface Form {
  name: string;
  phone: string;
  cnic: string;
  bankInfo: string;
  photoUri: string | null;
  committed: number;
  given: number;
  accountId: string | null;
  date: string;
}

const EMPTY: Form = {
  name: '',
  phone: '',
  cnic: '',
  bankInfo: '',
  photoUri: null,
  committed: 0,
  given: 0,
  accountId: null,
  date: todayISO().slice(0, 10),
};

/**
 * The ONE investor-person sheet — create or edit an investor (identity + money).
 * Built on the shared `AppSheet`, with `Avatar` + `AccountPickerRow` reused; the
 * one place the whole app adds/edits an investor person.
 */
export function InvestorPersonSheet({
  visible,
  onClose,
  editing,
  onSaved,
}: InvestorPersonSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run: runSave } = useSaveAction();

  const [form, setForm] = useState<Form>(EMPTY);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [bankSheet, setBankSheet] = useState(false);
  const patch = (p: Partial<Form>) => setForm((s) => ({ ...s, ...p }));

  useEffect(() => {
    if (!visible) return;
    setForm({
      ...EMPTY,
      name: editing?.name ?? '',
      phone: editing?.phone ?? '',
      cnic: editing?.cnic ?? '',
      bankInfo: editing?.bank_info ?? '',
      photoUri: editing?.photo_uri ?? null,
      committed: editing?.committed_amount ?? 0,
      date: todayISO().slice(0, 10),
    });
    listAccountsWithBalance()
      .then((a) => {
        setAccounts(a);
        setForm((s) => ({ ...s, accountId: a[0]?.id ?? null }));
      })
      .catch(swallow('investorPersonSheet:load'));
  }, [visible, editing]);

  const pickPhoto = async () => {
    const uri = await captureReceipt().catch(swallow('investor:photo'));
    if (uri) patch({ photoUri: uri });
  };

  const accountOptions: SelectOption[] = accounts.map((a) => ({
    id: a.id,
    label: a.name,
    subtitle: formatRupees(a.balance),
    icon: (a.type === 'BANK' ? 'bank' : a.type === 'CASH' ? 'rupee' : 'balance') as IconKey,
  }));

  const needsAccount = !editing && form.given > 0;
  const canSave = form.name.trim().length > 0 && (!needsAccount || !!form.accountId);

  const save = async () => {
    const clean = form.name.trim();
    if (!clean || saving || (needsAccount && !form.accountId)) return;
    await runSave(async () => {
      let investor: InvestorRow;
      if (editing) {
        await updateInvestor(editing.id, {
          name: clean,
          phone: form.phone || null,
          cnic: form.cnic || null,
          bankInfo: form.bankInfo.trim() || null,
          photoUri: form.photoUri,
          committedAmount: form.committed,
        });
        investor = {
          ...editing,
          name: clean,
          phone: form.phone || null,
          cnic: form.cnic || null,
          bank_info: form.bankInfo.trim() || null,
          photo_uri: form.photoUri,
          committed_amount: form.committed,
        };
      } else {
        investor = await addInvestor({
          name: clean,
          phone: form.phone || null,
          cnic: form.cnic || null,
          bankInfo: form.bankInfo.trim() || null,
          photoUri: form.photoUri,
          committedAmount: form.committed,
        });
        if (form.given > 0 && form.accountId) {
          await addInvestorPayment({
            investorId: investor.id,
            amount: form.given,
            date: form.date,
            accountId: form.accountId,
          });
        }
      }
      onSaved(investor);
      onClose();
    });
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={editing ? t('editInvestor') : t('addInvestor')}
      subtitle={t('investorDetailsHint')}
      footer={<AppButton label={t('save')} icon="check" onPress={save} loading={saving} disabled={!canSave} />}
    >
      {/* Tap the photo itself to add/replace it — no separate button. */}
      <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel={t('photo')} style={styles.photoPicker}>
        <Avatar uri={form.photoUri} name={form.name} />
        <View style={styles.cameraBadge}>
          <AppIcon name="camera" size={16} color="onAccent" />
        </View>
      </Pressable>

      <FloatingLabelInput label={t('personName')} value={form.name} onChangeText={(v) => patch({ name: v })} />
      <FloatingLabelInput label={t('phone')} value={form.phone} onChangeText={(v) => patch({ phone: v })} mask="phone" />
      <FloatingLabelInput label={t('cnic')} value={form.cnic} onChangeText={(v) => patch({ cnic: v })} mask="cnic" />

      {/* Money section — separated from identity for a clearer read. */}
      <View style={styles.divider} />
      <AppText size="overline" weight="bold" color="textSecondary" uppercase style={styles.sectionLabel}>
        {t('moneySection')}
      </AppText>

      {/* Bank = pick from the accounts already in the app (no typing). */}
      <Pressable onPress={() => setBankSheet(true)} style={styles.bankChip} accessibilityRole="button">
        <AppIcon name="bank" size={18} color="primary" />
        <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={form.bankInfo ? 'textPrimary' : 'textSecondary'}>
          {form.bankInfo || t('bankDetails')}
        </AppText>
        <AppIcon name="forward" size={18} color="textSecondary" />
      </Pressable>

      {/* Money: what's handed over now (into an account). */}
      {!editing ? (
        <>
          <AmountInput
            label={t('receivedNow')}
            value={form.given}
            onChange={(v) => patch({ given: v })}
            floating
            surface={theme.colors.card}
          />
          {form.given > 0 ? (
            <>
              <AccountPickerRow accounts={accounts} selectedId={form.accountId} onSelect={(id) => patch({ accountId: id })} />
              <DateField value={form.date} onChange={(d) => patch({ date: d })} />
            </>
          ) : null}
        </>
      ) : null}

      <SelectSheet
        visible={bankSheet}
        onClose={() => setBankSheet(false)}
        options={accountOptions}
        title={t('bankDetails')}
        searchable={false}
        onSelect={(o) => {
          const acc = accounts.find((a) => a.id === o.id);
          if (acc) patch({ bankInfo: acc.name });
        }}
      />
    </AppSheet>
  );
}
