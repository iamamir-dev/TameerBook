import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddExpenseSheet } from '@/components/construction/AddExpenseSheet';
import { AddWorkerSheet } from '@/components/construction/AddWorkerSheet';
import { CategoryBars } from '@/components/construction/CategoryBars';
import { MilestoneChecklist } from '@/components/construction/MilestoneChecklist';
import { WorkerSheet } from '@/components/construction/WorkerSheet';
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
  listAccountsWithBalance,
  listCategories,
  listLaborers,
  listMilestones,
  listProjectLaborers,
  listProjectPhaseTransactions,
  setMilestoneStatus,
  type AccountWithBalance,
  type CategoryRow,
  type ConstructionSummary,
  type LaborerRow,
  type MilestoneRow,
  type ProjectLaborerSummary,
  type TransactionRow,
} from '@/db';
import { useCategoryLabel, useFocusReload } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ConstructionDetail'>;

/** Expense categories that belong to the construction phase. */
const CONSTRUCTION_CATEGORY_NAMES = new Set([
  'Cement',
  'Sariya',
  'Bricks',
  'Sand/Crush',
  'Tiles',
  'Wood',
  'Paint',
  'Electric',
  'Sanitary',
  'Contractor',
  'Utilities',
  'Misc',
  'Labor Dehari',
]);

/**
 * Construction-phase home for a project: the true build cost (cash spend +
 * accrued labor), category breakdown, quick expense entry, the labor khata
 * (attendance + wage balances + payments), milestone progress, and the
 * phase ledger.
 */
export function ConstructionDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { projectId } = useRoute<Route>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const today = todayISO().slice(0, 10);

  const [summary, setSummary] = useState<ConstructionSummary | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [workers, setWorkers] = useState<ProjectLaborerSummary[]>([]);
  const [allLaborers, setAllLaborers] = useState<LaborerRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [txns, setTxns] = useState<TransactionRow[]>([]);

  // Sheets
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [worker, setWorker] = useState<ProjectLaborerSummary | null>(null);
  const [addWorkerOpen, setAddWorkerOpen] = useState(false);

  const loadData = useCallback(async () => {
    const [sum, cats, accs, wkrs, ms, tx, labs] = await Promise.all([
      getConstructionSummary(projectId, dayjs().format('YYYY-MM')),
      listCategories(),
      listAccountsWithBalance(),
      listProjectLaborers(projectId),
      listMilestones(projectId),
      listProjectPhaseTransactions(projectId, 'CONSTRUCTION'),
      listLaborers(),
    ]);
    setSummary(sum);
    setCategories(cats);
    setAccounts(accs);
    setWorkers(wkrs);
    setMilestones(ms);
    setTxns(tx);
    setAllLaborers(labs);
  }, [projectId]);

  const { reload } = useFocusReload(loadData);

  const catLabel = useCategoryLabel();
  const catNameById = useCallback(
    (id: string | null): string => {
      if (!id) return '';
      const c = categories.find((x) => x.id === id);
      return c ? catLabel(c) : '';
    },
    [categories, catLabel]
  );

  const constructionCats = useMemo(
    () => categories.filter((c) => c.type === 'EXPENSE' && CONSTRUCTION_CATEGORY_NAMES.has(c.name_en)),
    [categories]
  );

  const availableLaborers = useMemo(
    () => allLaborers.filter((l) => !workers.some((w) => w.laborer.id === l.id)),
    [allLaborers, workers]
  );

  /* ------------------------------ milestones ------------------------------ */

  const toggleMilestone = useCallback(
    async (m: MilestoneRow) => {
      const done = m.status === 'DONE';
      await setMilestoneStatus(m.id, done ? 'PENDING' : 'DONE', done ? null : today);
      setMilestones(await listMilestones(projectId));
    },
    [projectId, today]
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

        <AppButton label={t('addExpense')} icon="kharcha" onPress={() => setExpenseOpen(true)} />

        {/* Labor section */}
        <View style={styles.sectionHeader}>
          <AppText size="lg" weight="bold">
            {t('laborTitle')}
          </AppText>
          <Pressable onPress={() => setAddWorkerOpen(true)} hitSlop={theme.touch.hitSlop} accessibilityRole="button">
            <AppText size="sm" weight="semibold" color="accent">
              {t('addWorker')}
            </AppText>
          </Pressable>
        </View>

        {workers.length === 0 ? (
          <AppCard compact>
            <AppText size="sm" color="textSecondary" center style={styles.emptyText}>
              {t('noWorkers')}
            </AppText>
          </AppCard>
        ) : (
          workers.map((w) => (
            <AppCard key={w.projectLaborer.id} compact onPress={() => setWorker(w)}>
              <View style={styles.workerTop}>
                <View style={styles.flex}>
                  <AppText size="md" weight="bold" numberOfLines={1}>
                    {w.laborer.name}
                  </AppText>
                  <AppText size="xs" color="textSecondary">
                    {t('dailyWage')}: {formatRupees(w.projectLaborer.daily_wage)}
                  </AppText>
                </View>
                <View style={styles.workerBalance}>
                  <AppText size="xs" color="textSecondary">
                    {t('wageBalance')}
                  </AppText>
                  <AppText size="md" weight="bold" color={w.balance.balance > 0 ? 'danger' : 'success'} tabular>
                    {formatRupees(w.balance.balance)}
                  </AppText>
                </View>
              </View>
              <AppText size="xs" color="textSecondary" style={styles.workerStats}>
                {t('earnedLabel')} {formatRupees(w.balance.accrued)} · {t('takenLabel')}{' '}
                {formatRupees(w.balance.paid)} · {w.balance.daysFull + w.balance.daysHalf} {t('daysLabel')}
              </AppText>
            </AppCard>
          ))
        )}

        {/* Milestones  collapsible progress checklist */}
        <MilestoneChecklist milestones={milestones} onToggle={toggleMilestone} />

        {/* Phase ledger */}
        <View style={styles.sectionHeader}>
          <AppText size="lg" weight="bold">
            {t('transactions')}
          </AppText>
        </View>
        <AppCard compact>
          <LedgerTable rows={ledgerRows} />
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
    workerTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    workerBalance: { alignItems: 'flex-end' },
    workerStats: { marginTop: theme.spacing.xs },
  });
