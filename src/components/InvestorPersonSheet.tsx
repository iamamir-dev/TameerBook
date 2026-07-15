import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AmountInput,
  AppButton,
  AppIcon,
  AppText,
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
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import { captureReceipt } from '@/utils/photo';

interface InvestorPersonSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Pass an investor to edit; omit/null to add a new one. */
  editing?: InvestorRow | null;
  /** Called after the investor is created/updated. */
  onSaved: (investor: InvestorRow) => void;
}

/**
 * The ONE investor-person modal — create or edit an investor. Captures their
 * identity (name / phone / CNIC / photo) AND their money: the total they
 * pledge (Committed) and how much they've handed over now (Given). The given
 * cash lands in a chosen account (that's why the account belongs here, not in
 * the project-include flow). Used by the Investors tab and the project
 * "+ New investor" flow, so adding a person looks identical everywhere.
 */
export function InvestorPersonSheet({
  visible,
  onClose,
  editing,
  onSaved,
}: InvestorPersonSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cnic, setCnic] = useState('');
  const [bankInfo, setBankInfo] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [committed, setCommitted] = useState(0);
  const [given, setGiven] = useState(0);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [accountSheet, setAccountSheet] = useState(false);
  const [bankSheet, setBankSheet] = useState(false);
  const { saving, run: runSave } = useSaveAction();

  const pickPhoto = async () => {
    const uri = await captureReceipt().catch(swallow('investor:photo'));
    if (uri) setPhotoUri(uri);
  };

  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? '');
    setPhone(editing?.phone ?? '');
    setCnic(editing?.cnic ?? '');
    setBankInfo(editing?.bank_info ?? '');
    setPhotoUri(editing?.photo_uri ?? null);
    setCommitted(editing?.committed_amount ?? 0);
    // On edit, don't offer to re-post cash — "given" is fixed to what's recorded.
    setGiven(0);
    setDate(todayISO().slice(0, 10));
    listAccountsWithBalance()
      .then((a) => {
        setAccounts(a);
        setAccountId(a[0]?.id ?? null);
      })
      .catch(swallow('investorPersonSheet:load'));
  }, [visible, editing]);

  const account = accounts.find((a) => a.id === accountId) ?? null;
  const accountOptions: SelectOption[] = accounts.map((a) => ({
    id: a.id,
    label: a.name,
    subtitle: formatRupees(a.balance),
    icon: (a.type === 'BANK' ? 'bank' : a.type === 'CASH' ? 'rupee' : 'balance') as IconKey,
  }));

  // A fresh "given" payment needs an account to land in.
  const needsAccount = !editing && given > 0;
  const canSave = name.trim().length > 0 && (!needsAccount || !!accountId);

  const save = async () => {
    const clean = name.trim();
    if (!clean || saving || (needsAccount && !accountId)) return;
    await runSave(async () => {
      let investor: InvestorRow;
      if (editing) {
        await updateInvestor(editing.id, {
          name: clean,
          phone: phone || null,
          cnic: cnic || null,
          bankInfo: bankInfo.trim() || null,
          photoUri,
          committedAmount: committed,
        });
        investor = {
          ...editing,
          name: clean,
          phone: phone || null,
          cnic: cnic || null,
          bank_info: bankInfo.trim() || null,
          photo_uri: photoUri,
          committed_amount: committed,
        };
      } else {
        investor = await addInvestor({
          name: clean,
          phone: phone || null,
          cnic: cnic || null,
          bankInfo: bankInfo.trim() || null,
          photoUri,
          committedAmount: committed,
        });
        // The received cash enters the business → recorded as an investor
        // payment (IN to the account, tracked against their pledge).
        if (given > 0 && accountId) {
          await addInvestorPayment({
            investorId: investor.id,
            amount: given,
            date,
            accountId,
          });
        }
      }
      onSaved(investor);
      onClose();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <AppText size="lg" weight="bold">
              {editing ? t('editInvestor') : t('addInvestor')}
            </AppText>

            {/* Tap the photo itself to add/replace it — no separate button. */}
            <Pressable
              onPress={pickPhoto}
              accessibilityRole="button"
              accessibilityLabel={t('photo')}
              style={styles.photoPicker}
            >
              <Avatar uri={photoUri} name={name} styles={styles} />
              <View style={styles.cameraBadge}>
                <AppIcon name="camera" size={16} color="onAccent" />
              </View>
            </Pressable>

            <FloatingLabelInput label={t('personName')} value={name} onChangeText={setName} />
            <FloatingLabelInput label={t('phone')} value={phone} onChangeText={setPhone} mask="phone" />
            <FloatingLabelInput label={t('cnic')} value={cnic} onChangeText={setCnic} mask="cnic" />

            {/* Bank = pick from the accounts already in the app (no typing). */}
            <Pressable onPress={() => setBankSheet(true)} style={styles.accountChip} accessibilityRole="button">
              <AppIcon name="bank" size={18} color="primary" />
              <AppText
                size="sm"
                weight="semibold"
                numberOfLines={1}
                style={styles.flex}
                color={bankInfo ? 'textPrimary' : 'textSecondary'}
              >
                {bankInfo || t('bankDetails')}
              </AppText>
              <AppIcon name="forward" size={18} color="textSecondary" />
            </Pressable>

            {/* Money: total pledged + what's handed over now (into an account). */}
            <AmountInput label={t('committedAmount')} value={committed} onChange={setCommitted} floating surface={theme.colors.card} />
            {!editing ? (
              <>
                <AmountInput
                  label={t('receivedNow')}
                  value={given}
                  onChange={setGiven}
                  floating
                  surface={theme.colors.card}
                  error={given > 0 && committed > 0 && given > committed ? t('exceedsRemaining') : null}
                />
                {given > 0 ? (
                  <>
                    <Pressable onPress={() => setAccountSheet(true)} style={styles.accountChip} accessibilityRole="button">
                      <AppIcon name={account?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
                      <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
                        {account ? `${account.name} · ${formatRupees(account.balance)}` : t('selectAccount')}
                      </AppText>
                      <AppIcon name="forward" size={18} color="textSecondary" />
                    </Pressable>
                    <DateField value={date} onChange={setDate} />
                  </>
                ) : null}
              </>
            ) : null}
          </ScrollView>

          {/* Pinned action  always in reach below the scrolling form */}
          <View style={styles.footer}>
            <AppButton label={t('save')} icon="check" onPress={save} loading={saving} disabled={!canSave} />
          </View>
        </View>
      </KeyboardAvoidingView>

      <SelectSheet
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        options={accountOptions}
        selectedId={accountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setAccountId(o.id)}
      />

      <SelectSheet
        visible={bankSheet}
        onClose={() => setBankSheet(false)}
        options={accountOptions}
        title={t('bankDetails')}
        searchable={false}
        onSelect={(o) => {
          const acc = accounts.find((a) => a.id === o.id);
          if (acc) setBankInfo(acc.name);
        }}
      />
    </Modal>
  );
}

function Avatar({
  uri,
  name,
  styles,
}: {
  uri: string | null;
  name: string;
  styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element {
  if (uri) return <Image source={{ uri }} style={styles.avatar} />;
  return (
    <View style={styles.avatarFallback}>
      <AppText size="lg" weight="bold" color="onPrimary">
        {name.trim().charAt(0).toUpperCase() || '?'}
      </AppText>
    </View>
  );
}

const AV = 48;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.overlay },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '90%',
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.sm,
      ...theme.shadows.raised,
    },
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    scroll: { flexShrink: 1 },
    body: { gap: theme.spacing.md, paddingTop: theme.spacing.md },
    footer: {
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    photoRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    photoPicker: { alignSelf: 'flex-start' },
    cameraBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.card,
    },
    avatar: { width: AV, height: AV, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    avatarFallback: {
      width: AV,
      height: AV,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      minHeight: theme.touch.minTarget,
    },
  });
