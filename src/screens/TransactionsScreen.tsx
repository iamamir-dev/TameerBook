import {
  type RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppButton,
  AppCard,
  AppHeader,
  AppListRow,
  AppText,
  SelectSheet,
  type EntryDirection,
  type SelectOption,
} from '@/components/ui';
import {
  type AccountRow,
  type CategoryRow,
  listAccounts,
  listCategories,
  listDocumentsForType,
  listTransactions,
  type TransactionRow,
  voidTransaction,
} from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatPakistaniGrouping } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type TxnRoute = RouteProp<RootStackParamList, 'Transactions'>;

type Filter = 'all' | 'in' | 'out' | 'month' | 'category';
const FILTERS: { key: Filter; labelKey: TranslationKey }[] = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'in', labelKey: 'filterIn' },
  { key: 'out', labelKey: 'filterOut' },
  { key: 'month', labelKey: 'thisMonth' },
  { key: 'category', labelKey: 'category' },
];

export function TransactionsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { projectId } = useRoute<TxnRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const refreshProjects = useProjectsStore((s) => s.refresh);

  const [txns, setTxns] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [catSheet, setCatSheet] = useState(false);
  const [selected, setSelected] = useState<TransactionRow | null>(null);

  const load = useCallback(async () => {
    const [rows, cats, accts, docs] = await Promise.all([
      listTransactions(projectId),
      listCategories(),
      listAccounts(),
      listDocumentsForType('transaction'),
    ]);
    setTxns(rows);
    setCategories(cats);
    setAccounts(accts);
    const map: Record<string, string> = {};
    for (const d of docs) map[d.entity_id] = d.file_uri;
    setReceipts(map);
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

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
  const filtered = useMemo(() => {
    switch (filter) {
      case 'in':
        return txns.filter((x) => x.direction === 'IN');
      case 'out':
        return txns.filter((x) => x.direction === 'OUT');
      case 'month':
        return txns.filter((x) => x.date.startsWith(ym));
      case 'category':
        return filterCategoryId ? txns.filter((x) => x.category_id === filterCategoryId) : txns;
      default:
        return txns;
    }
  }, [txns, filter, filterCategoryId, ym]);

  const catOptions: SelectOption[] = useMemo(
    () =>
      categories.map((c) => ({
        id: c.id,
        label: language === 'ur' ? c.name_ur : c.name_en,
      })),
    [categories, language]
  );

  const onFix = async () => {
    if (!selected) return;
    const original = selected;
    await voidTransaction(original.id);
    await refreshProjects();
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
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('transactions')} onBack={() => navigation.goBack()} />

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const label =
            f.key === 'category' && filterCategoryId ? catName(filterCategoryId) : t(f.labelKey);
          return (
            <Pressable
              key={f.key}
              onPress={() => (f.key === 'category' ? setCatSheet(true) : setFilter(f.key))}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <AppText size="sm" weight="bold" color={active ? 'onPrimary' : 'textSecondary'}>
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        <AppCard compact>
          {filtered.map((txn, i) => {
            const cat = catName(txn.category_id);
            const dir: EntryDirection = txn.direction === 'IN' ? 'in' : 'out';
            return (
              <View key={txn.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <AppListRow
                  title={cat || (txn.direction === 'IN' ? t('aamdani') : t('kharcha'))}
                  subtitle={`${txn.description ? `${txn.description} · ` : ''}${dayjs(txn.date).format('DD MMM')}`}
                  icon={txn.direction === 'IN' ? 'aamdani' : 'kharcha'}
                  amount={formatPakistaniGrouping(txn.amount)}
                  direction={dir}
                  thumbnail={receipts[txn.id] ? { uri: receipts[txn.id] } : undefined}
                  onPress={() => setSelected(txn)}
                />
              </View>
            );
          })}
          {filtered.length === 0 ? (
            <AppText size="sm" color="textSecondary" center style={styles.emptyText}>
              {t('comingSoon')}
            </AppText>
          ) : null}
        </AppCard>
      </ScrollView>

      {/* Category filter sheet */}
      <SelectSheet
        visible={catSheet}
        onClose={() => setCatSheet(false)}
        options={catOptions}
        selectedId={filterCategoryId ?? undefined}
        title={t('category')}
        onSelect={(o) => {
          setFilterCategoryId(o.id);
          setFilter('category');
        }}
      />

      {/* Transaction detail + fix sheet */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)} />
        {selected ? (
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            <View style={styles.grabber} />
            <AppText size="xxl" weight="bold" tabular color={selected.direction === 'IN' ? 'success' : 'danger'}>
              {selected.direction === 'IN' ? '+ ' : '− '}
              {formatPakistaniGrouping(selected.amount)}
            </AppText>
            <AppText size="md" weight="semibold">
              {catName(selected.category_id) || (selected.direction === 'IN' ? t('aamdani') : t('kharcha'))}
            </AppText>
            {selected.description ? (
              <AppText size="sm" color="textSecondary">
                {selected.description}
              </AppText>
            ) : null}
            <AppText size="sm" color="textSecondary">
              {dayjs(selected.date).format('DD MMM YYYY')}
              {accountName(selected.account_id) ? ` · ${accountName(selected.account_id)}` : ''}
            </AppText>

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
                <AppButton label={t('fixMistake')} icon="tools" variant="danger" onPress={onFix} />
              </View>
            </View>
          </View>
        ) : null}
      </Modal>
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
    content: { paddingHorizontal: theme.spacing.lg },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginLeft: 56 },
    emptyText: { paddingVertical: theme.spacing.xl },
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
