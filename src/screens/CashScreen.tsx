import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import {
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppSheet,
  AppText,
  DateField,
  LedgerTable,
  SearchBar,
  SelectSheet,
  SkeletonBlock,
  type IconKey,
  type LedgerRow,
  type SelectOption,
} from '@/components/ui';
import {
  getCompanyAssets,
  getTotalBalance,
  getUdhaarTotals,
  listAccountsWithBalance,
  listCategories,
  listAllCompanyTransactions,
  listProjects,
  resolveTxnModuleTarget,
  type AccountType,
  type AccountWithBalance,
  type CategoryRow,
  type CompanyAssets,
  type ProjectRow,
  type TransactionRow,
  type TxnModuleTarget,
  type UdhaarTotals,
} from '@/db';
import { useFocusReload } from '@/hooks';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { groupTxnActivity } from '@/utils/bookingBatch';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';
import { inRange, periodRange, type DateRange, type PeriodKind } from '@/utils/period';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type MoneyRoute = RouteProp<RootStackParamList, 'Cash' | 'Transactions'>;

const TYPE_LABEL: Record<AccountType, TranslationKey> = {
  BANK: 'accountBank',
  CASH: 'accountCash',
  WALLET: 'accountWallet',
};

const ACCOUNT_ICON: Record<AccountType, IconKey> = {
  BANK: 'bank',
  CASH: 'rupee',
  WALLET: 'balance',
};

/** Day-groups mounted per page of the ledger (more stream in on scroll). */
const GROUP_PAGE = 8;

const PERIOD_LABEL: Record<Exclude<PeriodKind, 'custom'>, TranslationKey> = {
  today: 'today',
  week: 'thisWeek',
  month: 'thisMonth',
  quarter: 'thisQuarter',
  year: 'thisYear',
  all: 'allTime',
};

/**
 * THE money page — Cash & Accounts and the full ledger merged into one screen.
 *
 *   [period ▾ | from — to]        ← drives the flow numbers + the ledger
 *   [ Summary | Transactions ]
 *
 * SUMMARY: total balance (or the asset breakdown from the Home hero), the
 * period's in/out/net, loans, the accounts, and per-category totals — tapping a
 * category opens the ledger already filtered to it. TRANSACTIONS: search +
 * combinable filters + the day-grouped ledger. Reached from the Cash tile
 * (Summary first) and from every "see all" / account / project link
 * (Transactions first, pre-filtered).
 */
export function CashScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<MoneyRoute>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const fromCashTile = route.name === 'Cash';
  const cashParams = fromCashTile ? (route.params as RootStackParamList['Cash']) : undefined;
  const txnParams = !fromCashTile ? (route.params as RootStackParamList['Transactions']) : undefined;
  const assetsMode = cashParams?.scope === 'assets';

  const [tab, setTab] = useState<'summary' | 'txns'>(fromCashTile ? 'summary' : 'txns');
  // The underline slides between the two header tabs (Reanimated, UI thread).
  const [tabW, setTabW] = useState(0);
  const tabAnim = useSharedValue(fromCashTile ? 0 : 1);
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tabAnim.value * tabW }] }), [tabW]);
  const switchTab = (tb: 'summary' | 'txns') => {
    setTab(tb);
    tabAnim.value = withTiming(tb === 'txns' ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  };

  /* --------------------------------- data --------------------------------- */

  const [total, setTotal] = useState(0);
  const [assets, setAssets] = useState<CompanyAssets | null>(null);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [udhaar, setUdhaar] = useState<UdhaarTotals>({ receivable: 0, payable: 0 });
  const [txns, setTxns] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [txnTarget, setTxnTarget] = useState<Record<string, TxnModuleTarget>>({});
  const [loaded, setLoaded] = useState(false);
  // Pane fade+drift on tab switch and skeleton→data. Driven by a shared value
  // instead of Reanimated layout animations (`entering=`): an active layout
  // animation while react-native-screens runs a push/pop breaks the native
  // slide — this was why going back stopped animating.
  //
  // The reset happens DURING render (not in the effect): the effect fires only
  // after the new pane has already painted once, which flashed the content at
  // full opacity for a frame before hiding it again — the flicker.
  const paneAnim = useSharedValue(1);
  const paneKey = `${tab}-${String(loaded)}`;
  const prevPaneKey = useRef(paneKey);
  if (prevPaneKey.current !== paneKey) {
    prevPaneKey.current = paneKey;
    paneAnim.value = 0;
  }
  useEffect(() => {
    paneAnim.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneKey]);
  // Transform ONLY — animating opacity over elevation-shadowed cards makes
  // Android composite the shadows outside the alpha layer (white flashes).
  const paneStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - paneAnim.value) * 10 }],
  }));

  const load = useCallback(async () => {
    const [tot, accs, ud, rows, cats, projs, companyAssets] = await Promise.all([
      getTotalBalance(),
      listAccountsWithBalance(),
      getUdhaarTotals(),
      listAllCompanyTransactions(),
      listCategories(),
      listProjects(),
      assetsMode ? getCompanyAssets() : Promise.resolve(null),
    ]);
    setTotal(tot);
    setAccounts(accs);
    setUdhaar(ud);
    setTxns(rows);
    setCategories(cats);
    setProjects(projs);
    setAssets(companyAssets);
    setLoaded(true);
    const targets = await Promise.all(rows.map(async (x) => [x.id, await resolveTxnModuleTarget(x)] as const));
    setTxnTarget(Object.fromEntries(targets.filter(([, tt]) => tt) as [string, TxnModuleTarget][]));
  }, [assetsMode]);

  useFocusReload(load);

  /* ------------------------------- filters -------------------------------- */

  // Period window (This Month by default, like a monthly hisaab).
  const today = todayISO().slice(0, 10);
  const [period, setPeriod] = useState<PeriodKind>('month');
  const [customRange, setCustomRange] = useState<DateRange>({ start: today, end: today });
  const [periodSheet, setPeriodSheet] = useState(false);
  const [rangeSheet, setRangeSheet] = useState(false);
  const range: DateRange = period === 'custom' ? customRange : periodRange(period, today);

  // Ledger filters — context filters arrive pre-applied from the caller
  // (account page, project page…) and clear like any other chip.
  const [direction, setDirection] = useState<'all' | 'in' | 'out'>('all');
  const [query, setQuery] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [filterAccountId, setFilterAccountId] = useState<string | null>(txnParams?.accountId ?? null);
  const [filterProjectId, setFilterProjectId] = useState<string | null>(txnParams?.projectId ?? null);
  const [filterSheet, setFilterSheet] = useState(false);
  const [catSheet, setCatSheet] = useState(false);
  const [accSheet, setAccSheet] = useState(false);
  const [projSheet, setProjSheet] = useState(false);
  const [selected, setSelected] = useState<TransactionRow | null>(null);

  const hasFilters = direction !== 'all' || !!filterCategoryId || !!filterAccountId || !!filterProjectId;
  const clearFilters = () => {
    setDirection('all');
    setFilterCategoryId(null);
    setFilterAccountId(null);
    setFilterProjectId(null);
  };

  const catName = useCallback(
    (id: string | null) => {
      if (!id) return '';
      const c = categories.find((x) => x.id === id);
      return c ? (language === 'ur' ? c.name_ur : c.name_en) : '';
    },
    [categories, language]
  );
  const accountName = useCallback((id: string | null) => accounts.find((a) => a.id === id)?.name ?? '', [accounts]);
  const projectName = useCallback((id: string | null) => projects.find((p) => p.id === id)?.name ?? '', [projects]);

  // The period window applies to the flow summary AND the ledger.
  const windowed = useMemo(
    () => txns.filter((x) => inRange(x.date.slice(0, 10), range)),
    [txns, range.start, range.end] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // The ledger narrows further: direction, category, account, project, search.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return windowed.filter(
      (x) =>
        (direction === 'all' || x.direction === (direction === 'in' ? 'IN' : 'OUT')) &&
        (!filterCategoryId ||
          x.category_id === filterCategoryId ||
          categories.find((k) => k.id === x.category_id)?.parent_id === filterCategoryId) &&
        (!filterAccountId || x.account_id === filterAccountId) &&
        (!filterProjectId || x.project_id === filterProjectId) &&
        (!q ||
          (x.description ?? '').toLowerCase().includes(q) ||
          (x.counterparty_name ?? '').toLowerCase().includes(q) ||
          catName(x.category_id).toLowerCase().includes(q))
    );
  }, [windowed, direction, filterCategoryId, filterAccountId, filterProjectId, query, catName, categories]);

  /* ------------------------------- summary -------------------------------- */

  const totals = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    for (const x of windowed) {
      if (x.direction === 'IN') inSum += x.amount;
      else outSum += x.amount;
    }
    return { inSum, outSum, net: inSum - outSum };
  }, [windowed]);

  // Resolve a leaf category to its SECTION (Materials / Plot / Sale / Home
  // Expense…) — the summary shows the main picture, not every leaf.
  const sectionOf = useCallback(
    (id: string | null): { id: string | null; label: string } => {
      const c = id ? categories.find((x) => x.id === id) : undefined;
      if (!c) return { id: null, label: t('noCategory') };
      const sec = (c.parent_id ? categories.find((x) => x.id === c.parent_id) : undefined) ?? c;
      return { id: sec.id, label: language === 'ur' ? sec.name_ur : sec.name_en };
    },
    [categories, language, t]
  );

  const byCategory = useCallback(
    (dir: 'IN' | 'OUT') => {
      const map = new Map<string | null, { label: string; total: number }>();
      for (const x of windowed) {
        if (x.direction !== dir) continue;
        const sec = sectionOf(x.category_id);
        const cur = map.get(sec.id);
        if (cur) cur.total += x.amount;
        else map.set(sec.id, { label: sec.label, total: x.amount });
      }
      return Array.from(map.entries())
        .map(([id, v]) => ({ id, label: v.label, total: v.total }))
        .sort((a, b) => b.total - a.total);
    },
    [windowed, sectionOf]
  );
  const outByCat = useMemo(() => byCategory('OUT'), [byCategory]);
  const inByCat = useMemo(() => byCategory('IN'), [byCategory]);

  /** Summary category row → the ledger, pre-filtered to it. */
  const jumpToCategory = (dir: 'in' | 'out', id: string | null) => {
    if (!id) return;
    setDirection(dir);
    setFilterCategoryId(id);
    switchTab('txns');
  };

  /* -------------------------------- ledger -------------------------------- */

  const grouped = useMemo(() => {
    const groups: { date: string; rows: TransactionRow[] }[] = [];
    for (const txn of filtered) {
      const day = txn.date.slice(0, 10);
      const last = groups[groups.length - 1];
      if (last && last.date === day) last.rows.push(txn);
      else groups.push({ date: day, rows: [txn] });
    }
    return groups;
  }, [filtered]);

  // Progressive rendering: mount only the first day-groups and feed in more as
  // the user nears the bottom. Mounting the whole window at once made the tab
  // fade drop frames on long ledgers.
  const [groupLimit, setGroupLimit] = useState(GROUP_PAGE);
  useEffect(() => setGroupLimit(GROUP_PAGE), [filtered]);
  const shownGroups = useMemo(() => grouped.slice(0, groupLimit), [grouped, groupLimit]);

  const dayLabel = useCallback(
    (day: string) => {
      if (day === today) return t('today');
      if (day === dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')) return t('yesterday');
      return dayjs(day).format('DD MMMM YYYY');
    },
    [t, today]
  );

  const catOptions: SelectOption[] = useMemo(
    () => categories.map((c) => ({ id: c.id, label: language === 'ur' ? c.name_ur : c.name_en })),
    [categories, language]
  );

  const targetLabel = (tt?: TxnModuleTarget) =>
    tt?.kind === 'po' ? t('viewPurchaseOrder') : tt?.kind === 'investor' ? t('viewInvestor') : tt?.kind === 'labor' ? t('viewLabor') : undefined;

  const openTxnTarget = (tt: TxnModuleTarget, focusTxnId: string) => {
    setSelected(null);
    if (tt.kind === 'po') navigation.navigate('PurchaseOrderDetail', { poId: tt.poId, focusTxnId });
    else if (tt.kind === 'investor') navigation.navigate('InvestorProfile', { investorId: tt.investorId, focusTxnId });
    else navigation.navigate('LaborerDetail', { laborerId: tt.laborerId, focusTxnId });
  };

  const rangeText = `${range.start ? dayjs(range.start).format('DD MMM') : '…'} — ${range.end ? dayjs(range.end).format('DD MMM YYYY') : '…'}`;

  return (
    <View style={styles.screen}>
      <AppHeader
        title={assetsMode ? t('overviewTitle') : t('cashFlowTitle')}
        onBack={() => navigation.goBack()}
        bottom={
          <View style={styles.tabRow} onLayout={(e) => setTabW(e.nativeEvent.layout.width / 2)}>
            {(['summary', 'txns'] as const).map((tb) => {
              const active = tab === tb;
              return (
                <Pressable
                  key={tb}
                  onPress={() => switchTab(tb)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={styles.tabBtn}
                >
                  <AppText size="sm" weight="bold" color={active ? 'accent' : 'textSecondary'}>
                    {tb === 'summary' ? t('summaryTab') : t('transactions')}
                  </AppText>
                </Pressable>
              );
            })}
            <Animated.View style={[styles.tabIndicator, { width: tabW }, indicatorStyle]} />
          </View>
        }
      />
      {/* Search + a single filter button — all filters (incl. period) live in a sheet. */}
      {tab === 'txns' ? (
        <Animated.View style={[styles.searchRow, paneStyle]}>
          <View style={styles.flex}>
            <SearchBar value={query} onChange={setQuery} />
          </View>
          <Pressable
            onPress={() => setFilterSheet(true)}
            accessibilityRole="button"
            accessibilityLabel={t('filtersTitle')}
            style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]}
          >
            <AppIcon name="filter" size={20} color={hasFilters ? 'accent' : 'textSecondary'} />
            {hasFilters ? <View style={styles.filterDot} /> : null}
          </Pressable>
        </Animated.View>
      ) : null}

      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}
        scrollEventThrottle={80}
        onScroll={({ nativeEvent: e }) => {
          if (
            tab === 'txns' &&
            groupLimit < grouped.length &&
            e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - 600
          ) {
            setGroupLimit((l) => l + GROUP_PAGE);
          }
        }}
      >
        <Animated.View style={[styles.tabPane, paneStyle]}>
        {tab === 'summary' && !loaded ? (
          <SummarySkeleton styles={styles} assetsMode={assetsMode} />
        ) : tab === 'txns' && !loaded ? (
          <LedgerSkeleton styles={styles} />
        ) : tab === 'summary' ? (
          <>
            {/* Thin inline period picker — the window the flow numbers cover. */}
            <Pressable onPress={() => setPeriodSheet(true)} accessibilityRole="button" style={styles.periodInline}>
              <AppIcon name="today" size={14} color="accent" />
              <AppText size="xs" weight="semibold" color="textSecondary" numberOfLines={1}>
                {period === 'custom' ? rangeText : t(PERIOD_LABEL[period])}
              </AppText>
              <AppIcon name="chevronDown" size={14} color="textSecondary" />
            </Pressable>

            {/* Balance hero — the charcoal TOTAL card (same as the investor hero). */}
            <View style={styles.hero}>
              <AppText size="overline" weight="semibold" color="onPrimaryMuted" uppercase>
                {assetsMode ? t('totalAssets') : t('totalBalance')}
              </AppText>
              <AppText size="display" weight="bold" color="onHero" tabular numberOfLines={1} adjustsFontSizeToFit>
                {formatRupees(assetsMode ? assets?.total ?? total : total)}
              </AppText>
              {assetsMode ? (
                <View style={styles.heroBreakdown}>
                  <View style={styles.heroRow}>
                    <AppText size="sm" color="onPrimaryMuted">
                      {t('tabCash')}
                    </AppText>
                    <AppText size="sm" weight="bold" color="onHero" tabular>
                      {formatRupees(assets?.cash ?? total)}
                    </AppText>
                  </View>
                  <View style={styles.heroRow}>
                    <AppText size="sm" color="onPrimaryMuted">
                      {t('assetPlots')}
                    </AppText>
                    <AppText size="sm" weight="bold" color="gold" tabular>
                      {formatRupees(assets?.plotsValue ?? 0)}
                    </AppText>
                  </View>
                  <View style={styles.heroRow}>
                    <AppText size="sm" color="onPrimaryMuted">
                      {t('assetConstruction')}
                    </AppText>
                    <AppText size="sm" weight="bold" color="success" tabular>
                      {formatRupees(assets?.constructionValue ?? 0)}
                    </AppText>
                  </View>
                </View>
              ) : null}

              {/* The window's money flow, in the same card. */}
              <View style={styles.heroBreakdown}>
                <View style={styles.heroRow}>
                  <AppText size="sm" color="onPrimaryMuted">
                    {t('moneyIn')}
                  </AppText>
                  <AppText size="sm" weight="bold" color="success" tabular>
                    {`+ ${formatRupees(totals.inSum)}`}
                  </AppText>
                </View>
                <View style={styles.heroRow}>
                  <AppText size="sm" color="onPrimaryMuted">
                    {t('moneyOut')}
                  </AppText>
                  <AppText size="sm" weight="bold" color="danger" tabular>
                    {`− ${formatRupees(totals.outSum)}`}
                  </AppText>
                </View>
                <View style={styles.heroRow}>
                  <AppText size="sm" weight="semibold" color="onHero">
                    {t('netFlow')}
                  </AppText>
                  <AppText size="sm" weight="bold" color={totals.net >= 0 ? 'success' : 'danger'} tabular>
                    {`${totals.net >= 0 ? '+ ' : '− '}${formatRupees(Math.abs(totals.net))}`}
                  </AppText>
                </View>
              </View>
            </View>

            {/* Loans — heading on the page, one ruled card (investor-page pattern). */}
            <View style={styles.sectionHeader}>
              <AppText size="lg" weight="bold" style={styles.flex}>
                {t('udhaar')}
              </AppText>
              <Pressable onPress={() => navigation.navigate('Udhaar')} hitSlop={theme.touch.hitSlop} accessibilityRole="button">
                <AppText size="sm" weight="semibold" color="accent">
                  {t('seeAll')}
                </AppText>
              </Pressable>
            </View>
            <AppCard compact>
              <Pressable
                onPress={() => navigation.navigate('Udhaar')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
              >
                <AppText size="sm" weight="semibold" color="textSecondary" style={styles.flex}>
                  {t('receivable')}
                </AppText>
                <AppText size="md" weight="bold" color="success" tabular numberOfLines={1} adjustsFontSizeToFit>
                  {formatRupees(udhaar.receivable)}
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('Udhaar')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.listRow, styles.rowRule, pressed && styles.pressed]}
              >
                <AppText size="sm" weight="semibold" color="textSecondary" style={styles.flex}>
                  {t('payable')}
                </AppText>
                <AppText size="md" weight="bold" color={udhaar.payable > 0 ? 'danger' : 'textPrimary'} tabular numberOfLines={1} adjustsFontSizeToFit>
                  {formatRupees(udhaar.payable)}
                </AppText>
              </Pressable>
            </AppCard>

            {/* Accounts — heading on the page, one ruled row per account. */}
            <View style={styles.sectionHeader}>
              <AppText size="lg" weight="bold" style={styles.flex}>
                {t('accountsTitle')}
              </AppText>
            </View>
            <AppCard compact>
              {accounts.map((a, i) => (
                <Pressable
                  key={a.id}
                  onPress={() => navigation.navigate('AccountDetail', { accountId: a.id })}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.accountRow, i > 0 && styles.rowRule, pressed && styles.pressed]}
                >
                  <AppIcon name={ACCOUNT_ICON[a.type]} size={20} color="accent" />
                  <View style={styles.flex}>
                    <AppText size="sm" weight="semibold" numberOfLines={1}>
                      {a.name}
                    </AppText>
                    <AppText size="xs" color="textSecondary">
                      {t(TYPE_LABEL[a.type])}
                    </AppText>
                  </View>
                  <AppText size="md" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit style={styles.accountBalance}>
                    {formatRupees(a.balance)}
                  </AppText>
                  <AppIcon name="forward" size={16} color="textSecondary" />
                </Pressable>
              ))}
            </AppCard>

            {/* Per-category totals for the window — Total first, then largest.
                Tap a row to open the ledger already filtered to it. */}
            <SummarySection title={t('moneyOut')} rows={outByCat} total={totals.outSum} tone="danger" onRow={(id) => jumpToCategory('out', id)} styles={styles} />
            {inByCat.length > 0 ? (
              <SummarySection title={t('moneyIn')} rows={inByCat} total={totals.inSum} tone="success" onRow={(id) => jumpToCategory('in', id)} styles={styles} />
            ) : null}
          </>
        ) : (
          <>
            {shownGroups.map((g) => {
              const rows: LedgerRow[] = groupTxnActivity(g.rows).map((grp) => {
                const first = grp.txns[0];
                const cat = catName(first.category_id);
                const title =
                  first.description || cat || first.counterparty_name || (first.direction === 'IN' ? t('aamdani') : t('kharcha'));
                // The day header already gives the date, so the second line
                // carries what the title doesn't: who (counterparty), the
                // category (only when the title doesn't already say it),
                // where (project) and via which account — first two only.
                const parts = [
                  first.counterparty_name && first.counterparty_name !== title ? first.counterparty_name : '',
                  cat && !title.toLowerCase().includes(cat.toLowerCase()) ? cat : '',
                  projectName(first.project_id),
                  accountName(first.account_id),
                ]
                  .filter(Boolean)
                  .slice(0, 2);
                return {
                  id: grp.id,
                  title,
                  date: first.date,
                  subtitle: parts.join(' · '),
                  amount: grp.total,
                  direction: first.direction === 'IN' ? ('in' as const) : ('out' as const),
                  onPress: () => setSelected(grp.isBatch ? { ...first, amount: grp.total } : first),
                };
              });
              return (
                <View key={g.date} style={styles.daySection}>
                  <AppText size="xs" weight="semibold" color="textSecondary" style={styles.dayHeader}>
                    {dayLabel(g.date)}
                  </AppText>
                  <AppCard compact>
                    <LedgerTable rows={rows} />
                  </AppCard>
                </View>
              );
            })}
            {filtered.length === 0 ? (
              <AppCard compact>
                <AppText size="sm" color="textSecondary" center style={styles.emptyText}>
                  {t('emptyLedger')}
                </AppText>
              </AppCard>
            ) : null}
          </>
        )}
        </Animated.View>
      </ScrollView>

      {/* Ledger filters — period, direction + the three pickers, one thin sheet.
          Declared BEFORE the nested pickers so they stack above it. */}
      <AppSheet
        visible={filterSheet}
        onClose={() => setFilterSheet(false)}
        title={t('filtersTitle')}
        footer={<AppButton label={t('done')} icon="check" onPress={() => setFilterSheet(false)} fullWidth />}
      >
        <View style={styles.filterList}>
          <FilterRow
            label={t('date')}
            value={period === 'custom' ? rangeText : t(PERIOD_LABEL[period])}
            onPress={() => setPeriodSheet(true)}
            styles={styles}
            theme={theme}
          />
          <FilterRow
            label={t('category')}
            value={catName(filterCategoryId)}
            onPress={() => setCatSheet(true)}
            onClear={filterCategoryId ? () => setFilterCategoryId(null) : undefined}
            styles={styles}
            theme={theme}
          />
          <FilterRow
            label={t('selectAccount')}
            value={accountName(filterAccountId)}
            onPress={() => setAccSheet(true)}
            onClear={filterAccountId ? () => setFilterAccountId(null) : undefined}
            styles={styles}
            theme={theme}
          />
          <FilterRow
            label={t('selectProject')}
            value={projectName(filterProjectId)}
            onPress={() => setProjSheet(true)}
            onClear={filterProjectId ? () => setFilterProjectId(null) : undefined}
            styles={styles}
            theme={theme}
          />
          {/* In | Out | All lives as a thin segment at the end of the list. */}
          <View style={styles.segment}>
            {(['all', 'in', 'out'] as const).map((d) => (
              <Pressable
                key={d}
                onPress={() => setDirection(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: direction === d }}
                style={[styles.segBtn, direction === d && styles.segBtnActive]}
              >
                <AppText size="sm" weight="bold" color={direction === d ? 'onPrimary' : 'textSecondary'}>
                  {t(d === 'all' ? 'filterAll' : d === 'in' ? 'filterIn' : 'filterOut')}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
        {hasFilters ? (
          <Pressable onPress={clearFilters} accessibilityRole="button" style={({ pressed }) => [styles.clearAllBtn, pressed && styles.pressed]}>
            <AppText size="sm" weight="semibold" color="danger">
              {t('clearFilters')}
            </AppText>
          </Pressable>
        ) : null}
      </AppSheet>

      {/* Period preset picker */}
      <SelectSheet
        visible={periodSheet}
        onClose={() => setPeriodSheet(false)}
        options={[
          ...(Object.keys(PERIOD_LABEL) as (keyof typeof PERIOD_LABEL)[]).map((k) => ({ id: k, label: t(PERIOD_LABEL[k]) })),
          { id: 'custom', label: t('customRange') },
        ]}
        selectedId={period}
        title={t('selectOne')}
        searchable={false}
        onSelect={(o) => {
          if (o.id === 'custom') {
            setCustomRange(range.start && range.end ? range : { start: today, end: today });
            setPeriod('custom');
            setRangeSheet(true);
          } else {
            setPeriod(o.id as PeriodKind);
          }
        }}
      />

      {/* Custom from–to range */}
      <AppSheet
        visible={rangeSheet}
        onClose={() => setRangeSheet(false)}
        title={t('customRange')}
        footer={<AppButton label={t('done')} icon="check" onPress={() => setRangeSheet(false)} fullWidth />}
      >
        <AppText size="sm" weight="semibold" color="textSecondary">
          {t('fromDate')}
        </AppText>
        <DateField
          value={customRange.start ?? today}
          onChange={(d) => {
            setPeriod('custom');
            setCustomRange((r) => ({ start: d, end: r.end && r.end >= d ? r.end : d }));
          }}
        />
        <AppText size="sm" weight="semibold" color="textSecondary">
          {t('toDate')}
        </AppText>
        <DateField
          value={customRange.end ?? today}
          onChange={(d) => {
            setPeriod('custom');
            setCustomRange((r) => ({ start: r.start && r.start <= d ? r.start : d, end: d }));
          }}
        />
      </AppSheet>

      <SelectSheet
        visible={catSheet}
        onClose={() => setCatSheet(false)}
        options={catOptions}
        selectedId={filterCategoryId ?? undefined}
        title={t('category')}
        onSelect={(o) => setFilterCategoryId(o.id)}
      />
      <SelectSheet
        visible={accSheet}
        onClose={() => setAccSheet(false)}
        options={accounts.map((a) => ({ id: a.id, label: a.name }))}
        selectedId={filterAccountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setFilterAccountId(o.id)}
      />
      <SelectSheet
        visible={projSheet}
        onClose={() => setProjSheet(false)}
        options={projects.map((p) => ({ id: p.id, label: p.name }))}
        selectedId={filterProjectId ?? undefined}
        title={t('selectProject')}
        onSelect={(o) => setFilterProjectId(o.id)}
      />

      {/* Read-only detail — jump to the relevant module page to edit. */}
      <TransactionDetailSheet
        txn={selected}
        onClose={() => setSelected(null)}
        onOpen={selected && txnTarget[selected.id] ? () => openTxnTarget(txnTarget[selected.id], selected.id) : undefined}
        openLabel={selected ? targetLabel(txnTarget[selected.id]) : undefined}
      />
    </View>
  );
}

/* ------------------------------- pieces ---------------------------------- */

/** Loading placeholder for the Summary tab — same hero + section shapes. */
function SummarySkeleton({ styles, assetsMode }: { styles: ReturnType<typeof makeStyles>; assetsMode: boolean }): React.JSX.Element {
  return (
    <>
      <View style={styles.hero}>
        <SkeletonBlock width={110} onDark />
        <SkeletonBlock width="62%" height={30} onDark />
        <View style={styles.heroBreakdown}>
          {(assetsMode ? [0, 1, 2] : [0, 1]).map((i) => (
            <View key={i} style={styles.heroRow}>
              <SkeletonBlock width={90} onDark />
              <SkeletonBlock width={120} onDark />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.sectionHeader}>
        <SkeletonBlock width={90} height={16} />
      </View>
      <AppCard compact>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.listRow, i > 0 && styles.rowRule]}>
            <SkeletonBlock width={100} />
            <View style={styles.flex} />
            <SkeletonBlock width={110} height={14} />
          </View>
        ))}
      </AppCard>
      <View style={styles.sectionHeader}>
        <SkeletonBlock width={110} height={16} />
      </View>
      <AppCard compact>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.accountRow, i > 0 && styles.rowRule]}>
            <SkeletonBlock width={22} height={22} round />
            <View style={styles.skelCol}>
              <SkeletonBlock width="55%" />
              <SkeletonBlock width="30%" height={10} />
            </View>
            <SkeletonBlock width={90} height={14} />
          </View>
        ))}
      </AppCard>
    </>
  );
}

/** Loading placeholder for the Transactions tab — day-grouped ledger shapes. */
function LedgerSkeleton({ styles }: { styles: ReturnType<typeof makeStyles> }): React.JSX.Element {
  return (
    <>
      {[0, 1].map((g) => (
        <View key={g} style={styles.daySection}>
          <SkeletonBlock width={120} />
          <AppCard compact>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.accountRow, i > 0 && styles.rowRule]}>
                <SkeletonBlock width={20} height={20} round />
                <View style={styles.skelCol}>
                  <SkeletonBlock width="60%" />
                  <SkeletonBlock width="35%" height={10} />
                </View>
                <SkeletonBlock width={84} height={14} />
              </View>
            ))}
          </AppCard>
        </View>
      ))}
    </>
  );
}

/** One picker row inside the filter sheet: label · chosen value · ›/✕. */
function FilterRow({
  label,
  value,
  onPress,
  onClear,
  styles,
  theme,
}: {
  label: string;
  value: string;
  onPress: () => void;
  onClear?: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}): React.JSX.Element {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.filterRow, pressed && styles.pressed]}>
      <AppText size="sm" weight="semibold" color="textSecondary" style={styles.flex}>
        {label}
      </AppText>
      {value ? (
        <AppText size="sm" weight="bold" numberOfLines={1} style={styles.filterValue}>
          {value}
        </AppText>
      ) : null}
      {onClear ? (
        <Pressable onPress={onClear} hitSlop={theme.touch.hitSlop} accessibilityRole="button" accessibilityLabel={label}>
          <AppIcon name="close" size={16} color="textSecondary" />
        </Pressable>
      ) : (
        <AppIcon name="forward" size={16} color="textSecondary" />
      )}
    </Pressable>
  );
}

/** One direction's category breakdown: Total first, then categories desc. */
function SummarySection({
  title,
  rows,
  total,
  tone,
  onRow,
  styles,
}: {
  title: string;
  rows: { id: string | null; label: string; total: number }[];
  total: number;
  tone: 'success' | 'danger';
  onRow: (id: string | null) => void;
  styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <>
      <View style={styles.sectionHeader}>
        <AppText size="lg" weight="bold" style={styles.flex}>
          {title}
        </AppText>
        <AppText size="sm" weight="bold" color={tone} tabular>
          {formatRupees(total)}
        </AppText>
      </View>
      <AppCard compact>
        {rows.map((r, i) => (
          <Pressable
            key={r.id ?? '__none__'}
            onPress={r.id ? () => onRow(r.id) : undefined}
            accessibilityRole={r.id ? 'button' : undefined}
            style={({ pressed }) => [styles.catRow, i > 0 && styles.rowRule, pressed && r.id ? styles.pressed : null]}
          >
            <AppText size="sm" color="textSecondary" numberOfLines={1} style={styles.flex}>
              {r.label}
            </AppText>
            <AppText size="sm" weight="semibold" color={tone} tabular>
              {formatRupees(r.total)}
            </AppText>
          </Pressable>
        ))}
      </AppCard>
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    /* inline period picker (Summary tab) */
    periodInline: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: theme.spacing.xs,
      minHeight: 32,
      paddingHorizontal: theme.spacing.xs,
    },
    /* header tabs — Vyapar-style underline, flush with the header border */
    tabRow: { flexDirection: 'row' },
    tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 42, paddingTop: theme.spacing.xs },
    tabIndicator: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      height: 2.5,
      backgroundColor: theme.colors.accent,
      borderTopLeftRadius: 2,
      borderTopRightRadius: 2,
    },
    /* search + filter button */
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.page,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.xs,
    },
    filterBtn: {
      width: theme.touch.minTarget - 6,
      height: theme.touch.minTarget - 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    filterDot: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.accent,
    },
    /* filter sheet — thin rows with hairline dividers, Vyapar-style */
    filterList: {},
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: theme.touch.minTarget - 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    filterValue: { maxWidth: '55%' },
    segment: {
      flexDirection: 'row',
      padding: 3,
      marginTop: theme.spacing.md,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.background,
    },
    segBtn: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill },
    segBtnActive: { backgroundColor: theme.colors.primary },
    clearAllBtn: { alignSelf: 'center', minHeight: theme.touch.minTarget - 16, justifyContent: 'center', paddingHorizontal: theme.spacing.lg },
    /* content */
    content: { paddingHorizontal: theme.spacing.page, paddingTop: theme.spacing.xs },
    // The animated pane is the scroll content's single child — it carries the gap.
    tabPane: { gap: theme.spacing.md },
    emptyText: { paddingVertical: theme.spacing.xl },
    daySection: { gap: theme.spacing.sm },
    dayHeader: { marginLeft: theme.spacing.xs, marginTop: theme.spacing.xs },
    /* summary */
    hero: {
      backgroundColor: theme.colors.heroBg,
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    heroBreakdown: {
      marginTop: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.onPrimaryDivider,
      gap: theme.spacing.xs,
    },
    heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      marginTop: theme.spacing.sm,
      marginBottom: -theme.spacing.xs,
    },
    accountRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, minHeight: 56 },
    accountBalance: { maxWidth: '45%' },
    skelCol: { flex: 1, gap: 5 },
    rowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    catRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: theme.touch.minTarget - 12,
    },
    listRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, minHeight: 48 },
    pressed: { opacity: 0.6 },
  });
