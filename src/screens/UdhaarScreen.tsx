import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AmountInput,
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  EmptyState,
  SelectSheet,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import {
  createUdhaar,
  deleteUdhaarIfEmpty,
  getUdhaarTotals,
  giveUdhaar,
  isInsufficientFunds,
  listAccountsWithBalance,
  listUdhaar,
  type AccountWithBalance,
  type UdhaarDirection,
  type UdhaarTotals,
  type UdhaarWithBalance,
} from '@/db';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Udhaar = person lending. Money we handed to people (receivable) and money
 * we borrowed (payable), each tracked per person with a running balance
 * derived from account transactions.
 */
export function UdhaarScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [items, setItems] = useState<UdhaarWithBalance[]>([]);
  const [totals, setTotals] = useState<UdhaarTotals>({ receivable: 0, payable: 0 });
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);

  // New-udhaar sheet state
  const [newOpen, setNewOpen] = useState(false);
  const [personName, setPersonName] = useState('');
  const [direction, setDirection] = useState<UdhaarDirection>('GIVEN');
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountSheet, setAccountSheet] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [rows, tot, accs] = await Promise.all([
      listUdhaar(),
      getUdhaarTotals(),
      listAccountsWithBalance(),
    ]);
    // OPEN first, CLEARED (muted) after  each group keeps newest-first order.
    setItems([...rows.filter((r) => r.status === 'OPEN'), ...rows.filter((r) => r.status !== 'OPEN')]);
    setTotals(tot);
    setAccounts(accs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  // Default the account to the first one once accounts arrive.
  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  const accountOptions: SelectOption[] = useMemo(
    () =>
      accounts.map((a) => ({
        id: a.id,
        label: a.name,
        subtitle: formatRupees(a.balance),
        icon: (a.type === 'BANK' ? 'bank' : a.type === 'CASH' ? 'rupee' : 'balance') as IconKey,
      })),
    [accounts]
  );

  const openNew = () => {
    setPersonName('');
    setDirection('GIVEN');
    setAmount(0);
    setNewOpen(true);
  };

  const canSave =
    personName.trim().length > 0 &&
    amount > 0 &&
    !!accountId &&
    // Lending money out (GIVEN) can't exceed the paying account's balance.
    (direction !== 'GIVEN' || !selectedAccount || amount <= selectedAccount.balance);

  const onSave = async () => {
    if (!canSave || !accountId) return;
    setSaving(true);
    let created: string | null = null;
    try {
      const u = await createUdhaar({ personName: personName.trim(), direction });
      created = u.id;
      await giveUdhaar({
        udhaarId: u.id,
        amount,
        date: todayISO().slice(0, 10),
        accountId,
      });
      setNewOpen(false);
      await load();
    } catch (e) {
      // Don't leave an empty udhaar behind when the first give is blocked.
      if (created) await deleteUdhaarIfEmpty(created).catch(() => undefined);
      if (isInsufficientFunds(e)) Alert.alert(t('insufficientFunds'));
      else throw e;
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('udhaar')} onBack={() => navigation.goBack()} />

      {items.length === 0 ? (
        <EmptyState icon="investor" title={t('noUdhaar')} message={t('noUdhaarDetail')} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl * 2 }]}
        >
          {/* Totals  money out on loan vs money we owe */}
          <View style={styles.totalsRow}>
            <AppCard style={styles.totalCard}>
              <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
                {t('receivable')}
              </AppText>
              <AppText size="xl" weight="bold" color="gold" tabular numberOfLines={1} adjustsFontSizeToFit>
                {formatRupees(totals.receivable)}
              </AppText>
            </AppCard>
            <AppCard style={styles.totalCard}>
              <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
                {t('payable')}
              </AppText>
              <AppText size="xl" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
                {formatRupees(totals.payable)}
              </AppText>
            </AppCard>
          </View>

          {items.map((u) => {
            const cleared = u.status === 'CLEARED';
            const subtitle =
              t(u.direction === 'GIVEN' ? 'udhaarGiven' : 'udhaarTaken') +
              (cleared ? ' · ' + t('clearedLabel') : '');
            return (
              <AppCard
                key={u.id}
                compact
                style={cleared ? styles.clearedCard : undefined}
                onPress={() => navigation.navigate('UdhaarDetail', { udhaarId: u.id })}
              >
                <View style={styles.row}>
                  <View style={[styles.iconChip, u.direction === 'GIVEN' ? styles.givenChip : styles.takenChip]}>
                    <AppIcon
                      name={u.direction === 'GIVEN' ? 'moneyOut' : 'moneyIn'}
                      size={20}
                      color={u.direction === 'GIVEN' ? 'gold' : 'danger'}
                    />
                  </View>
                  <View style={styles.flex}>
                    <AppText size="md" weight="bold" numberOfLines={1}>
                      {u.person_name}
                    </AppText>
                    <AppText size="xs" color="textSecondary" numberOfLines={1}>
                      {subtitle}
                    </AppText>
                  </View>
                  <AppText size="md" weight="bold" tabular color={cleared ? 'textSecondary' : 'textPrimary'}>
                    {formatRupees(u.balance)}
                  </AppText>
                </View>
              </AppCard>
            );
          })}
        </ScrollView>
      )}

      {/* New udhaar  always reachable */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <AppButton label={t('newUdhaar')} icon="add" onPress={openNew} />
      </View>

      {/* New-udhaar sheet */}
      <Modal visible={newOpen} transparent animationType="fade" onRequestClose={() => setNewOpen(false)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.backdrop} onPress={() => setNewOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            <View style={styles.grabber} />
            <AppText size="lg" weight="bold">
              {t('newUdhaar')}
            </AppText>

            <FloatingLabelInput label={t('personName')} value={personName} onChangeText={setPersonName} />

            {/* Direction  did we lend or borrow? */}
            <View style={styles.dirRow}>
              {(['GIVEN', 'TAKEN'] as UdhaarDirection[]).map((d) => {
                const active = d === direction;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDirection(d)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.dirBtn, active && styles.dirBtnActive]}
                  >
                    <AppText size="sm" weight="bold" color={active ? 'onPrimary' : 'textSecondary'}>
                      {t(d === 'GIVEN' ? 'udhaarGiven' : 'udhaarTaken')}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <AmountInput floating surface={theme.colors.card} value={amount} onChange={setAmount} />

            {/* Account the money moves through */}
            <Pressable onPress={() => setAccountSheet(true)} style={styles.accountChip} accessibilityRole="button">
              <AppIcon name={selectedAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
              <AppText
                size="sm"
                weight="bold"
                numberOfLines={1}
                style={styles.flex}
                color={selectedAccount ? 'textPrimary' : 'textSecondary'}
              >
                {selectedAccount ? `${selectedAccount.name} · ${formatRupees(selectedAccount.balance)}` : t('selectAccount')}
              </AppText>
              <AppIcon name="forward" size={18} color="textSecondary" />
            </Pressable>

            <AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!canSave} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SelectSheet
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        options={accountOptions}
        selectedId={accountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setAccountId(o.id)}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    totalsRow: { flexDirection: 'row', gap: theme.spacing.md },
    totalCard: { flex: 1, gap: theme.spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    iconChip: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    givenChip: { backgroundColor: theme.colors.goldSoft },
    takenChip: { backgroundColor: theme.colors.dangerSoft },
    clearedCard: { opacity: 0.55 },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
    },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.overlay },
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
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    dirRow: { flexDirection: 'row', gap: theme.spacing.sm },
    dirBtn: {
      flex: 1,
      minHeight: theme.touch.minTarget,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.background,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    dirBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    accountChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.lg,
      minHeight: theme.touch.minTarget,
    },
  });
