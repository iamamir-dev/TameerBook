import { type RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AmountInput,
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  ICONS,
  LedgerTable,
  SelectSheet,
  type IconKey,
  type LedgerRow,
  type SelectOption,
} from '@/components/ui';
import {
  addLaborer,
  addTransaction,
  attachLaborerToProject,
  getConstructionSummary,
  isInsufficientFunds,
  listAccountsWithBalance,
  listAttendance,
  listCategories,
  listLaborers,
  listMilestones,
  listProjectLaborers,
  listProjectPhaseTransactions,
  markAttendance,
  payLaborer,
  setMilestoneStatus,
  type AccountWithBalance,
  type AttendanceStatus,
  type CategoryRow,
  type ConstructionSummary,
  type LaborAttendanceRow,
  type LaborerRow,
  type MilestoneRow,
  type ProjectLaborerSummary,
  type TransactionRow,
} from '@/db';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatDisplayDate, todayISO } from '@/utils/date';
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

const ATTENDANCE_CHOICES: AttendanceStatus[] = ['FULL', 'HALF', 'ABSENT'];

/**
 * Construction-phase home for a project: the true build cost (cash spend +
 * accrued labor), category breakdown, quick expense entry, the labor khata
 * (attendance + wage balances + payments), milestone progress, and the
 * phase ledger.
 */
export function ConstructionDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
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
  const [msOpen, setMsOpen] = useState(false);
  const [msBusy, setMsBusy] = useState(false);

  // Add-expense sheet
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expAmount, setExpAmount] = useState(0);
  const [expCategoryId, setExpCategoryId] = useState<string | null>(null);
  const [expAccountId, setExpAccountId] = useState<string | null>(null);
  const [expNote, setExpNote] = useState('');
  const [expCatSheet, setExpCatSheet] = useState(false);
  const [expAccountSheet, setExpAccountSheet] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);

  // Worker sheet
  const [worker, setWorker] = useState<ProjectLaborerSummary | null>(null);
  const [attendance, setAttendance] = useState<LaborAttendanceRow[]>([]);
  const [payAmount, setPayAmount] = useState(0);
  const [payAccountId, setPayAccountId] = useState<string | null>(null);
  const [payAccountSheet, setPayAccountSheet] = useState(false);
  const [paying, setPaying] = useState(false);
  const [marking, setMarking] = useState(false);

  // Add-worker sheet
  const [addWorkerOpen, setAddWorkerOpen] = useState(false);
  const [pickLaborerId, setPickLaborerId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newWage, setNewWage] = useState(0);
  const [savingWorker, setSavingWorker] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      loadData().catch(() => undefined);
    }, [loadData])
  );

  const catLabel = useCallback(
    (c: CategoryRow) => (language === 'ur' ? c.name_ur : c.name_en),
    [language]
  );
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

  const categoryOptions: SelectOption[] = useMemo(
    () =>
      constructionCats.map((c) => ({
        id: c.id,
        label: catLabel(c),
        icon: (c.icon && c.icon in ICONS ? c.icon : 'kharcha') as IconKey,
      })),
    [constructionCats, catLabel]
  );

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

  const statusLabel = (s: AttendanceStatus): string =>
    t(s === 'FULL' ? 'attFull' : s === 'HALF' ? 'attHalf' : 'attAbsent');

  /* ------------------------------ add expense ----------------------------- */

  const openExpense = () => {
    setExpAmount(0);
    setExpCategoryId(null);
    setExpNote('');
    if (!expAccountId && accounts.length > 0) setExpAccountId(accounts[0].id);
    setExpenseOpen(true);
  };

  const onSaveExpense = async () => {
    if (expAmount <= 0 || !expAccountId) return;
    setSavingExpense(true);
    try {
      await addTransaction({
        direction: 'OUT',
        amount: expAmount,
        date: today,
        accountId: expAccountId,
        projectId,
        phase: 'CONSTRUCTION',
        categoryId: expCategoryId,
        description: expNote || null,
      });
      setExpenseOpen(false);
      await loadData();
    } catch (e) {
      if (isInsufficientFunds(e)) Alert.alert(t('insufficientFunds'));
      else throw e;
    } finally {
      setSavingExpense(false);
    }
  };

  /* ------------------------------- workers -------------------------------- */

  const openWorker = async (w: ProjectLaborerSummary) => {
    setPayAmount(0);
    setPayAccountId(null);
    setAttendance([]);
    setWorker(w);
    setAttendance(await listAttendance(w.projectLaborer.id));
  };

  const todayStatus = attendance.find((a) => a.date === today)?.status ?? null;

  const onMarkAttendance = async (status: AttendanceStatus) => {
    if (!worker || marking) return;
    setMarking(true);
    try {
      await markAttendance({ projectLaborerId: worker.projectLaborer.id, date: today, status });
      setAttendance(await listAttendance(worker.projectLaborer.id));
      await loadData();
    } finally {
      setMarking(false);
    }
  };

  const onPayWorker = async () => {
    if (!worker || payAmount <= 0 || !payAccountId) return;
    setPaying(true);
    try {
      await payLaborer({
        projectLaborerId: worker.projectLaborer.id,
        amount: payAmount,
        date: today,
        accountId: payAccountId,
      });
      setWorker(null);
      await loadData();
    } catch (e) {
      if (isInsufficientFunds(e)) Alert.alert(t('insufficientFunds'));
      else throw e;
    } finally {
      setPaying(false);
    }
  };

  const openAddWorker = () => {
    setPickLaborerId(null);
    setNewName('');
    setNewPhone('');
    setNewWage(0);
    setAddWorkerOpen(true);
  };

  const availableLaborers = useMemo(
    () => allLaborers.filter((l) => !workers.some((w) => w.laborer.id === l.id)),
    [allLaborers, workers]
  );

  const canSaveWorker = newWage > 0 && (pickLaborerId !== null || newName.trim().length > 0);

  const onSaveWorker = async () => {
    if (!canSaveWorker || savingWorker) return;
    setSavingWorker(true);
    try {
      let laborerId = pickLaborerId;
      if (!laborerId) {
        const created = await addLaborer({
          name: newName.trim(),
          phone: newPhone.trim() || null,
        });
        laborerId = created.id;
      }
      await attachLaborerToProject({ projectId, laborerId, dailyWage: newWage });
      setAddWorkerOpen(false);
      await loadData();
    } finally {
      setSavingWorker(false);
    }
  };

  /* ------------------------------ milestones ------------------------------ */

  const toggleMilestone = async (m: MilestoneRow) => {
    if (msBusy) return;
    setMsBusy(true);
    try {
      const done = m.status === 'DONE';
      await setMilestoneStatus(m.id, done ? 'PENDING' : 'DONE', done ? null : today);
      setMilestones(await listMilestones(projectId));
    } finally {
      setMsBusy(false);
    }
  };

  const msDone = milestones.filter((m) => m.status === 'DONE').length;

  /* -------------------------------- ledger -------------------------------- */

  const ledgerRows: LedgerRow[] = txns.map((txn) => ({
    id: txn.id,
    title: txn.description || catNameById(txn.category_id) || txn.counterparty_name || t('kharcha'),
    date: txn.date,
    amount: txn.amount,
    direction: txn.direction === 'IN' ? 'in' : 'out',
    typeLabel: catNameById(txn.category_id) || undefined,
  }));

  /* ------------------------------ render bits ----------------------------- */

  const byCategory = summary?.byCategory ?? [];
  const laborAccrued = summary?.laborAccrued ?? 0;
  const maxBar = Math.max(laborAccrued, ...byCategory.map((c) => c.total), 1);

  const selectedExpCategory = constructionCats.find((c) => c.id === expCategoryId) ?? null;
  const selectedExpAccount = accounts.find((a) => a.id === expAccountId) ?? null;
  const selectedPayAccount = accounts.find((a) => a.id === payAccountId) ?? null;

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
        {byCategory.length > 0 || laborAccrued > 0 ? (
          <AppCard>
            <AppText size="md" weight="bold" style={styles.cardTitle}>
              {t('topCategories')}
            </AppText>
            {byCategory.map((c) => (
              <View key={c.categoryId} style={styles.barRow}>
                <AppText size="xs" numberOfLines={1} style={styles.barLabel}>
                  {language === 'ur' ? c.nameUr : c.nameEn}
                </AppText>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(c.total / maxBar) * 100}%` }]} />
                </View>
                <AppText size="xs" weight="bold" tabular style={styles.barVal}>
                  {formatRupees(c.total)}
                </AppText>
              </View>
            ))}
            {laborAccrued > 0 ? (
              <View style={styles.barRow}>
                <AppText size="xs" numberOfLines={1} style={styles.barLabel}>
                  {t('laborTitle')}
                </AppText>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(laborAccrued / maxBar) * 100}%` }]} />
                </View>
                <AppText size="xs" weight="bold" tabular style={styles.barVal}>
                  {formatRupees(laborAccrued)}
                </AppText>
              </View>
            ) : null}
          </AppCard>
        ) : null}

        <AppButton label={t('addExpense')} icon="kharcha" onPress={openExpense} />

        {/* Labor section */}
        <View style={styles.sectionHeader}>
          <AppText size="lg" weight="bold">
            {t('laborTitle')}
          </AppText>
          <Pressable onPress={openAddWorker} hitSlop={theme.touch.hitSlop} accessibilityRole="button">
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
            <AppCard key={w.projectLaborer.id} compact onPress={() => openWorker(w).catch(() => undefined)}>
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
        {milestones.length > 0 ? (
          <AppCard compact>
            <Pressable
              onPress={() => setMsOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: msOpen }}
              style={styles.msHeader}
            >
              <AppText size="md" weight="bold" style={styles.flex}>
                {t('milestonesTitle')}
              </AppText>
              <AppText size="xs" weight="bold" color="textSecondary" tabular>
                {msDone}/{milestones.length}
              </AppText>
              <AppIcon name={msOpen ? 'dotCurrent' : 'forward'} size={18} color="textSecondary" />
            </Pressable>
            {msOpen
              ? milestones.map((m) => {
                const done = m.status === 'DONE';
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => toggleMilestone(m).catch(() => undefined)}
                    disabled={msBusy}
                    accessibilityRole="button"
                    accessibilityState={{ checked: done }}
                    accessibilityLabel={`${t('markDone')}: ${m.name}`}
                    style={({ pressed }) => [styles.msRow, pressed && styles.pressed]}
                  >
                    <AppIcon
                      name={done ? 'checkCircle' : 'dotNext'}
                      size={20}
                      color={done ? 'success' : 'textSecondary'}
                    />
                    <AppText size="sm" weight={done ? 'bold' : 'regular'} style={styles.flex} numberOfLines={1}>
                      {m.name}
                    </AppText>
                    <AppText size="xs" color="textSecondary" tabular>
                      {m.pct_weight}%
                    </AppText>
                  </Pressable>
                );
              })
              : null}
          </AppCard>
        ) : null}

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

      {/* ----------------------------- add expense ---------------------------- */}
      <Modal visible={expenseOpen} transparent animationType="fade" onRequestClose={() => setExpenseOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={() => setExpenseOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold">
            {t('addExpense')}
          </AppText>

          {/* Category */}
          <Pressable onPress={() => setExpCatSheet(true)} style={styles.rowChip} accessibilityRole="button">
            <AppIcon name="material" size={18} color="primary" />
            <AppText
              size="sm"
              weight="semibold"
              numberOfLines={1}
              style={styles.flex}
              color={selectedExpCategory ? 'textPrimary' : 'textSecondary'}
            >
              {selectedExpCategory ? catLabel(selectedExpCategory) : t('material')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <AmountInput value={expAmount} onChange={setExpAmount} floating surface={theme.colors.card} />

          {/* Account */}
          <Pressable onPress={() => setExpAccountSheet(true)} style={styles.rowChip} accessibilityRole="button">
            <AppIcon name={selectedExpAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
            <AppText
              size="sm"
              weight="semibold"
              numberOfLines={1}
              style={styles.flex}
              color={selectedExpAccount ? 'textPrimary' : 'textSecondary'}
            >
              {selectedExpAccount
                ? `${selectedExpAccount.name} · ${formatRupees(selectedExpAccount.balance)}`
                : t('selectAccount')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <FloatingLabelInput label={t('note')} value={expNote} onChangeText={setExpNote} />

          <AppButton
            label={t('save')}
            icon="check"
            onPress={() => onSaveExpense().catch(() => undefined)}
            loading={savingExpense}
            disabled={
              expAmount <= 0 ||
              !expAccountId ||
              (!!selectedExpAccount && expAmount > selectedExpAccount.balance)
            }
          />
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ------------------------------- worker ------------------------------- */}
      <Modal visible={worker !== null} transparent animationType="fade" onRequestClose={() => setWorker(null)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={() => setWorker(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold">
            {worker?.laborer.name ?? ''}
          </AppText>
          <AppText size="sm" color="textSecondary">
            {t('dailyWage')}: {formatRupees(worker?.projectLaborer.daily_wage ?? 0)} · {t('wageBalance')}:{' '}
            {formatRupees(worker?.balance.balance ?? 0)}
          </AppText>

          {/* Today's attendance */}
          <AppText size="overline" weight="bold" color="textSecondary" uppercase>
            {t('attendanceTitle')} · {t('today')}
          </AppText>
          <View style={styles.segmentRow}>
            {ATTENDANCE_CHOICES.map((s) => {
              const selected = todayStatus === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => onMarkAttendance(s).catch(() => undefined)}
                  disabled={marking}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.segmentChip, selected && styles.segmentChipActive]}
                >
                  <AppText size="sm" weight="bold" color={selected ? 'accent' : 'textSecondary'}>
                    {statusLabel(s)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {/* Recent attendance */}
          {attendance.slice(0, 7).map((a) => (
            <View key={a.id} style={styles.attRow}>
              <AppText size="xs" color="textSecondary" style={styles.flex}>
                {formatDisplayDate(a.date)}
              </AppText>
              <AppText size="xs" weight="semibold" color={a.status === 'ABSENT' ? 'danger' : 'textPrimary'}>
                {statusLabel(a.status)}
              </AppText>
            </View>
          ))}

          {/* Pay the worker */}
          <AppText size="overline" weight="bold" color="textSecondary" uppercase>
            {t('payWorker')}
          </AppText>
          <AmountInput value={payAmount} onChange={setPayAmount} floating surface={theme.colors.card} />
          <Pressable onPress={() => setPayAccountSheet(true)} style={styles.rowChip} accessibilityRole="button">
            <AppIcon name={selectedPayAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
            <AppText
              size="sm"
              weight="semibold"
              numberOfLines={1}
              style={styles.flex}
              color={selectedPayAccount ? 'textPrimary' : 'textSecondary'}
            >
              {selectedPayAccount
                ? `${selectedPayAccount.name} · ${formatRupees(selectedPayAccount.balance)}`
                : t('selectAccount')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>
          <AppButton
            label={t('payWorker')}
            icon="moneyOut"
            onPress={() => onPayWorker().catch(() => undefined)}
            loading={paying}
            disabled={
              payAmount <= 0 ||
              !payAccountId ||
              (!!selectedPayAccount && payAmount > selectedPayAccount.balance)
            }
          />
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ----------------------------- add worker ----------------------------- */}
      <Modal visible={addWorkerOpen} transparent animationType="fade" onRequestClose={() => setAddWorkerOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={() => setAddWorkerOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold">
            {t('addWorker')}
          </AppText>

          {/* Existing workers not yet on this project */}
          {availableLaborers.length > 0 ? (
            <View style={styles.chipWrap}>
              {availableLaborers.map((l) => {
                const selected = pickLaborerId === l.id;
                return (
                  <Pressable
                    key={l.id}
                    onPress={() => setPickLaborerId(selected ? null : l.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.pillChip, selected && styles.pillChipActive]}
                  >
                    <AppText size="sm" weight="semibold" color={selected ? 'accent' : 'textPrimary'}>
                      {l.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* …or a brand-new worker */}
          {pickLaborerId === null ? (
            <>
              <FloatingLabelInput label={t('workerName')} value={newName} onChangeText={setNewName} />
              <FloatingLabelInput
                label={t('phone')}
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
              />
            </>
          ) : null}

          <AmountInput
            value={newWage}
            onChange={setNewWage}
            label={t('dailyWage')}
            floating
            surface={theme.colors.card}
          />

          <AppButton
            label={t('save')}
            icon="check"
            onPress={() => onSaveWorker().catch(() => undefined)}
            loading={savingWorker}
            disabled={!canSaveWorker}
          />
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ------------------------------- sheets -------------------------------- */}
      <SelectSheet
        visible={expCatSheet}
        onClose={() => setExpCatSheet(false)}
        options={categoryOptions}
        selectedId={expCategoryId ?? undefined}
        title={t('material')}
        onSelect={(o) => setExpCategoryId(o.id)}
      />
      <SelectSheet
        visible={expAccountSheet}
        onClose={() => setExpAccountSheet(false)}
        options={accountOptions}
        selectedId={expAccountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setExpAccountId(o.id)}
      />
      <SelectSheet
        visible={payAccountSheet}
        onClose={() => setPayAccountSheet(false)}
        options={accountOptions}
        selectedId={payAccountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setPayAccountId(o.id)}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    pressed: { opacity: 0.6 },
    /* hero */
    hero: { gap: theme.spacing.xs },
    cardTitle: { marginBottom: theme.spacing.sm },
    /* category bars (matches ReportScreen's expense bars) */
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    barLabel: { width: 84 },
    barTrack: {
      flex: 1,
      height: 8,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
      overflow: 'hidden',
    },
    barFill: { height: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.accent },
    barVal: { width: 84, textAlign: 'right' },
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
    /* milestones */
    msHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.touch.minTarget,
    },
    msRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.touch.minTarget,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    /* attendance segmented control */
    segmentRow: { flexDirection: 'row', gap: theme.spacing.sm },
    segmentChip: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: theme.touch.minTarget,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    segmentChipActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
    attRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    /* add-worker chips */
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    pillChip: {
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
    pillChipActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
    /* generic row chip + bottom sheet (EntryScreen pattern) */
    rowChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      minHeight: theme.touch.minTarget,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.overlay,
    },
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
    grabber: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
    },
  });
