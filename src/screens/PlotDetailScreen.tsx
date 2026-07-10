import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
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
  type AccountWithBalance,
  addDocument,
  addPlotExpense,
  addPlotPayment,
  type CategoryRow,
  type DocumentRow,
  getPlotSummary,
  listAccountsWithBalance,
  listCategories,
  listDocuments,
  listPlotTransactions,
  PAY_TYPE_LABEL_KEYS,
  PAY_TYPES,
  type PayType,
  type PlotSummary,
  type TransactionRow,
} from '@/db';
import { useAccountOptions, useCategoryLabel, useFocusReload, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';
import { captureReceipt, pickDocumentImage } from '@/utils/photo';
import type { ColorKey } from '@/utils/tones';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type PlotRoute = RouteProp<RootStackParamList, 'PlotDetail'>;

/** Categories offered in the plot-expense sheet (plot-phase costs). */
const PLOT_EXPENSE_CATEGORIES = new Set([
  'Transfer Fees & Tax',
  'Naqsha/Approval',
  'Utilities',
  'Misc',
]);

/**
 * The core plot experience  the owner's notebook page for one plot:
 * cost summary, seller payments, plot expenses, documents, and the ledger.
 */
export function PlotDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { plotId } = useRoute<PlotRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [summary, setSummary] = useState<PlotSummary | null>(null);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [txns, setTxns] = useState<TransactionRow[]>([]);

  // Seller-payment sheet
  const [paySheet, setPaySheet] = useState(false);
  const [payType, setPayType] = useState<PayType>('TOKEN');
  const [payAmount, setPayAmount] = useState(0);
  const [payAccountId, setPayAccountId] = useState<string | null>(null);
  const [payReceiptUri, setPayReceiptUri] = useState<string | null>(null);

  // Expense sheet
  const [expSheet, setExpSheet] = useState(false);
  const [expCategoryId, setExpCategoryId] = useState<string | null>(null);
  const [expAmount, setExpAmount] = useState(0);
  const [expAccountId, setExpAccountId] = useState<string | null>(null);
  const [expNote, setExpNote] = useState('');
  const [expReceiptUri, setExpReceiptUri] = useState<string | null>(null);

  // Pickers
  const [accountSheetFor, setAccountSheetFor] = useState<'pay' | 'exp' | null>(null);
  const [catSheet, setCatSheet] = useState(false);

  // Full-screen document viewer
  const [viewer, setViewer] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, accs, cats, documents, transactions] = await Promise.all([
      getPlotSummary(plotId),
      listAccountsWithBalance(),
      listCategories(),
      listDocuments('plot', plotId),
      listPlotTransactions(plotId),
    ]);
    setSummary(s);
    setAccounts(accs);
    setCategories(cats);
    setDocs(documents);
    setTxns(transactions);
  }, [plotId]);

  const { reload } = useFocusReload(load);
  const { saving, run: runSave } = useSaveAction();

  const catName = useCategoryLabel();

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'EXPENSE' && PLOT_EXPENSE_CATEGORIES.has(c.name_en)),
    [categories]
  );

  const accountOptions = useAccountOptions(accounts);

  const categoryOptions: SelectOption[] = useMemo(
    () =>
      expenseCategories.map((c) => ({
        id: c.id,
        label: catName(c),
        icon: (c.icon && c.icon in ICONS ? c.icon : 'kharcha') as IconKey,
      })),
    [expenseCategories, catName]
  );

  const ledgerRows: LedgerRow[] = useMemo(
    () =>
      txns.map((txn) => {
        const cat = txn.category_id ? catById.get(txn.category_id) : undefined;
        const payLabel = txn.pay_type ? t(PAY_TYPE_LABEL_KEYS[txn.pay_type]) : undefined;
        return {
          id: txn.id,
          title: txn.description || payLabel || (cat ? catName(cat) : t('transactions')),
          date: txn.date,
          amount: txn.amount,
          direction: 'out' as const,
          typeLabel: payLabel ?? (cat ? catName(cat) : undefined),
        };
      }),
    [txns, catById, catName, t]
  );

  const payAccount = accounts.find((a) => a.id === payAccountId) ?? null;
  const expAccount = accounts.find((a) => a.id === expAccountId) ?? null;
  const expCategory = expenseCategories.find((c) => c.id === expCategoryId) ?? null;

  const onSavePayment = async () => {
    if (payAmount <= 0 || !payAccountId || saving) return;
    const ok = await runSave(async () => {
      await addPlotPayment({
        plotId,
        payType,
        amount: payAmount,
        date: todayISO().slice(0, 10),
        accountId: payAccountId,
        receiptUri: payReceiptUri,
      });
    });
    if (!ok) return;
    setPaySheet(false);
    setPayAmount(0);
    setPayReceiptUri(null);
    await reload();
  };

  const onSaveExpense = async () => {
    if (expAmount <= 0 || !expAccountId || !expCategoryId || saving) return;
    const ok = await runSave(async () => {
      await addPlotExpense({
        plotId,
        categoryId: expCategoryId,
        amount: expAmount,
        date: todayISO().slice(0, 10),
        accountId: expAccountId,
        note: expNote.trim() || null,
        receiptUri: expReceiptUri,
      });
    });
    if (!ok) return;
    setExpSheet(false);
    setExpAmount(0);
    setExpNote('');
    setExpCategoryId(null);
    setExpReceiptUri(null);
    await reload();
  };

  const onAddDocument = async () => {
    const uri = await pickDocumentImage();
    if (!uri) return;
    await addDocument({ entityType: 'plot', entityId: plotId, label: 'docOther', fileUri: uri });
    setDocs(await listDocuments('plot', plotId));
  };

  if (!summary) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('plotLabel')} onBack={() => navigation.goBack()} />
      </View>
    );
  }

  const { plot, dealPrice, paidToSeller, remaining, expenses, totalCost } = summary;
  const location = [plot.society, plot.block, plot.plot_no].filter(Boolean).join(' · ');

  return (
    <View style={styles.screen}>
      <AppHeader title={plot.name} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {/* Summary hero  the owner's card math */}
        <AppCard style={styles.hero}>
          <AppText size="overline" weight="bold" color="textSecondary" uppercase>
            {t('totalCostLabel')}
          </AppText>
          <AppText size="display" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(totalCost)}
          </AppText>
          {location ? (
            <AppText size="sm" color="textSecondary" numberOfLines={1}>
              {location}
            </AppText>
          ) : null}
          <View style={styles.divider} />
          <SummaryRow label={t('dealPrice')} value={formatRupees(dealPrice)} />
          <SummaryRow label={t('paidToSeller')} value={formatRupees(paidToSeller)} valueColor="success" />
          <SummaryRow label={t('remaining')} value={formatRupees(remaining)} />
          <SummaryRow label={t('plotExpensesLabel')} value={formatRupees(expenses)} />
        </AppCard>

        {/* Primary actions */}
        <View style={styles.actionsRow}>
          <View style={styles.flex}>
            <AppButton label={t('sellerPayment')} icon="rupee" onPress={() => setPaySheet(true)} />
          </View>
          <View style={styles.flex}>
            <AppButton
              label={t('addExpense')}
              icon="kharcha"
              variant="secondary"
              onPress={() => setExpSheet(true)}
            />
          </View>
        </View>

        {/* Linked project */}
        {plot.project_id ? (
          <AppCard
            compact
            onPress={() => navigation.navigate('ProjectDetail', { projectId: plot.project_id! })}
          >
            <View style={styles.linkRow}>
              <AppIcon name="project" size={20} color="primary" />
              <AppText size="sm" weight="bold" style={styles.flex} numberOfLines={1}>
                {t('plotInProject')}
              </AppText>
              <AppIcon name="forward" size={18} color="textSecondary" />
            </View>
          </AppCard>
        ) : null}

        {/* Documents */}
        <View style={styles.sectionHeader}>
          <AppText size="lg" weight="bold" style={styles.flex}>
            {t('tabDocs')}
          </AppText>
          <Pressable onPress={onAddDocument} accessibilityRole="button" style={styles.addChip}>
            <AppIcon name="add" size={16} color="primary" />
            <AppText size="xs" weight="bold" color="primary">
              {t('addDocument')}
            </AppText>
          </Pressable>
        </View>
        {docs.length === 0 ? (
          <AppText size="sm" color="textSecondary">
            {t('noDocs')}
          </AppText>
        ) : (
          <View style={styles.docGrid}>
            {docs.map((d) => (
              <Pressable
                key={d.id}
                onPress={() => setViewer(d.file_uri)}
                accessibilityRole="button"
              >
                <Image source={{ uri: d.file_uri }} style={styles.docThumb} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Ledger */}
        <AppText size="lg" weight="bold">
          {t('transactions')}
        </AppText>
        <AppCard compact>
          <LedgerTable rows={ledgerRows} emptyText={t('addFirstEntry')} />
        </AppCard>
      </ScrollView>

      {/* Seller-payment sheet */}
      <Modal visible={paySheet} transparent animationType="fade" onRequestClose={() => setPaySheet(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={() => setPaySheet(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold">
            {t('sellerPayment')}
          </AppText>

          <View style={styles.chipRow}>
            {PAY_TYPES.map((pt) => {
              const selected = pt === payType;
              return (
                <Pressable
                  key={pt}
                  onPress={() => setPayType(pt)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.modeBtn, selected && styles.modeBtnActive]}
                >
                  <AppText size="sm" weight={selected ? 'bold' : 'semibold'} color={selected ? 'accent' : 'textSecondary'}>
                    {t(PAY_TYPE_LABEL_KEYS[pt])}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <AmountInput value={payAmount} onChange={setPayAmount} floating surface={theme.colors.card} />

          <Pressable onPress={() => setAccountSheetFor('pay')} style={styles.rowChip} accessibilityRole="button">
            <AppIcon name={payAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
            <AppText
              size="sm"
              weight="semibold"
              numberOfLines={1}
              style={styles.flex}
              color={payAccount ? 'textPrimary' : 'textSecondary'}
            >
              {payAccount ? `${payAccount.name} · ${formatRupees(payAccount.balance)}` : t('selectAccount')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          {payReceiptUri ? (
            <Pressable onPress={() => setPayReceiptUri(null)} style={styles.receiptRow} accessibilityRole="button">
              <Image source={{ uri: payReceiptUri }} style={styles.receiptThumb} />
              <AppText size="sm" weight="semibold" style={styles.flex}>
                {t('photoReceipt')}
              </AppText>
              <AppIcon name="close" size={20} color="danger" />
            </Pressable>
          ) : (
            <AppButton
              label={t('photoReceipt')}
              icon="camera"
              variant="secondary"
              onPress={async () => {
                const uri = await captureReceipt();
                if (uri) setPayReceiptUri(uri);
              }}
            />
          )}

          <AppButton
            label={t('save')}
            icon="check"
            onPress={onSavePayment}
            loading={saving}
            disabled={
              payAmount <= 0 ||
              !payAccountId ||
              (!!payAccount && payAmount > payAccount.balance) ||
              (!!summary && payAmount > summary.remaining)
            }
          />
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Expense sheet */}
      <Modal visible={expSheet} transparent animationType="fade" onRequestClose={() => setExpSheet(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={() => setExpSheet(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold">
            {t('addExpense')}
          </AppText>

          <Pressable onPress={() => setCatSheet(true)} style={styles.rowChip} accessibilityRole="button">
            <AppIcon name="kharcha" size={18} color="primary" />
            <AppText
              size="sm"
              weight="semibold"
              numberOfLines={1}
              style={styles.flex}
              color={expCategory ? 'textPrimary' : 'textSecondary'}
            >
              {expCategory ? catName(expCategory) : t('category')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <AmountInput value={expAmount} onChange={setExpAmount} floating surface={theme.colors.card} />

          <Pressable onPress={() => setAccountSheetFor('exp')} style={styles.rowChip} accessibilityRole="button">
            <AppIcon name={expAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
            <AppText
              size="sm"
              weight="semibold"
              numberOfLines={1}
              style={styles.flex}
              color={expAccount ? 'textPrimary' : 'textSecondary'}
            >
              {expAccount ? `${expAccount.name} · ${formatRupees(expAccount.balance)}` : t('selectAccount')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <FloatingLabelInput label={t('note')} value={expNote} onChangeText={setExpNote} />

          {expReceiptUri ? (
            <Pressable onPress={() => setExpReceiptUri(null)} style={styles.receiptRow} accessibilityRole="button">
              <Image source={{ uri: expReceiptUri }} style={styles.receiptThumb} />
              <AppText size="sm" weight="semibold" style={styles.flex}>
                {t('photoReceipt')}
              </AppText>
              <AppIcon name="close" size={20} color="danger" />
            </Pressable>
          ) : (
            <AppButton
              label={t('photoReceipt')}
              icon="camera"
              variant="secondary"
              onPress={async () => {
                const uri = await captureReceipt();
                if (uri) setExpReceiptUri(uri);
              }}
            />
          )}

          <AppButton
            label={t('save')}
            icon="check"
            onPress={onSaveExpense}
            loading={saving}
            disabled={
              expAmount <= 0 ||
              !expAccountId ||
              !expCategoryId ||
              (!!expAccount && expAmount > expAccount.balance)
            }
          />
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Pickers */}
      <SelectSheet
        visible={accountSheetFor !== null}
        onClose={() => setAccountSheetFor(null)}
        options={accountOptions}
        selectedId={(accountSheetFor === 'pay' ? payAccountId : expAccountId) ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => {
          if (accountSheetFor === 'pay') setPayAccountId(o.id);
          else setExpAccountId(o.id);
        }}
      />
      <SelectSheet
        visible={catSheet}
        onClose={() => setCatSheet(false)}
        options={categoryOptions}
        selectedId={expCategoryId ?? undefined}
        title={t('category')}
        searchable={false}
        onSelect={(o) => setExpCategoryId(o.id)}
      />

      {/* Full-screen document viewer */}
      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          {viewer ? <Image source={{ uri: viewer }} style={styles.viewerImage} resizeMode="contain" /> : null}
          <Pressable onPress={() => setViewer(null)} accessibilityRole="button" style={styles.viewerClose}>
            <AppIcon name="close" size={28} color="onHero" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  valueColor = 'textPrimary',
}: {
  label: string;
  value: string;
  valueColor?: ColorKey;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.summaryRow}>
      <AppText size="sm" color="textSecondary">
        {label}
      </AppText>
      <AppText size="sm" weight="semibold" color={valueColor} tabular>
        {value}
      </AppText>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    hero: { gap: theme.spacing.xs },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      marginVertical: theme.spacing.sm,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    actionsRow: { flexDirection: 'row', gap: theme.spacing.sm },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    addChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      minHeight: 32,
    },
    docGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    docThumb: {
      width: 84,
      height: 84,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.track,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    modeBtn: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    modeBtnActive: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accentSoft,
    },
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
    receiptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      padding: theme.spacing.sm,
    },
    receiptThumb: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.track,
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
    viewer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewerImage: { width: '100%', height: '80%' },
    viewerClose: {
      position: 'absolute',
      top: theme.spacing.xxxl,
      right: theme.spacing.lg,
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
