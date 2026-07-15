import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StageBadge } from '@/components/StageBadge';
import { AddExpenseSheet } from '@/components/construction/AddExpenseSheet';
import { AddWorkerSheet } from '@/components/construction/AddWorkerSheet';
import { CategoryBars } from '@/components/construction/CategoryBars';
import { WorkerSheet } from '@/components/construction/WorkerSheet';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import {
  AppButton,
  AppCard,
  AppHeader,
  AppText,
  LedgerTable,
  type LedgerRow,
} from '@/components/ui';
import {
  getConstructionSummary,
  getProject,
  listAccountsWithBalance,
  listCategories,
  listLaborers,
  listProjectLaborers,
  listProjectPhaseTransactions,
  type AccountWithBalance,
  type CategoryRow,
  type ConstructionSummary,
  type LaborerRow,
  type ProjectLaborerSummary,
  type ProjectRow,
  type TransactionRow,
} from '@/db';
import { useCategoryLabel, useFocusReload } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ConstructionDetail'>;

/**
 * Construction-phase home for a project: the true build cost (cash spend +
 * accrued labor), category breakdown, quick expense entry, the labor khata
 * (attendance + wage balances + payments), and the phase ledger. Milestone
 * progress lives on Project Detail (UC-11).
 */
export function ConstructionDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { projectId } = useRoute<Route>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [summary, setSummary] = useState<ConstructionSummary | null>(null);
  const [txnDetail, setTxnDetail] = useState<TransactionRow | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [workers, setWorkers] = useState<ProjectLaborerSummary[]>([]);
  const [allLaborers, setAllLaborers] = useState<LaborerRow[]>([]);
  const [txns, setTxns] = useState<TransactionRow[]>([]);

  // Sheets
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [worker, setWorker] = useState<ProjectLaborerSummary | null>(null);
  const [addWorkerOpen, setAddWorkerOpen] = useState(false);

  const loadData = useCallback(async () => {
    const [sum, proj, cats, accs, wkrs, tx, labs] = await Promise.all([
      getConstructionSummary(projectId, dayjs().format('YYYY-MM')),
      getProject(projectId),
      listCategories(),
      listAccountsWithBalance(),
      listProjectLaborers(projectId),
      listProjectPhaseTransactions(projectId, 'CONSTRUCTION'),
      listLaborers(),
    ]);
    setSummary(sum);
    setProject(proj);
    setCategories(cats);
    setAccounts(accs);
    setWorkers(wkrs);
    setTxns(tx);
    setAllLaborers(labs);
  }, [projectId]);

  const { reload } = useFocusReload(loadData);

  // A completed project's construction phase is read-only history.
  const completed = project?.status === 'COMPLETED';

  const catLabel = useCategoryLabel();
  const catNameById = useCallback(
    (id: string | null): string => {
      if (!id) return '';
      const c = categories.find((x) => x.id === id);
      return c ? catLabel(c) : '';
    },
    [categories, catLabel]
  );

  // Construction-relevant EXPENSE categories: the Materials + Labor headings'
  // sub-categories plus stand-alone leaves. Home/Plot/Sale subs stay on their
  // own pages — Groceries or Registry never belong on a construction expense.
  const constructionCats = useMemo(() => {
    const parents = new Set(categories.map((c) => c.parent_id).filter(Boolean) as string[]);
    const headId = (name: string) => categories.find((c) => !c.parent_id && c.name_en === name)?.id;
    const allowed = new Set([headId('Materials'), headId('Labor'), null]);
    return categories.filter(
      (c) => c.type === 'EXPENSE' && !c.is_system && !parents.has(c.id) && allowed.has(c.parent_id)
    );
  }, [categories]);

  const availableLaborers = useMemo(
    () => allLaborers.filter((l) => !workers.some((w) => w.laborer.id === l.id)),
    [allLaborers, workers]
  );

  /* -------------------------------- ledger -------------------------------- */

  const ledgerRows: LedgerRow[] = useMemo(
    () =>
      txns.map((txn) => ({
        id: txn.id,
        title: txn.description || catNameById(txn.category_id) || txn.counterparty_name || t('kharcha'),
        date: txn.date,
        amount: txn.amount,
        direction: txn.direction === 'IN' ? 'in' : 'out',
        typeLabel: catNameById(txn.category_id) || undefined,
        onPress: () => setTxnDetail(txn),
      })),
    [txns, catNameById, t]
  );

  return (
    <View style={styles.screen}>
      <AppHeader title={t('phaseConstruction')} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {/* Hero  the true build cost (cash spend + accrued labor) */}
        <AppCard style={styles.hero}>
          <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
            {t('constructionCost')}
          </AppText>
          <AppText size="display" weight="bold" color="primary" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(summary?.total ?? 0)}
          </AppText>
          <AppText size="sm" weight="semibold" color="textSecondary">
            {t('thisMonth')}: {formatRupees(summary?.thisMonth ?? 0)}
          </AppText>
        </AppCard>

        {/* Top categories */}
        <CategoryBars byCategory={summary?.byCategory ?? []} laborAccrued={summary?.laborAccrued ?? 0} />

        {!completed ? (
          <AppButton label={t('addConstructionExpense')} icon="kharcha" onPress={() => setExpenseOpen(true)} />
        ) : null}

        {/* Labor on THIS project only. The worker's full khata (all projects
            + company history) lives in the company-level Labor section. */}
        <View style={styles.sectionHeader}>
          <AppText size="lg" weight="bold">
            {t('laborTitle')}
          </AppText>
          {!completed ? (
            <Pressable onPress={() => setAddWorkerOpen(true)} hitSlop={theme.touch.hitSlop} accessibilityRole="button">
              <AppText size="sm" weight="semibold" color="accent">
                {t('addWorker')}
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {workers.length === 0 ? (
          <AppCard compact>
            <AppText size="sm" color="textSecondary" center style={styles.emptyText}>
              {t('noWorkers')}
            </AppText>
          </AppCard>
        ) : (
          workers.map((w) => (
            // On a completed project the card is informational only — the
            // pay/attendance sheet never opens.
            <AppCard key={w.projectLaborer.id} compact onPress={completed ? undefined : () => setWorker(w)}>
              {/* Header — name + wage on the left, today's status on the right. */}
              <View style={styles.workerTop}>
                <View style={styles.flex}>
                  <AppText size="md" weight="bold" numberOfLines={1}>
                    {w.laborer.name}
                  </AppText>
                  <AppText size="xs" color="textSecondary">
                    {`${t('dailyWage')}: ${formatRupees(w.projectLaborer.daily_wage)} · ${w.balance.daysFull + w.balance.daysHalf} ${t('daysLabel')}`}
                  </AppText>
                </View>
                {w.todayStatus ? (
                  <StageBadge
                    tone={w.todayStatus === 'FULL' ? 'success' : w.todayStatus === 'HALF' ? 'gold' : 'danger'}
                    label={t(
                      w.todayStatus === 'FULL' ? 'attFull' : w.todayStatus === 'HALF' ? 'attHalf' : 'attAbsent'
                    )}
                  />
                ) : (
                  <AppText size="xs" weight="semibold" color="textSecondary">
                    {t('notMarkedToday')}
                  </AppText>
                )}
              </View>

              {/* One stretched math line — earned | taken | balance. */}
              <View style={styles.workerColumns}>
                <View style={styles.workerCol}>
                  <AppText size="sm" weight="semibold" tabular numberOfLines={1} adjustsFontSizeToFit>
                    {formatRupees(w.balance.accrued)}
                  </AppText>
                  <AppText size="xs" color="textSecondary" numberOfLines={1}>
                    {t('earnedLabel')}
                  </AppText>
                </View>
                <View style={styles.workerColDivider} />
                <View style={styles.workerCol}>
                  <AppText size="sm" weight="semibold" color="danger" tabular numberOfLines={1} adjustsFontSizeToFit>
                    {formatRupees(w.balance.paid)}
                  </AppText>
                  <AppText size="xs" color="textSecondary" numberOfLines={1}>
                    {t('takenLabel')}
                  </AppText>
                </View>
                <View style={styles.workerColDivider} />
                <View style={styles.workerCol}>
                  <AppText
                    size="sm"
                    weight="bold"
                    color={w.balance.balance > 0 ? 'danger' : 'success'}
                    tabular
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatRupees(w.balance.balance)}
                  </AppText>
                  <AppText size="xs" color="textSecondary" numberOfLines={1}>
                    {t('wageBalance')}
                  </AppText>
                </View>
              </View>
            </AppCard>
          ))
        )}

        {/* Phase ledger */}
        <View style={styles.sectionHeader}>
          <AppText size="lg" weight="bold">
            {t('transactions')}
          </AppText>
        </View>
        <AppCard compact>
          <LedgerTable rows={ledgerRows} emptyText={t('emptyLedger')} />
        </AppCard>
      </ScrollView>

      {/* ------------------------------- sheets -------------------------------- */}
      <AddExpenseSheet
        visible={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        projectId={projectId}
        categories={constructionCats}
        accounts={accounts}
        onSaved={reload}
      />
      <WorkerSheet worker={worker} onClose={() => setWorker(null)} accounts={accounts} onSaved={reload} />
      <AddWorkerSheet
        visible={addWorkerOpen}
        onClose={() => setAddWorkerOpen(false)}
        projectId={projectId}
        availableLaborers={availableLaborers}
        onSaved={reload}
      />
      <TransactionDetailSheet txn={txnDetail} onClose={() => setTxnDetail(null)} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    /* hero */
    hero: { gap: theme.spacing.xs },
    /* sections */
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    emptyText: { paddingVertical: theme.spacing.md },
    /* worker cards */
    workerColumns: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginTop: theme.spacing.sm,
      borderTopWidth: 0.5,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.sm,
    },
    workerCol: { flex: 1, alignItems: 'center', gap: 2 },
    workerColDivider: { width: 0.5, backgroundColor: theme.colors.border, marginVertical: 2 },
    workerTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    workerBalance: { alignItems: 'flex-end' },
    workerStats: { marginTop: theme.spacing.xs },
    todayPill: { flexDirection: 'row', marginTop: theme.spacing.xs },
  });
