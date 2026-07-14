import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AmountInput,
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  DateField,
  LedgerTable,
  SelectSheet,
  type IconKey,
  type LedgerRow,
  type SelectOption,
} from '@/components/ui';
import {
  giveUdhaar,
  listAccountsWithBalance,
  listUdhaar,
  listUdhaarTransactions,
  returnUdhaar,
  type AccountWithBalance,
  type TransactionRow,
  type UdhaarWithBalance,
} from '@/db';
import { useFocusReload, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'UdhaarDetail'>;

type MoveKind = 'give' | 'return';

/**
 * One person's udhaar ledger: the outstanding balance up top, give/return
 * actions, and every linked account transaction beneath.
 */
export function UdhaarDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { udhaarId } = useRoute<DetailRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [udhaar, setUdhaar] = useState<UdhaarWithBalance | null>(null);
  const [txns, setTxns] = useState<TransactionRow[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);

  // Give/return sheet state
  const [move, setMove] = useState<MoveKind | null>(null);
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [accountSheet, setAccountSheet] = useState(false);

  const load = useCallback(async () => {
    const [rows, list, accs] = await Promise.all([
      listUdhaar(),
      listUdhaarTransactions(udhaarId),
      listAccountsWithBalance(),
    ]);
    setUdhaar(rows.find((r) => r.id === udhaarId) ?? null);
    setTxns(list);
    setAccounts(accs);
    setAccountId((prev) => prev ?? accs[0]?.id ?? null);
  }, [udhaarId]);

  const { reload } = useFocusReload(load);
  const { saving, run: runSave } = useSaveAction();

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

  // A txn INCREASES the balance when it flows the "give" way for this udhaar:
  // GIVEN → OUT of our account; TAKEN → IN to our account.
  const giveTxnDirection = udhaar?.direction === 'GIVEN' ? 'OUT' : 'IN';

  const ledgerRows: LedgerRow[] = txns.map((txn) => ({
    id: txn.id,
    title: txn.description || udhaar?.person_name || '',
    date: txn.date,
    amount: txn.amount,
    direction: txn.direction === 'IN' ? 'in' : 'out',
    typeLabel: t(txn.direction === giveTxnDirection ? 'givenLabel' : 'returnedLabel'),
  }));

  const openMove = (kind: MoveKind) => {
    setAmount(kind === 'return' && udhaar ? Math.max(0, udhaar.balance) : 0);
    setDate(todayISO().slice(0, 10));
    setMove(kind);
  };

  const onSave = async () => {
    if (!move || amount <= 0 || !accountId) return;
    const ok = await runSave(async () => {
      const input = { udhaarId, amount, date, accountId };
      if (move === 'give') await giveUdhaar(input);
      else await returnUdhaar(input);
    });
    if (!ok) return;
    setMove(null);
    await reload();
  };

  const balance = udhaar?.balance ?? 0;

  // Live amount validation (returns capped at outstanding; money-out capped at
  // the account balance).
  const moneyOut =
    !!udhaar &&
    ((move === 'give' && udhaar.direction === 'GIVEN') ||
      (move === 'return' && udhaar.direction === 'TAKEN'));
  const amountError =
    amount <= 0
      ? null
      : move === 'return' && amount > balance
        ? t('exceedsRemaining')
        : moneyOut && !!selectedAccount && amount > selectedAccount.balance
          ? t('insufficientFunds')
          : null;

  return (
    <View style={styles.screen}>
      <AppHeader title={udhaar?.person_name ?? t('udhaar')} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {/* Outstanding balance hero */}
        <AppCard style={styles.hero}>
          <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
            {t(udhaar?.direction === 'GIVEN' ? 'receivable' : 'payable')}
          </AppText>
          <AppText
            size="display"
            weight="bold"
            color={udhaar?.direction === 'GIVEN' ? 'gold' : 'primary'}
            tabular
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatRupees(balance)}
          </AppText>
          <AppText size="sm" color="textSecondary">
            {`${t('givenLabel')} ${formatRupees(udhaar?.given ?? 0)} · ${t('returnedLabel')} ${formatRupees(udhaar?.returned ?? 0)}`}
          </AppText>
        </AppCard>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <View style={styles.flex}>
            <AppButton label={t('giveUdhaar')} icon="moneyOut" onPress={() => openMove('give')} />
          </View>
          <View style={styles.flex}>
            <AppButton
              label={t('returnUdhaar')}
              icon="moneyIn"
              variant="secondary"
              disabled={balance <= 0}
              onPress={() => openMove('return')}
            />
          </View>
        </View>

        {/* Ledger */}
        <AppText size="lg" weight="bold" style={styles.sectionTitle}>
          {t('transactions')}
        </AppText>
        <AppCard compact>
          <LedgerTable rows={ledgerRows} emptyText={t('noUdhaar')} />
        </AppCard>
      </ScrollView>

      {/* Give / return sheet */}
      <Modal visible={move !== null} transparent animationType="fade" onRequestClose={() => setMove(null)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.backdrop} onPress={() => setMove(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            <View style={styles.grabber} />
            <AppText size="lg" weight="bold">
              {t(move === 'return' ? 'returnUdhaar' : 'giveUdhaar')}
            </AppText>
            {udhaar ? (
              <AppText size="sm" color="textSecondary">
                {udhaar.person_name} · {formatRupees(balance)}
              </AppText>
            ) : null}

            <AmountInput floating surface={theme.colors.card} value={amount} onChange={setAmount} error={amountError} />

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

            <DateField value={date} onChange={setDate} />

            <AppButton
              label={t('save')}
              icon="check"
              onPress={onSave}
              loading={saving}
              disabled={
                amount <= 0 ||
                !accountId ||
                // Returning more than is outstanding is never allowed.
                (move === 'return' && !!udhaar && amount > udhaar.balance) ||
                // Money leaves the account on give(GIVEN) and return(TAKEN).
                (!!selectedAccount &&
                  !!udhaar &&
                  ((move === 'give' && udhaar.direction === 'GIVEN') ||
                    (move === 'return' && udhaar.direction === 'TAKEN')) &&
                  amount > selectedAccount.balance)
              }
            />
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
    hero: { gap: theme.spacing.xs },
    actionsRow: { flexDirection: 'row', gap: theme.spacing.md },
    sectionTitle: { marginTop: theme.spacing.sm },
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
