import {
  type RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import {
  ActionsDrawer,
  AddActionButton,
  AmountInput,
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  DateField,
  LedgerTable,
  SelectSheet,
  type LedgerRow,
} from '@/components/ui';
import {
  addSaleCost,
  addSaleReceipt,
  getProject,
  getSaleSummary,
  listAccountsWithBalance,
  listParties,
  listProjectPhaseTransactions,
  upsertSale,
  type AccountWithBalance,
  type PartyRow,
  type ProjectRow,
  type SaleSummary,
  type TransactionRow,
} from '@/db';
import { PAY_TYPE_LABEL_KEYS, PAY_TYPES, type PayType } from '@/db/schema';
import { ONCE_PAY_TYPES } from '@/db';
import { useAccountOptions, useFocusReload, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { swallow } from '@/utils/log';
import { captureReceipt } from '@/utils/photo';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type SaleRoute = RouteProp<RootStackParamList, 'SaleDetail'>;

/**
 * The SALE phase of a project: the deal with the buyer (agreed price), money
 * received from the buyer (receipts land in an account), seller-side costs
 * (commission, taxes), and the notebook-style SALE ledger.
 */
export function SaleDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { projectId } = useRoute<SaleRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [summary, setSummary] = useState<SaleSummary | null>(null);
  const [txnDetail, setTxnDetail] = useState<TransactionRow | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [txns, setTxns] = useState<TransactionRow[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);

  // New-deal form (when no sale exists yet).
  const [dealPrice, setDealPrice] = useState(0);
  const [dealBuyer, setDealBuyer] = useState('');
  const [buyerPartyId, setBuyerPartyId] = useState<string | null>(null);
  const [buyers, setBuyers] = useState<PartyRow[]>([]);
  const [buyerSheet, setBuyerSheet] = useState(false);

  // Receipt sheet.
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [payType, setPayType] = useState<PayType | null>(null);
  const [receiptAmount, setReceiptAmount] = useState(0);
  const [receiptDate, setReceiptDate] = useState(todayISO().slice(0, 10));
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  const onPickReceiptPhoto = async () => {
    const uri = await captureReceipt().catch(swallow('sale:receiptPhoto'));
    if (uri) setReceiptUri(uri);
  };

  // Expense sheet.
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState(0);

  // Edit-deal sheet.
  const [editOpen, setEditOpen] = useState(false);
  const [editPrice, setEditPrice] = useState(0);
  const [editBuyer, setEditBuyer] = useState('');

  // Shared: the account the money moves through.
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountSheet, setAccountSheet] = useState(false);

  const { saving, run: runSave } = useSaveAction();

  const load = useCallback(async () => {
    const [sum, proj, rows, accs, buyerRows] = await Promise.all([
      getSaleSummary(projectId),
      getProject(projectId),
      listProjectPhaseTransactions(projectId, 'SALE'),
      listAccountsWithBalance(),
      listParties('BUYER'),
    ]);
    setSummary(sum);
    setProject(proj);
    setTxns(rows);
    setAccounts(accs);
    setBuyers(buyerRows);
  }, [projectId]);

  const { reload } = useFocusReload(load);

  // A completed project's sale phase is read-only history.
  const completed = project?.status === 'COMPLETED';

  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const sale = summary?.sale ?? null;
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  const accountOptions = useAccountOptions(accounts);

  const ledgerRows: LedgerRow[] = useMemo(
    () =>
      txns.map((txn) => ({
        id: txn.id,
        title:
          txn.description ||
          (txn.pay_type ? t(PAY_TYPE_LABEL_KEYS[txn.pay_type]) : '') ||
          txn.counterparty_name ||
          t('phaseSale'),
        date: txn.date,
        amount: txn.amount,
        direction: txn.direction === 'IN' ? 'in' : 'out',
        typeLabel: txn.pay_type ? t(PAY_TYPE_LABEL_KEYS[txn.pay_type]) : undefined,
        onPress: () => setTxnDetail(txn),
      })),
    [txns, t]
  );

  const onCreateDeal = async () => {
    if (dealPrice <= 0) return;
    const ok = await runSave(async () => {
      await upsertSale(projectId, { agreedPrice: dealPrice, buyerName: dealBuyer.trim() || null, buyerPartyId });
    });
    if (!ok) return;
    await reload();
  };

  const onSaveReceipt = async () => {
    if (!sale || receiptAmount <= 0 || !accountId) return;
    const ok = await runSave(async () => {
      await addSaleReceipt({
        saleId: sale.id,
        amount: receiptAmount,
        date: receiptDate,
        accountId,
        payType,
        receiptUri,
      });
    });
    if (!ok) return;
    setReceiptOpen(false);
    setReceiptAmount(0);
    setPayType(null);
    setReceiptDate(todayISO().slice(0, 10));
    setReceiptUri(null);
    await reload();
  };

  const onSaveExpense = async () => {
    if (expenseAmount <= 0 || !accountId || !expenseName.trim()) return;
    const ok = await runSave(async () => {
      await addSaleCost({
        projectId,
        name: expenseName.trim(),
        amount: expenseAmount,
        date: todayISO(),
        accountId,
      });
    });
    if (!ok) return;
    setExpenseOpen(false);
    setExpenseName('');
    setExpenseAmount(0);
    await reload();
  };

  const openEdit = () => {
    if (!sale) return;
    setEditPrice(sale.agreed_price);
    setEditBuyer(sale.buyer_name ?? '');
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    if (editPrice <= 0) return;
    const ok = await runSave(async () => {
      await upsertSale(projectId, { agreedPrice: editPrice, buyerName: editBuyer.trim() || null, buyerPartyId });
    });
    if (!ok) return;
    setEditOpen(false);
    await reload();
  };

  /** The account chip used by every sheet (money always lands in an account). */
  const accountChip = (
    <Pressable onPress={() => setAccountSheet(true)} style={styles.accountChip} accessibilityRole="button">
      <AppIcon name={selectedAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
      <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
        {selectedAccount ? `${selectedAccount.name} · ${formatRupees(selectedAccount.balance)}` : t('selectAccount')}
      </AppText>
      <AppIcon name="forward" size={18} color="textSecondary" />
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <AppHeader title={t('phaseSale')} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {!sale && completed ? null : !sale ? (
          /* No deal yet  record the agreed price + buyer */
          <AppCard>
            <View style={styles.newDeal}>
              <AppText size="lg" weight="bold">
                {t('saleDeal')}
              </AppText>
              <AmountInput label={t('agreedPrice')} value={dealPrice} onChange={setDealPrice} />
              {buyers.length > 0 ? (
                <Pressable onPress={() => setBuyerSheet(true)} style={styles.accountChip} accessibilityRole="button">
                  <AppIcon name="investor" size={18} color="primary" />
                  <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={buyerPartyId ? 'textPrimary' : 'textSecondary'}>
                    {buyerPartyId ? dealBuyer : t('selectSavedParty')}
                  </AppText>
                  <AppIcon name="forward" size={18} color="textSecondary" />
                </Pressable>
              ) : null}
              <FloatingLabelInput
                label={t('buyerName')}
                value={dealBuyer}
                onChangeText={(v) => {
                  setDealBuyer(v);
                  setBuyerPartyId(null);
                }}
              />
              <AppButton
                label={t('save')}
                icon="check"
                onPress={onCreateDeal}
                loading={saving}
                disabled={dealPrice <= 0}
              />
            </View>
          </AppCard>
        ) : (
          <>
            {/* Deal hero  tap to edit (locked once the project completes) */}
            <Pressable
              onPress={completed ? undefined : openEdit}
              disabled={completed}
              accessibilityRole="button"
              style={styles.hero}
            >
              <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
                {t('saleDeal')}
              </AppText>
              <AppText size="display" weight="bold" color="primary" tabular numberOfLines={1} adjustsFontSizeToFit>
                {formatRupees(sale.agreed_price)}
              </AppText>
              {sale.buyer_name ? (
                <AppText size="sm" color="textSecondary" numberOfLines={1}>
                  {`${t('buyerName')}: ${sale.buyer_name}`}
                </AppText>
              ) : null}
              <View style={styles.heroMetrics}>
                <MetricRow label={t('buyerReceipts')} value={formatRupees(summary?.receiptsTotal ?? 0)} tone="success" />
                <MetricRow label={t('outstanding')} value={formatRupees(summary?.outstanding ?? 0)} />
                <MetricRow label={t('saleCosts')} value={formatRupees(summary?.costs ?? 0)} tone="danger" />
              </View>
            </Pressable>

          </>
        )}

        {/* SALE ledger — the "+" opens the actions drawer. */}
        <View style={[styles.sectionHeaderRow, styles.sectionTitle]}>
          <AppText size="lg" weight="bold" style={styles.flex}>
            {t('transactions')}
          </AppText>
          {sale && !completed ? (
            <AddActionButton onPress={() => setActionsOpen(true)} accessibilityLabel={t('addReceipt')} />
          ) : null}
        </View>
        <AppCard compact>
          <LedgerTable rows={ledgerRows} emptyText={t('noAccountTxns')} />
        </AppCard>
      </ScrollView>

      {/* Actions drawer */}
      <ActionsDrawer
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={project?.name ?? ''}
        actions={[
          { icon: 'moneyIn', label: t('addReceipt'), onPress: () => setReceiptOpen(true) },
          { icon: 'moneyOut', label: t('addExpense'), onPress: () => setExpenseOpen(true) },
        ]}
      />

      {/* Add-receipt sheet */}
      <Modal visible={receiptOpen} transparent animationType="slide" onRequestClose={() => setReceiptOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={() => setReceiptOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold" center>
            {t('addReceipt')}
          </AppText>

          {/* Pay-type chips — a one-time type (Token/Bayana) already received
              on this sale is hidden so it can't be picked twice. */}
          <View style={styles.chipRow}>
            {PAY_TYPES.filter(
              (pt) =>
                !ONCE_PAY_TYPES.includes(pt) ||
                !(summary?.receipts ?? []).some((r) => r.pay_type === pt)
            ).map((pt) => {
              const selected = payType === pt;
              return (
                <Pressable
                  key={pt}
                  onPress={() => setPayType(selected ? null : pt)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.chip, selected && styles.chipActive]}
                >
                  <AppText size="sm" weight="bold" color={selected ? 'onPrimary' : 'textPrimary'}>
                    {t(PAY_TYPE_LABEL_KEYS[pt])}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <AmountInput
            label={t('amount')}
            value={receiptAmount}
            onChange={setReceiptAmount}
            floating
            surface={theme.colors.card}
            error={
              receiptAmount > 0 && receiptAmount > (summary?.outstanding ?? 0) ? t('exceedsRemaining') : null
            }
          />
          {accountChip}
          <DateField value={receiptDate} onChange={setReceiptDate} maxDate={todayISO().slice(0, 10)} />
          {receiptUri ? (
            <Pressable onPress={() => setReceiptUri(null)} style={styles.receiptRow} accessibilityRole="button">
              <Image source={{ uri: receiptUri }} style={styles.receiptThumb} />
              <AppText size="sm" weight="semibold" style={styles.flex}>
                {t('photoReceipt')}
              </AppText>
              <AppIcon name="close" size={20} color="danger" />
            </Pressable>
          ) : (
            <AppButton label={t('photoReceipt')} icon="camera" variant="secondary" onPress={onPickReceiptPhoto} />
          )}
          <AppButton
            label={t('save')}
            icon="check"
            onPress={onSaveReceipt}
            loading={saving}
            disabled={
              receiptAmount <= 0 ||
              !accountId ||
              (!!summary && receiptAmount > summary.outstanding)
            }
          />
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add-expense sheet */}
      <Modal visible={expenseOpen} transparent animationType="slide" onRequestClose={() => setExpenseOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={() => setExpenseOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold" center>
            {t('addExpense')}
          </AppText>
          <FloatingLabelInput label={t('note')} value={expenseName} onChangeText={setExpenseName} />
          <AmountInput
            label={t('amount')}
            value={expenseAmount}
            onChange={setExpenseAmount}
            floating
            surface={theme.colors.card}
          />
          {accountChip}
          <AppButton
            label={t('save')}
            icon="check"
            onPress={onSaveExpense}
            loading={saving}
            disabled={
              expenseAmount <= 0 ||
              !accountId ||
              !expenseName.trim() ||
              (!!selectedAccount && expenseAmount > selectedAccount.balance)
            }
          />
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit-deal sheet */}
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={() => setEditOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold" center>
            {t('saleDeal')}
          </AppText>
          <AmountInput
            label={t('agreedPrice')}
            value={editPrice}
            onChange={setEditPrice}
            floating
            surface={theme.colors.card}
          />
          <FloatingLabelInput label={t('buyerName')} value={editBuyer} onChangeText={setEditBuyer} />
          <AppButton
            label={t('save')}
            icon="check"
            onPress={onSaveEdit}
            loading={saving}
            disabled={editPrice <= 0}
          />
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <SelectSheet
        visible={buyerSheet}
        onClose={() => setBuyerSheet(false)}
        options={buyers.map((p) => ({ id: p.id, label: p.name }))}
        title={t('selectSavedParty')}
        onSelect={(o) => {
          const p = buyers.find((x) => x.id === o.id);
          if (p) {
            setBuyerPartyId(p.id);
            setDealBuyer(p.name);
            setEditBuyer(p.name);
          }
        }}
      />

      <SelectSheet
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        options={accountOptions}
        selectedId={accountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setAccountId(o.id)}
      />
      <TransactionDetailSheet txn={txnDetail} onClose={() => setTxnDetail(null)} />
    </View>
  );
}

/* ------------------------------ helpers --------------------------------- */

function MetricRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.metricRow}>
      <AppText size="sm" color="textSecondary">
        {label}
      </AppText>
      <AppText size="sm" weight="bold" tabular color={tone ?? 'textPrimary'}>
        {value}
      </AppText>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    receiptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    receiptThumb: { width: 44, height: 44, borderRadius: theme.radius.sm, backgroundColor: theme.colors.track },
    content: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
    newDeal: { gap: theme.spacing.md },
    hero: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    heroMetrics: {
      gap: theme.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.md,
      marginTop: theme.spacing.sm,
    },
    metricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    actionRow: { flexDirection: 'row', gap: theme.spacing.md },
    sectionTitle: { marginTop: theme.spacing.sm },
    /* sheets */
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
      gap: theme.spacing.md,
      ...theme.shadows.raised,
    },
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    chip: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
      minHeight: theme.touch.minTarget,
      justifyContent: 'center',
    },
    chipActive: { backgroundColor: theme.colors.primary },
    accountChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.lg,
      minHeight: theme.touch.minTarget,
    },
  });
