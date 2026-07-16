import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import {
  AccountCard,
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  HubShortcuts,
  LedgerTable,
  type LedgerRow,
} from '@/components/ui';
import {
  getCompanyAssets,
  getProjectCapitalSummary,
  getTotalBalance,
  getUdhaarTotals,
  listAccountsWithBalance,
  listCategories,
  listInvestorsWithCapacity,
  listProjectSummaries,
  listRecentTransactions,
  type AccountType,
  type AccountWithBalance,
  type CategoryRow,
  type CompanyAssets,
  type InvestorCapacity,
  type TransactionRow,
  type UdhaarTotals,
} from '@/db';
import { useFocusReload } from '@/hooks';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type CashRoute = RouteProp<RootStackParamList, 'Cash'>;

const TYPE_LABEL: Record<AccountType, TranslationKey> = {
  BANK: 'accountBank',
  CASH: 'accountCash',
  WALLET: 'accountWallet',
};

/** How many project/investor rows the compact sections preview. */
const PREVIEW_ROWS = 4;

interface ProjectStake {
  projectId: string;
  name: string;
  invested: number;
}

/**
 * The money hub, in two scopes:
 * - 'cash' (the Cash tile): only cash-related data — balance, udhaar,
 *   accounts, recent activity.
 * - 'assets' (the Home TOTAL ASSETS hero): the full picture — the asset
 *   breakdown (cash / plots / construction) plus how much is invested in each
 *   project and by each investor.
 * Accounts are MANAGED from Settings; this page only shows them. The green
 * bottom-right FAB opens the same Quick Entry chooser as the Home "+".
 */
export function CashScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const scope = useRoute<CashRoute>().params?.scope ?? 'cash';
  const assetsMode = scope === 'assets';
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [total, setTotal] = useState(0);
  const [txnDetail, setTxnDetail] = useState<TransactionRow | null>(null);
  const [assets, setAssets] = useState<CompanyAssets | null>(null);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [udhaar, setUdhaar] = useState<UdhaarTotals>({ receivable: 0, payable: 0 });
  const [recent, setRecent] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [projectStakes, setProjectStakes] = useState<ProjectStake[]>([]);
  const [investors, setInvestors] = useState<InvestorCapacity[]>([]);

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

    // The wider asset picture is only fetched when this page shows it.
    if (assetsMode) {
      const [companyAssets, projects, caps] = await Promise.all([
        getCompanyAssets(),
        listProjectSummaries(),
        listInvestorsWithCapacity(),
      ]);
      const stakes = await Promise.all(
        projects.map(async (p) => ({
          projectId: p.project.id,
          name: p.project.name,
          invested: (await getProjectCapitalSummary(p.project.id)).totalCapital,
        }))
      );
      setAssets(companyAssets);
      setProjectStakes(stakes.filter((s) => s.invested > 0));
      setInvestors(caps.filter((i) => i.staked > 0));
    }
  }, [assetsMode]);

  useFocusReload(load);

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
    onPress: () => setTxnDetail(txn),
  }));

  return (
    <View style={styles.screen}>
      <AppHeader
        title={assetsMode ? t('totalAssets') : t('cashFlowTitle')}
        onBack={() => navigation.goBack()}
      />

      <HubShortcuts current="Cash" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + theme.spacing.xxxl * 2 },
        ]}
      >
        {/* Hero. Cash scope: the liquid balance. Assets scope: the full asset
            total with its breakdown as colored-text columns. */}
        <View style={styles.hero}>
          <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
            {assetsMode ? t('totalAssets') : t('totalBalance')}
          </AppText>
          <AppText size="display" weight="bold" color="primary" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(assetsMode ? assets?.total ?? total : total)}
          </AppText>
          {assetsMode ? (
            <>
              <View style={styles.heroRule} />
              <View style={styles.heroColumns}>
                <View style={styles.heroCol}>
                  <AppText size="sm" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
                    {formatRupees(assets?.cash ?? total)}
                  </AppText>
                  <AppText size="xs" weight="semibold" color="textSecondary" numberOfLines={1}>
                    {t('tabCash')}
                  </AppText>
                </View>
                <View style={styles.heroColDivider} />
                <View style={styles.heroCol}>
                  <AppText size="sm" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
                    {formatRupees(assets?.plotsValue ?? 0)}
                  </AppText>
                  <AppText size="xs" weight="semibold" color="gold" numberOfLines={1}>
                    {t('assetPlots')}
                  </AppText>
                </View>
                <View style={styles.heroColDivider} />
                <View style={styles.heroCol}>
                  <AppText size="sm" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
                    {formatRupees(assets?.constructionValue ?? 0)}
                  </AppText>
                  <AppText size="xs" weight="semibold" color="accent" numberOfLines={1}>
                    {t('assetConstruction')}
                  </AppText>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* Udhaar: the lending position, presented like the accounts. */}
        <SectionHeader title={t('udhaar')} action={t('seeAll')} onAction={() => navigation.navigate('Udhaar')} />
        <AppCard compact onPress={() => navigation.navigate('Udhaar')}>
          <View style={styles.splitRow}>
            <View style={styles.splitCol}>
              <AppText size="xs" weight="semibold" color="textSecondary">
                {t('receivable')}
              </AppText>
              <AppText size="md" weight="bold" color="success" tabular numberOfLines={1} adjustsFontSizeToFit>
                {formatRupees(udhaar.receivable)}
              </AppText>
            </View>
            <View style={styles.splitDivider} />
            <View style={styles.splitCol}>
              <AppText size="xs" weight="semibold" color="textSecondary">
                {t('payable')}
              </AppText>
              <AppText size="md" weight="bold" color={udhaar.payable > 0 ? 'danger' : 'textPrimary'} tabular numberOfLines={1} adjustsFontSizeToFit>
                {formatRupees(udhaar.payable)}
              </AppText>
            </View>
          </View>
        </AppCard>

        {/* Accounts (view only; add/manage lives in Settings → Accounts). */}
        <SectionHeader title={t('accountsTitle')} />
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

        {/* Assets scope only: where the money is invested. */}
        {assetsMode && projectStakes.length > 0 ? (
          <>
            <SectionHeader title={t('byProject')} action={t('seeAll')} onAction={() => navigation.navigate('Allocation')} />
            <AppCard compact>
              {projectStakes.slice(0, PREVIEW_ROWS).map((s, i) => (
                <Pressable
                  key={s.projectId}
                  onPress={() => navigation.navigate('ProjectDetail', { projectId: s.projectId })}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.listRow, i > 0 && styles.ruled, pressed && styles.pressed]}
                >
                  <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex}>
                    {s.name}
                  </AppText>
                  <AppText size="sm" weight="bold" color="gold" tabular>
                    {formatRupees(s.invested)}
                  </AppText>
                </Pressable>
              ))}
            </AppCard>
          </>
        ) : null}

        {assetsMode && investors.length > 0 ? (
          <>
            <SectionHeader title={t('byInvestor')} action={t('seeAll')} onAction={() => navigation.navigate('Allocation')} />
            <AppCard compact>
              {investors.slice(0, PREVIEW_ROWS).map((inv, i) => (
                <Pressable
                  key={inv.id}
                  onPress={() => navigation.navigate('InvestorProfile', { investorId: inv.id })}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.listRow, i > 0 && styles.ruled, pressed && styles.pressed]}
                >
                  <View style={styles.flex}>
                    <AppText size="sm" weight="semibold" numberOfLines={1}>
                      {inv.name}
                    </AppText>
                    <AppText size="xs" color="textSecondary" numberOfLines={1}>
                      {`${t('investedLabel')} ${formatRupees(inv.staked)}`}
                    </AppText>
                  </View>
                  <AppText size="sm" weight="bold" color="gold" tabular>
                    {formatRupees(inv.staked)}
                  </AppText>
                </Pressable>
              ))}
            </AppCard>
          </>
        ) : null}

        {/* Full recent activity */}
        <SectionHeader title={t('recentActivity')} action={t('seeAll')} onAction={() => navigation.navigate('Transactions')} />
        <AppCard compact>
          <LedgerTable rows={ledgerRows} emptyText={t('noAccountTxns')} />
        </AppCard>
      </ScrollView>

      {/* Green quick-entry FAB — the same chooser as the Home "+". */}
      <Pressable
        onPress={() => navigation.navigate('QuickEntry')}
        accessibilityRole="button"
        accessibilityLabel={t('quickEntry')}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + theme.spacing.xl },
          pressed && styles.fabPressed,
        ]}
      >
        <AppIcon name="add" size={26} color="onAccent" strokeWidth={2.4} />
      </Pressable>
      <TransactionDetailSheet txn={txnDetail} onClose={() => setTxnDetail(null)} />
    </View>
  );
}

/** Section title with an optional trailing accent action (e.g. "See all"). */
function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.sectionHeader}>
      <AppText size="lg" weight="bold">
        {title}
      </AppText>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={theme.touch.hitSlop} accessibilityRole="button">
          <AppText size="sm" weight="semibold" color="accent">
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const FAB_SIZE = 56;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
    hero: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    heroRule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginTop: theme.spacing.sm,
    },
    heroColumns: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginTop: theme.spacing.sm,
    },
    heroCol: { flex: 1, alignItems: 'center', gap: 2 },
    heroColDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    splitRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingVertical: theme.spacing.xs,
    },
    splitCol: { flex: 1, alignItems: 'center', gap: 2 },
    splitDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
    accountList: { gap: theme.spacing.md },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      minHeight: 40,
    },
    ruled: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    pressed: { opacity: 0.7 },
    fab: {
      position: 'absolute',
      right: theme.spacing.lg,
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.fab,
    },
    fabPressed: { opacity: 0.9 },
  });
