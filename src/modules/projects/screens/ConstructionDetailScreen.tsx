import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import { AddWorkerSheet, WorkerSheet } from '@/modules/labor';
import {
  AppButton,
  AppCard,
  AppHeader,
  AppText,
  LedgerTable,
  Toast,
  type LedgerRow,
} from '@/components/ui';
import {
  markAllPresentForProject,
  voidTransaction,
  type ProjectLaborerSummary,
  type TransactionRow,
} from '@/db';
import { useCategoryLabel, useModuleCategories, useSaveAction, useToast } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

import { AddExpenseSheet } from '../components/AddExpenseSheet';
import { CategoryBars } from '../components/CategoryBars';
import { WorkerCard } from '../components/WorkerCard';
import { useConstructionDetail } from '../hooks/useConstructionDetail';
import { makeStyles } from '../styled/ConstructionDetailScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ConstructionDetail'>;

/**
 * Construction-phase home for a project: the true build cost (cash spend +
 * accrued labor), category breakdown, quick expense entry, the labor khata
 * (attendance + wage balances + payments), and the phase ledger — plain
 * expenses editable in place. Thin orchestrator over useConstructionDetail.
 */
export function ConstructionDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { projectId } = useRoute<Route>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { data, reload } = useConstructionDetail(projectId);
  const { summary, project, accounts, workers, allLaborers, txns } = data;
  const { saving, run: runSave } = useSaveAction();
  const { toast, showToast } = useToast();
  const catLabel = useCategoryLabel();
  // Construction expense categories come straight from Settings (Materials
  // section) via the scope hook — one source of truth, no inline filtering.
  const { data: constructionCats } = useModuleCategories('construction');

  const [txnDetail, setTxnDetail] = useState<TransactionRow | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<TransactionRow | null>(null);
  const [worker, setWorker] = useState<ProjectLaborerSummary | null>(null);
  const [addWorkerOpen, setAddWorkerOpen] = useState(false);

  // A completed project's construction phase is read-only history.
  const completed = project?.status === 'COMPLETED';

  // Bulk-mark every active worker present today (skips conflicts / no-wage).
  const onMarkAllPresent = () => {
    void runSave(async () => {
      const n = await markAllPresentForProject(projectId, todayISO().slice(0, 10));
      await reload();
      showToast(`${n} · ${t('markAllPresent')}`);
    });
  };

  const catById = useMemo(() => new Map(constructionCats.map((c) => [c.id, c])), [constructionCats]);
  const catNameById = (id: string | null): string => {
    const c = id ? catById.get(id) : undefined;
    return c ? catLabel(c) : '';
  };

  /** Plain expenses edit here; rows linked to labor / POs / transfers are
   *  corrected in their own module, so they get no Edit/Delete footer. */
  const isPlainExpense = (txn: TransactionRow): boolean =>
    txn.direction === 'OUT' && !txn.labor_id && !txn.booking_id && !txn.transfer_id && !txn.udhaar_id;

  const onEditTxn = (txn: TransactionRow) => {
    setTxnDetail(null);
    setEditingTxn(txn);
  };

  const onDeleteTxn = (txn: TransactionRow) => {
    Alert.alert(t('delete'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () =>
          void runSave(async () => {
            await voidTransaction(txn.id);
            setTxnDetail(null);
            await reload();
          }),
      },
    ]);
  };

  const availableLaborers = useMemo(
    () => allLaborers.filter((l) => !workers.some((w) => w.laborer.id === l.id)),
    [allLaborers, workers]
  );

  const ledgerRows: LedgerRow[] = useMemo(
    () =>
      txns.map((txn) => ({
        id: txn.id,
        title: txn.description || catNameById(txn.category_id) || txn.counterparty_name || t('kharcha'),
        date: txn.date,
        amount: txn.amount,
        direction: txn.direction === 'IN' ? ('in' as const) : ('out' as const),
        typeLabel: catNameById(txn.category_id) || undefined,
        onPress: () => setTxnDetail(txn),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txns, catById, t]
  );

  return (
    <View style={styles.screen}>
      <AppHeader title={t('phaseConstruction')} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {/* Hero — the true build cost (cash spend + accrued labor) */}
        <AppCard style={styles.hero}>
          <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
            {t('constructionCost')}
          </AppText>
          <AppText size="display" weight="bold" color="primary" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(summary?.total ?? 0)}
          </AppText>
          <AppText size="sm" weight="semibold" color="textSecondary">
            {`${t('thisMonth')}: ${formatRupees(summary?.thisMonth ?? 0)}`}
          </AppText>
        </AppCard>

        <CategoryBars byCategory={summary?.byCategory ?? []} laborAccrued={summary?.laborAccrued ?? 0} />

        {!completed ? (
          <AppButton label={t('addConstructionExpense')} icon="kharcha" onPress={() => setExpenseOpen(true)} />
        ) : null}

        {/* Labor on THIS project only — the full khata lives in Labor. */}
        <View style={styles.sectionHeader}>
          <AppText size="lg" weight="bold">
            {t('laborTitle')}
          </AppText>
          {!completed ? (
            <View style={styles.headerActions}>
              {workers.length > 0 ? (
                <Pressable onPress={onMarkAllPresent} hitSlop={theme.touch.hitSlop} accessibilityRole="button">
                  <AppText size="sm" weight="semibold" color="accent">
                    {t('markAllPresent')}
                  </AppText>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setAddWorkerOpen(true)} hitSlop={theme.touch.hitSlop} accessibilityRole="button">
                <AppText size="sm" weight="semibold" color="accent">
                  {t('addWorker')}
                </AppText>
              </Pressable>
            </View>
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
            <WorkerCard key={w.projectLaborer.id} worker={w} onPress={completed ? undefined : () => setWorker(w)} />
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

      <AddExpenseSheet
        visible={expenseOpen || !!editingTxn}
        onClose={() => {
          setExpenseOpen(false);
          setEditingTxn(null);
        }}
        projectId={projectId}
        categories={constructionCats}
        accounts={accounts}
        editing={editingTxn}
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
      <TransactionDetailSheet
        txn={txnDetail}
        onClose={() => setTxnDetail(null)}
        footer={
          txnDetail && !completed && isPlainExpense(txnDetail) ? (
            <View style={styles.detailActions}>
              <View style={styles.flex}>
                <AppButton label={t('edit')} icon="edit" variant="secondary" onPress={() => onEditTxn(txnDetail)} />
              </View>
              <View style={styles.flex}>
                <AppButton label={t('delete')} icon="trash" variant="danger" onPress={() => onDeleteTxn(txnDetail)} loading={saving} />
              </View>
            </View>
          ) : undefined
        }
      />

      <Toast message={toast} />
    </View>
  );
}
