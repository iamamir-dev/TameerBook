import {
  type RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppButton,
  AppCard,
  AppHeader,
  AppText,
  LedgerTable,
  type LedgerRow,
} from '@/components/ui';
import {
  getAccount,
  getAccountBalance,
  listAccountTransactions,
  listCategories,
  type AccountRow,
  type CategoryRow,
  type TransactionRow,
} from '@/db';
import { useFocusReload } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'AccountDetail'>;

/**
 * One account's ledger: the live balance up top, a transfer shortcut, and
 * every live transaction posted against the account beneath it.
 */
export function AccountDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { accountId } = useRoute<DetailRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [account, setAccount] = useState<AccountRow | null>(null);
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  const loadData = useCallback(async () => {
    const [acc, bal, rows, cats] = await Promise.all([
      getAccount(accountId),
      getAccountBalance(accountId),
      listAccountTransactions(accountId),
      listCategories(),
    ]);
    setAccount(acc);
    setBalance(bal);
    setTxns(rows);
    setCategories(cats);
  }, [accountId]);

  useFocusReload(loadData);

  const catName = (id: string | null): string => {
    if (!id) return '';
    const c = categories.find((x) => x.id === id);
    return c ? (language === 'ur' ? c.name_ur : c.name_en) : '';
  };

  const typeLabel = account
    ? t(account.type === 'BANK' ? 'accountBank' : account.type === 'CASH' ? 'accountCash' : 'accountWallet')
    : '';

  const ledgerRows: LedgerRow[] = txns.map((txn) => ({
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

  return (
    <View style={styles.screen}>
      <AppHeader title={account?.name ?? ''} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {/* Balance hero */}
        <AppCard style={styles.hero}>
          <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
            {t('totalBalance')}
          </AppText>
          <AppText size="display" weight="bold" color="primary" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(balance)}
          </AppText>
          <AppText size="sm" color="textSecondary">
            {typeLabel}
          </AppText>
        </AppCard>

        {/* Actions */}
        <AppButton
          label={t('transferTitleV2')}
          icon="netFlow"
          variant="secondary"
          onPress={() => navigation.navigate('Transfer', { fromAccountId: accountId })}
        />

        {/* Ledger */}
        <View style={styles.sectionHeader}>
          <AppText size="lg" weight="bold">
            {t('transactions')}
          </AppText>
        </View>
        <AppCard compact>
          <LedgerTable rows={ledgerRows} emptyText={t('noAccountTxns')} />
        </AppCard>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    hero: {
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
  });
