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
import { SellPlotSheet, type SellPlotSheetMode } from '@/components/plot/SellPlotSheet';
import { StageBadge } from '@/components/StageBadge';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import {
  ActionsDrawer,
  AddPhotoTile,
  AddActionButton,
  AmountInput,
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  DateField,
  ICONS,
  LedgerTable,
  ContactRow,
  LoadErrorState,
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
  listStages,
  listUsedPayTypes,
  setPlotStage,
  ONCE_PAY_TYPES,
  getProject,
  listAccountsWithBalance,
  listCategories,
  listDocuments,
  listPlotTransactions,
  PAY_TYPE_LABEL_KEYS,
  PAY_TYPES,
  type PayType,
  type PlotSummary,
  SIZE_UNIT_LABEL_KEYS,
  type StageRow,
  type ProjectRow,
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
import { softToneColor, stageTone, type ColorKey } from '@/utils/tones';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type PlotRoute = RouteProp<RootStackParamList, 'PlotDetail'>;

/** Categories offered in the plot-expense sheet (plot-phase costs). */
/**
 * The core plot experience  the owner's notebook page for one plot:
 * cost summary, seller payments, plot expenses, documents, and the ledger.
 */
export function PlotDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { plotId } = useRoute<PlotRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [summary, setSummary] = useState<PlotSummary | null>(null);
  const [txnDetail, setTxnDetail] = useState<TransactionRow | null>(null);
  const [linkedProject, setLinkedProject] = useState<ProjectRow | null>(null);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [txns, setTxns] = useState<TransactionRow[]>([]);

  // Seller-payment sheet
  const [paySheet, setPaySheet] = useState(false);
  const [usedPayTypes, setUsedPayTypes] = useState<PayType[]>([]);
  const [stages, setStages] = useState<StageRow[]>([]);
  const [stageSheet, setStageSheet] = useState(false);
  const [payType, setPayType] = useState<PayType>('TOKEN');
  const [payAmount, setPayAmount] = useState(0);
  const [payAccountId, setPayAccountId] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(todayISO().slice(0, 10));
  const [payReceiptUri, setPayReceiptUri] = useState<string | null>(null);

  // Expense sheet
  const [expSheet, setExpSheet] = useState(false);
  const [expCategoryId, setExpCategoryId] = useState<string | null>(null);
  const [expAmount, setExpAmount] = useState(0);
  const [expAccountId, setExpAccountId] = useState<string | null>(null);
  const [expDate, setExpDate] = useState(todayISO().slice(0, 10));
  const [expNote, setExpNote] = useState('');
  const [expReceiptUri, setExpReceiptUri] = useState<string | null>(null);

  // Standalone plot sale (set price / receive buyer money)
  const [sellSheet, setSellSheet] = useState<SellPlotSheetMode | null>(null);
  // All money actions live in one bottom drawer (opened from the ledger "+").
  const [actionsOpen, setActionsOpen] = useState(false);

  // Pickers
  const [accountSheetFor, setAccountSheetFor] = useState<'pay' | 'exp' | null>(null);
  const [catSheet, setCatSheet] = useState(false);

  // Full-screen document viewer
  const [viewer, setViewer] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = await getPlotSummary(plotId);
    const [accs, cats, documents, transactions, project, usedPt, stageRows] = await Promise.all([
      listAccountsWithBalance(),
      listCategories(),
      listDocuments('plot', plotId),
      listPlotTransactions(plotId),
      s.plot.project_id ? getProject(s.plot.project_id) : Promise.resolve(null),
      listUsedPayTypes(plotId, 'PLOT', 'OUT'),
      listStages('PLOT'),
    ]);
    setSummary(s);
    setLinkedProject(project);
    setAccounts(accs);
    setCategories(cats);
    setDocs(documents);
    setTxns(transactions);
    setUsedPayTypes(usedPt);
    setStages(stageRows);
  }, [plotId]);

  const { loadFailed, reload } = useFocusReload(load);
  const { saving, run: runSave } = useSaveAction();

  // A one-time pay type (Token/Bayana) already used on this plot is hidden so
  // the user can't pick something that would be rejected on save.
  const availablePayTypes = PAY_TYPES.filter(
    (pt) => !ONCE_PAY_TYPES.includes(pt) || !usedPayTypes.includes(pt)
  );

  const catName = useCategoryLabel();

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Plot-relevant EXPENSE categories only: the "Plot" heading's sub-categories
  // plus stand-alone leaves (no heading). Home/Materials/Labor subs stay on
  // their own pages — Groceries must never show here.
  const expenseCategories = useMemo(() => {
    const parents = new Set(categories.map((c) => c.parent_id).filter(Boolean) as string[]);
    const plotHeadId = categories.find((c) => !c.parent_id && c.name_en === 'Plot')?.id;
    return categories.filter(
      (c) =>
        c.type === 'EXPENSE' &&
        !c.is_system &&
        !parents.has(c.id) &&
        (c.parent_id === plotHeadId || c.parent_id === null)
    );
  }, [categories]);

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
          onPress: () => setTxnDetail(txn),
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
        date: payDate,
        accountId: payAccountId,
        receiptUri: payReceiptUri,
      });
    });
    if (!ok) return;
    setPaySheet(false);
    setPayAmount(0);
    setPayDate(todayISO().slice(0, 10));
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
        date: expDate,
        accountId: expAccountId,
        note: expNote.trim() || null,
        receiptUri: expReceiptUri,
      });
    });
    if (!ok) return;
    setExpSheet(false);
    setExpAmount(0);
    setExpDate(todayISO().slice(0, 10));
    setExpNote('');
    setExpCategoryId(null);
    setExpReceiptUri(null);
    await reload();
  };

  const onAddDocument = async () => {
    const uri = await pickDocumentImage();
    if (!uri) return;
    await runSave(async () => {
      await addDocument({ entityType: 'plot', entityId: plotId, label: 'docOther', fileUri: uri });
      setDocs(await listDocuments('plot', plotId));
    });
  };

  if (!summary) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('plotLabel')} onBack={() => navigation.goBack()} />
        {loadFailed ? <LoadErrorState onRetry={() => void reload()} /> : null}
      </View>
    );
  }

  const { plot, dealPrice, paidToSeller, remaining, expenses, totalCost } = summary;
  const { salePrice, saleReceived, saleOutstanding, saleProfit } = summary;
  const sizeText = plot.size_value
    ? `${plot.size_value} ${t(SIZE_UNIT_LABEL_KEYS[plot.size_unit ?? 'MARLA'])}`
    : null;
  const location = [plot.society, plot.block, plot.plot_no, sizeText].filter(Boolean).join(' · ');
  const sold = plot.status === 'SOLD';
  // No mutating actions on a sold plot or one inside a completed project.
  const readOnly = sold || linkedProject?.status === 'COMPLETED';

  return (
    <View style={styles.screen}>
      <AppHeader
        title={plot.name}
        onBack={() => navigation.goBack()}
        rightAction={
          readOnly
            ? undefined
            : {
                icon: 'edit',
                onPress: () => navigation.navigate('EditPlot', { plotId: plot.id }),
                accessibilityLabel: t('editPlot'),
              }
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {/* Summary hero  the owner's card math */}
        <AppCard style={styles.hero}>
          {sold ? (
            <View style={styles.badgeRow}>
              <StageBadge tone="gold" label={t('plotSold')} />
            </View>
          ) : null}
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
          {(() => {
            const st = stages.find((x) => x.id === plot.stage_id);
            const tone: ColorKey = st ? stageTone(st) : 'accent';
            return (
              <Pressable
                onPress={() => !readOnly && setStageSheet(true)}
                accessibilityRole="button"
                style={[styles.stagePill, { backgroundColor: softToneColor(theme, tone) }]}
              >
                <AppIcon name="tag" size={14} color={tone} />
                <AppText size="xs" weight="bold" color={tone}>
                  {st ? (language === 'ur' ? st.name_ur : st.name_en) : t('setStatusLabel')}
                </AppText>
              </Pressable>
            );
          })()}
          <View style={styles.divider} />
          <SummaryRow label={t('dealPrice')} value={formatRupees(dealPrice)} />
          <SummaryRow label={t('paidToSeller')} value={formatRupees(paidToSeller)} valueColor="danger" />
          <SummaryRow label={t('remaining')} value={formatRupees(remaining)} />
          <SummaryRow label={t('plotExpensesLabel')} value={formatRupees(expenses)} valueColor="danger" />

          {/* Linked project — a row inside the hero, not its own card. */}
          {plot.project_id ? (
            <>
              <View style={styles.divider} />
              <Pressable
                onPress={() => navigation.navigate('ProjectDetail', { projectId: plot.project_id! })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.linkRow, pressed && styles.pressedDim]}
              >
                <AppIcon name="project" size={20} color="primary" />
                <AppText size="sm" weight="bold" style={styles.flex} numberOfLines={1}>
                  {linkedProject?.name ?? t('plotInProject')}
                </AppText>
                <AppIcon name="forward" size={18} color="textSecondary" />
              </Pressable>
            </>
          ) : null}
        </AppCard>

        {/* Seller — its own compact card so the hero stays pure money math. */}
        {plot.seller_name || plot.seller_phone ? (
          <AppCard compact>
            <AppText size="overline" weight="bold" color="textSecondary" uppercase>
              {t('seller')}
            </AppText>
            {plot.seller_name ? (
              <AppText size="sm" weight="semibold" numberOfLines={1}>
                {plot.seller_name}
              </AppText>
            ) : null}
            <ContactRow phone={plot.seller_phone} />
          </AppCard>
        ) : null}

        {/* Standalone sale summary (actions live in the ledger "+" drawer). */}
        {!plot.project_id && salePrice > 0 ? (
          <AppCard style={styles.hero}>
            <View style={styles.saleHeader}>
              <AppText size="overline" weight="bold" color="textSecondary" uppercase style={styles.flex}>
                {t('sellPlot')}
              </AppText>
              {sold ? <StageBadge tone="gold" label={t('plotSold')} /> : null}
            </View>
            {plot.buyer_name ? (
              <AppText size="sm" color="textSecondary" numberOfLines={1}>
                {`${t('buyerName')}: ${plot.buyer_name}`}
              </AppText>
            ) : null}
            <SummaryRow label={t('salePriceLabel')} value={formatRupees(salePrice)} />
            <SummaryRow label={t('buyerReceipts')} value={formatRupees(saleReceived)} valueColor="success" />
            <SummaryRow label={t('remaining')} value={formatRupees(saleOutstanding)} />
            <View style={styles.divider} />
            <SummaryRow
              label={t('plotProfit')}
              value={formatRupees(saleProfit)}
              valueColor={saleProfit >= 0 ? 'success' : 'danger'}
            />
            {!sold ? (
              <AppButton
                label={t('addReceipt')}
                icon="moneyIn"
                onPress={() => setSellSheet('receipt')}
              />
            ) : null}
          </AppCard>
        ) : null}

        {/* Ledger — the "+" opens the actions drawer. */}
        <View style={styles.sectionHeader}>
          <AppText size="lg" weight="bold" style={styles.flex}>
            {t('transactions')}
          </AppText>
          {!readOnly ? (
            <AddActionButton onPress={() => setActionsOpen(true)} accessibilityLabel={t('addPayment')} />
          ) : null}
        </View>
        <AppCard compact>
          <LedgerTable rows={ledgerRows} emptyText={t('addFirstEntry')} />
        </AppCard>

        {/* Documents — the dashed tile IS the add button (same UI as photos). */}
        <AppText size="lg" weight="bold">
          {t('tabDocs')}
        </AppText>
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
          {!readOnly ? (
            <AddPhotoTile label={t('addDocument')} onPress={onAddDocument} style={styles.docAdd} />
          ) : null}
        </View>
      </ScrollView>

      {/* Actions drawer — pay seller / expense / sell / receipt in one sheet. */}
      <ActionsDrawer
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={plot.name}
        actions={[
          {
            icon: 'rupee' as const,
            label: t('sellerPayment'),
            onPress: () => {
              setPayType(availablePayTypes[0] ?? 'INSTALLMENT');
              setPaySheet(true);
            },
          },
          { icon: 'kharcha' as const, label: t('addExpense'), onPress: () => setExpSheet(true) },
          ...(!plot.project_id && salePrice <= 0
            ? [{ icon: 'tag' as const, label: t('sellPlot'), onPress: () => setSellSheet('price') }]
            : []),
          ...(!plot.project_id && salePrice > 0 && !sold
            ? [{ icon: 'moneyIn' as const, label: t('addReceipt'), onPress: () => setSellSheet('receipt') }]
            : []),
        ]}
      />

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
            {availablePayTypes.map((pt) => {
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

          <AmountInput
            value={payAmount}
            onChange={setPayAmount}
            floating
            surface={theme.colors.card}
            error={
              payAmount <= 0
                ? null
                : payAmount > remaining
                  ? t('exceedsRemaining')
                  : payAccount && payAmount > payAccount.balance
                    ? t('insufficientFunds')
                    : null
            }
          />

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

          <DateField value={payDate} onChange={setPayDate} />

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

          <AmountInput
            value={expAmount}
            onChange={setExpAmount}
            floating
            surface={theme.colors.card}
            error={expAmount > 0 && expAccount && expAmount > expAccount.balance ? t('insufficientFunds') : null}
          />

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

          <DateField value={expDate} onChange={setExpDate} />

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
      <SelectSheet
        visible={stageSheet}
        onClose={() => setStageSheet(false)}
        title={t('setStatusLabel')}
        searchable={false}
        selectedId={summary?.plot.stage_id ?? '__none__'}
        options={[
          { id: '__none__', label: t('noStatus') },
          ...stages.map((st) => ({
            id: st.id,
            label: language === 'ur' ? st.name_ur : st.name_en,
            dotColor: theme.colors[stageTone(st)],
          })),
        ]}
        onSelect={(o) => {
          setStageSheet(false);
          void (async () => {
            const ok = await runSave(() => setPlotStage(plotId, o.id === '__none__' ? null : o.id));
            if (ok) await reload();
          })();
        }}
      />

      {/* Standalone plot sale: set the price, then receive buyer money. */}
      {!plot.project_id ? (
        <SellPlotSheet
          visible={sellSheet !== null}
          mode={sellSheet ?? 'price'}
          onClose={() => setSellSheet(null)}
          summary={summary}
          accounts={accounts}
          onSaved={reload}
        />
      ) : null}

      {/* Full-screen document viewer */}
      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          {viewer ? <Image source={{ uri: viewer }} style={styles.viewerImage} resizeMode="contain" /> : null}
          <Pressable onPress={() => setViewer(null)} accessibilityRole="button" style={styles.viewerClose}>
            <AppIcon name="close" size={28} color="onHero" />
          </Pressable>
        </View>
      </Modal>
      <TransactionDetailSheet txn={txnDetail} onClose={() => setTxnDetail(null)} />
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
    stagePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: theme.colors.accentSoft,
      marginTop: 4,
    },
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    hero: { gap: theme.spacing.xs },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      marginVertical: theme.spacing.sm,
    },
    sellerPhoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.xs,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    actionsRow: { flexDirection: 'row', gap: theme.spacing.sm },
    badgeRow: { flexDirection: 'row' },
    saleHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
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
      minHeight: theme.touch.minTarget,
    },
    docGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    docAdd: { width: 84, height: 84 },
    pressedDim: { opacity: 0.7 },
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
