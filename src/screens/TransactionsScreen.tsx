import {
  type RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import {
  AppButton,
  AppCard,
  AppHeader,
  AppText,
  LedgerTable,
  SelectSheet,
  type LedgerRow,
  type SelectOption,
} from '@/components/ui';
import {
  type AccountRow,
  type CategoryRow,
  listAccounts,
  listCategories,
  listAllCompanyTransactions,
  listDocumentsForType,
  listProjects,
  listTransactions,
  type ProjectRow,
  type TransactionRow,
  voidTransaction,
} from '@/db';
import { useFocusReload, useSaveAction } from '@/hooks';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatPakistaniGrouping } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type TxnRoute = RouteProp<RootStackParamList, 'Transactions'>;

/** One combinable filter chip — active shows its value, tap again clears. */
function FilterChip({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <AppText size="sm" weight="bold" color={active ? 'onPrimary' : 'textSecondary'} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function TransactionsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const params = useRoute<TxnRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const { saving, run: runSave } = useSaveAction();

  const [txns, setTxns] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  // Independent filter dimensions (each combinable, each clearable).
  const [direction, setDirection] = useState<'all' | 'in' | 'out'>('all');
  const [monthOnly, setMonthOnly] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  // Context filters arrive pre-applied from the caller (account page, project
  // page…) — shown as active chips the user can clear like any other filter.
  const [filterAccountId, setFilterAccountId] = useState<string | null>(params?.accountId ?? null);
  const [filterProjectId, setFilterProjectId] = useState<string | null>(params?.projectId ?? null);
  const [catSheet, setCatSheet] = useState(false);
  const [accSheet, setAccSheet] = useState(false);
  const [projSheet, setProjSheet] = useState(false);
  const [selected, setSelected] = useState<TransactionRow | null>(null);

  const load = useCallback(async () => {
    const [rows, cats, accts, projs, docs] = await Promise.all([
      listAllCompanyTransactions(),
      listCategories(),
      listAccounts(),
      listProjects(),
      listDocumentsForType('transaction'),
    ]);
    setTxns(rows);
    setCategories(cats);
    setAccounts(accts);
    setProjects(projs);
    const map: Record<string, string> = {};
    for (const d of docs) map[d.entity_id] = d.file_uri;
    setReceipts(map);
  }, []);

  useFocusReload(load);

  const catName = useCallback(
    (id: string | null) => {
      if (!id) return '';
      const c = categories.find((x) => x.id === id);
      return c ? (language === 'ur' ? c.name_ur : c.name_en) : '';
    },
    [categories, language]
  );

  const accountName = useCallback(
    (id: string | null) => {
      if (!id) return '';
      return accounts.find((a) => a.id === id)?.name ?? '';
    },
    [accounts]
  );

  const ym = todayISO().slice(0, 7);
  // ALL active dimensions apply together (repo rows are already date DESC).
  const filtered = useMemo(
    () =>
      txns.filter(
        (x) =>
          (direction === 'all' || x.direction === (direction === 'in' ? 'IN' : 'OUT')) &&
          (!monthOnly || x.date.startsWith(ym)) &&
          (!filterCategoryId || x.category_id === filterCategoryId) &&
          (!filterAccountId || x.account_id === filterAccountId) &&
          (!filterProjectId || x.project_id === filterProjectId)
      ),
    [txns, direction, monthOnly, filterCategoryId, filterAccountId, filterProjectId, ym]
  );

  // Group by day, newest first — "Today", "Yesterday", then dates.
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

  const dayLabel = useCallback(
    (day: string) => {
      const today = todayISO().slice(0, 10);
      if (day === today) return t('today');
      if (day === dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')) return t('yesterday');
      return dayjs(day).format('DD MMM YYYY');
    },
    [t]
  );

  const projectName = useCallback(
    (id: string | null) => (id ? projects.find((p) => p.id === id)?.name ?? '' : ''),
    [projects]
  );

  const catOptions: SelectOption[] = useMemo(
    () =>
      categories.map((c) => ({
        id: c.id,
        label: language === 'ur' ? c.name_ur : c.name_en,
      })),
    [categories, language]
  );

  const onFix = () => {
    if (!selected) return;
    const original = selected;
    Alert.alert(t('fixMistakeConfirmTitle'), t('fixMistakeExplain'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('fixMistake'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const ok = await runSave(async () => {
              await voidTransaction(original.id);
            });
            if (!ok) return;
            setSelected(null);
            navigation.navigate('Entry', {
              direction: original.direction,
              prefill: {
                amount: original.amount,
                categoryId: original.category_id,
                note: original.description ?? undefined,
                accountId: original.account_id ?? undefined,
                projectId: original.project_id ?? undefined,
                partyId: original.party_id,
              },
            });
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('transactions')} onBack={() => navigation.goBack()} />

      {/* Filter chips — each dimension is independent and combinable. An
          active picker chip shows its value; tap again to clear it. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filters}
      >
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
        <FilterChip
          label={t('thisMonth')}
          active={monthOnly}
          onPress={() => setMonthOnly((v) => !v)}
          styles={styles}
        />
        <FilterChip
          label={filterAccountId ? accountName(filterAccountId) : t('selectAccount')}
          active={!!filterAccountId}
          onPress={() => (filterAccountId ? setFilterAccountId(null) : setAccSheet(true))}
          styles={styles}
        />
        <FilterChip
          label={filterProjectId ? projectName(filterProjectId) : t('selectProject')}
          active={!!filterProjectId}
          onPress={() => (filterProjectId ? setFilterProjectId(null) : setProjSheet(true))}
          styles={styles}
        />
        <FilterChip
          label={filterCategoryId ? catName(filterCategoryId) : t('category')}
          active={!!filterCategoryId}
          onPress={() => (filterCategoryId ? setFilterCategoryId(null) : setCatSheet(true))}
          styles={styles}
        />
      </ScrollView>

      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {grouped.map((g) => {
          // Same notebook ledger the Home feed uses — simple and familiar.
          const rows: LedgerRow[] = g.rows.map((txn) => ({
            id: txn.id,
            title:
              txn.description ||
              catName(txn.category_id) ||
              txn.counterparty_name ||
              (txn.direction === 'IN' ? t('aamdani') : t('kharcha')),
            date: txn.date,
            amount: txn.amount,
            direction: txn.direction === 'IN' ? ('in' as const) : ('out' as const),
            typeLabel: catName(txn.category_id) || undefined,
            onPress: () => setSelected(txn),
          }));
          return (
            <View key={g.date} style={styles.daySection}>
              <AppText size="xs" weight="bold" color="textSecondary" uppercase style={styles.dayHeader}>
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
      </ScrollView>

      {/* Category filter sheet */}
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

      {/* Shared transaction detail sheet + the fix-mistake action */}
      <TransactionDetailSheet
        txn={selected}
        onClose={() => setSelected(null)}
        footer={
          <>
            <View style={styles.fixExplain}>
              <AppText size="xs" color="textSecondary">
                {t('fixMistakeExplain')}
              </AppText>
            </View>
            <View style={styles.sheetButtons}>
              <View style={styles.sheetBtn}>
                <AppButton label={t('cancel')} variant="secondary" onPress={() => setSelected(null)} />
              </View>
              <View style={styles.sheetBtn}>
                <AppButton label={t('fixMistake')} icon="tools" variant="danger" loading={saving} onPress={onFix} />
              </View>
            </View>
          </>
        }
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    // flexGrow:0 stops the horizontal bar from stretching to fill the column.
    filterBar: { flexGrow: 0 },
    filters: {
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
      alignItems: 'center',
    },
    chip: {
      minHeight: 40,
      paddingHorizontal: theme.spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.card,
    },
    chipActive: { backgroundColor: theme.colors.primary },
    segment: {
      flexDirection: 'row',
      padding: 3,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.card,
    },
    segBtn: {
      paddingHorizontal: theme.spacing.md,
      minHeight: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.pill,
    },
    segBtnActive: { backgroundColor: theme.colors.primary },
    content: { paddingHorizontal: theme.spacing.lg },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginLeft: 56 },
    emptyText: { paddingVertical: theme.spacing.xl },
    daySection: { marginBottom: theme.spacing.md, gap: theme.spacing.xs },
    dayHeader: { marginLeft: theme.spacing.xs },
    receiptImage: {
      width: '100%',
      height: 200,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.track,
      marginTop: theme.spacing.sm,
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
      gap: theme.spacing.sm,
      ...theme.shadows.raised,
    },
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track, marginBottom: theme.spacing.sm },
    fixExplain: {
      backgroundColor: theme.colors.dangerSoft,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginTop: theme.spacing.sm,
    },
    sheetButtons: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.xs },
    sheetBtn: { flex: 1 },
  });
