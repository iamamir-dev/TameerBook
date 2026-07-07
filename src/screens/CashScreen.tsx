import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AccountCard,
  AmountInput,
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  LedgerTable,
  type IconKey,
  type LedgerRow,
} from '@/components/ui';
import {
  addAccount,
  getTotalBalance,
  getUdhaarTotals,
  isDuplicateAccount,
  listAccountsWithBalance,
  listCategories,
  listRecentTransactions,
  type AccountType,
  type AccountWithBalance,
  type CategoryRow,
  type TransactionRow,
  type UdhaarTotals,
} from '@/db';
import { ACCOUNT_TYPES } from '@/db/schema';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';
import { softToneColor, type ColorKey } from '@/utils/tones';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TYPE_LABEL: Record<AccountType, TranslationKey> = {
  BANK: 'accountBank',
  CASH: 'accountCash',
  WALLET: 'accountWallet',
};

/**
 * The Cash hub (reached from Home)  every kind of money movement handled in
 * one place: total balance + udhaar position, quick actions (income /
 * expense / transfer / udhaar), every account with its live balance (add
 * more inline), and the full recent cash flow as a notebook-style ledger.
 */
export function CashScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [udhaar, setUdhaar] = useState<UdhaarTotals>({ receivable: 0, payable: 0 });
  const [recent, setRecent] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  // Add-account sheet.
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AccountType>('BANK');
  const [newOpening, setNewOpening] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [tot, accs, ud, txns, cats] = await Promise.all([
      getTotalBalance(),
      listAccountsWithBalance(),
      getUdhaarTotals(),
      listRecentTransactions(25),
      listCategories(),
    ]);
    setTotal(tot);
    setAccounts(accs);
    setUdhaar(ud);
    setRecent(txns);
    setCategories(cats);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  const catName = (id: string | null): string => {
    if (!id) return '';
    const c = categories.find((x) => x.id === id);
    return c ? (language === 'ur' ? c.name_ur : c.name_en) : '';
  };

  const ledgerRows: LedgerRow[] = recent.map((txn) => ({
    id: txn.id,
    title:
      txn.description ||
      catName(txn.category_id) ||
      txn.counterparty_name ||
      t(txn.direction === 'IN' ? 'aamdani' : 'kharcha'),
    date: txn.date,
    amount: txn.amount,
    direction: txn.direction === 'IN' ? 'in' : 'out',
    typeLabel: catName(txn.category_id) || undefined,
  }));

  const onAddAccount = async () => {
    const name = newName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      await addAccount({ name, type: newType, openingBalance: newOpening });
      setAddOpen(false);
      setNewName('');
      setNewOpening(0);
      setNewType('BANK');
      await load();
    } catch (e) {
      if (isDuplicateAccount(e)) Alert.alert(t('duplicateAccount'));
      else throw e;
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('cashFlowTitle')} onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + theme.spacing.xxxl },
        ]}
      >
        {/* Total balance hero + udhaar position */}
        <View style={styles.hero}>
          <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
            {t('totalBalance')}
          </AppText>
          <AppText size="display" weight="bold" color="primary" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(total)}
          </AppText>
          {udhaar.receivable > 0 || udhaar.payable > 0 ? (
            <View style={styles.udhaarRow}>
              {udhaar.receivable > 0 ? (
                <AppText size="sm" weight="semibold" color="textSecondary">
                  {t('receivable')}: {formatRupees(udhaar.receivable)}
                </AppText>
              ) : null}
              {udhaar.payable > 0 ? (
                <AppText size="sm" weight="semibold" color="danger">
                  {t('payable')}: {formatRupees(udhaar.payable)}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Quick actions  every kind of cash movement */}
        <View style={styles.quickRow}>
          <QuickAction icon="aamdani" tone="success" label={t('aamdani')} onPress={() => navigation.navigate('Entry', { direction: 'IN' })} />
          <QuickAction icon="kharcha" tone="danger" label={t('kharcha')} onPress={() => navigation.navigate('Entry', { direction: 'OUT' })} />
          <QuickAction icon="netFlow" tone="accent" label={t('transferTitleV2')} onPress={() => navigation.navigate('Transfer')} />
          <QuickAction icon="investor" tone="gold" label={t('udhaar')} onPress={() => navigation.navigate('Udhaar')} />
        </View>

        {/* Accounts */}
        <View style={styles.sectionHeader}>
          <AppText size="lg" weight="bold">
            {t('accountsTitle')}
          </AppText>
          <Pressable
            onPress={() => setAddOpen(true)}
            hitSlop={theme.touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('addAccount')}
          >
            <AppText size="sm" weight="semibold" color="accent">
              {t('addAccount')}
            </AppText>
          </Pressable>
        </View>
        <View style={styles.accountList}>
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              name={a.name}
              type={a.type}
              balance={a.balance}
              typeLabel={t(TYPE_LABEL[a.type])}
              onPress={() => navigation.navigate('AccountDetail', { accountId: a.id })}
            />
          ))}
        </View>

        {/* Full recent activity */}
        <AppText size="lg" weight="bold" style={styles.activityTitle}>
          {t('recentActivity')}
        </AppText>
        <AppCard compact>
          <LedgerTable rows={ledgerRows} emptyText={t('noAccountTxns')} />
        </AppCard>
      </ScrollView>

      {/* Add-account sheet */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={() => setAddOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold">
            {t('addAccount')}
          </AppText>
          <FloatingLabelInput label={t('accountName')} value={newName} onChangeText={setNewName} />
          <View style={styles.typeRow}>
            {ACCOUNT_TYPES.map((type) => {
              const active = type === newType;
              return (
                <Pressable
                  key={type}
                  onPress={() => setNewType(type)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.typeBtn, active && styles.typeBtnActive]}
                >
                  <AppText size="sm" weight="bold" color={active ? 'onPrimary' : 'textSecondary'}>
                    {t(TYPE_LABEL[type])}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <AmountInput floating surface={theme.colors.card} label={t('openingBalance')} value={newOpening} onChange={setNewOpening} />
          <AppButton label={t('save')} icon="check" onPress={onAddAccount} loading={saving} disabled={!newName.trim()} />
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/** A soft-tinted quick-action tile (income / expense / transfer / udhaar). */
function QuickAction({
  icon,
  tone,
  label,
  onPress,
}: {
  icon: IconKey;
  tone: ColorKey;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}
    >
      <View style={[styles.quickIcon, { backgroundColor: softToneColor(theme, tone) }]}>
        <AppIcon name={icon} size={20} color={tone} />
      </View>
      <AppText size="xs" weight="semibold" center numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
    hero: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    udhaarRow: {
      flexDirection: 'row',
      gap: theme.spacing.lg,
      marginTop: theme.spacing.xs,
    },
    quickRow: { flexDirection: 'row', gap: theme.spacing.sm },
    quickTile: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      paddingVertical: theme.spacing.md,
      ...theme.shadows.card,
    },
    quickIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    accountList: { gap: theme.spacing.md },
    activityTitle: { marginTop: theme.spacing.sm },
    /* add-account sheet */
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
    typeRow: { flexDirection: 'row', gap: theme.spacing.sm },
    typeBtn: {
      flex: 1,
      minHeight: theme.touch.minTarget,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.card,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    typeBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  });
