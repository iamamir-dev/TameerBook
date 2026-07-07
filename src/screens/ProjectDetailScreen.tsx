import {
  type RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AmountInput,
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  PhaseCard,
  SelectSheet,
  type IconKey,
  type PhaseMetric,
  type SelectOption,
} from '@/components/ui';
import {
  addInvestment,
  addInvestor,
  addProjectInvestor,
  getConstructionSummary,
  getPlotSummary,
  getProjectCapitalSummary,
  getProjectCost,
  getProjectSettlementSummary,
  getProjectSummary,
  getSaleSummary,
  listAccountsWithBalance,
  listInvestors,
  type AccountWithBalance,
  type ConstructionSummary,
  type InvestorRow,
  type OwnershipShare,
  type PlotSummary,
  type ProjectCost,
  type ProjectSummary,
  type SaleSummary,
  type SettlementSummary,
} from '@/db';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'ProjectDetail'>;

/**
 * v2 Project Detail  the project is a PLOT + CONSTRUCTION + SALE. A total-cost
 * hero, three tappable phase cards into the phase detail screens, the
 * investors (Musharakah) section, and the live settlement summary.
 */
export function ProjectDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { projectId } = useRoute<DetailRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const refreshProjects = useProjectsStore((s) => s.refresh);
  const defaultPct = useSettingsStore((s) => s.investorProfitPct);

  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [cost, setCost] = useState<ProjectCost | null>(null);
  const [plotSum, setPlotSum] = useState<PlotSummary | null>(null);
  const [constr, setConstr] = useState<ConstructionSummary | null>(null);
  const [saleSum, setSaleSum] = useState<SaleSummary | null>(null);
  const [shares, setShares] = useState<OwnershipShare[]>([]);
  const [settlement, setSettlement] = useState<SettlementSummary | null>(null);

  // Attach-investor sheet state.
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [allInvestors, setAllInvestors] = useState<InvestorRow[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [accountSheet, setAccountSheet] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftAmount, setDraftAmount] = useState(0);
  const [draftGiven, setDraftGiven] = useState(0);
  const [draftPct, setDraftPct] = useState(defaultPct);
  const [draftAccountId, setDraftAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    const s = await getProjectSummary(projectId);
    setSummary(s);
    const [c, cs, ss, cap, stl, plot] = await Promise.all([
      getProjectCost(projectId),
      getConstructionSummary(projectId, dayjs().format('YYYY-MM')),
      getSaleSummary(projectId),
      getProjectCapitalSummary(projectId),
      getProjectSettlementSummary(projectId),
      s?.project.plot_id ? getPlotSummary(s.project.plot_id) : Promise.resolve(null),
    ]);
    setCost(c);
    setConstr(cs);
    setSaleSum(ss);
    setShares(cap.shares);
    setSettlement(stl);
    setPlotSum(plot);
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      loadAll().catch(() => undefined);
      listInvestors().then(setAllInvestors).catch(() => undefined);
      listAccountsWithBalance().then(setAccounts).catch(() => undefined);
    }, [loadAll])
  );

  // Default the destination account for new capital.
  useEffect(() => {
    if (!draftAccountId && accounts.length > 0) setDraftAccountId(accounts[0].id);
  }, [accounts, draftAccountId]);

  const project = summary?.project ?? null;
  const completed = project?.status === 'COMPLETED';

  const catLabel = useCallback(
    (c: { nameEn: string; nameUr: string }) => (language === 'ur' ? c.nameUr : c.nameEn),
    [language]
  );

  const constructionMetrics: PhaseMetric[] = useMemo(() => {
    if (!constr) return [];
    const rows: PhaseMetric[] = constr.byCategory.slice(0, 3).map((c) => ({
      label: catLabel(c),
      value: formatRupees(c.total),
    }));
    if (constr.laborOutstanding > 0) {
      rows.push({
        label: `${t('dehari')} · ${t('outstanding')}`,
        value: formatRupees(constr.laborOutstanding),
        tone: 'danger',
      });
    }
    return rows;
  }, [constr, catLabel, t]);

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
  const draftAccount = accounts.find((a) => a.id === draftAccountId) ?? null;

  const showSummary = (saleSum?.receiptsTotal ?? 0) > 0 || completed;
  const canSettle =
    !!project &&
    project.status === 'ACTIVE' &&
    !!saleSum?.sale &&
    saleSum.outstanding <= 0 &&
    saleSum.receiptsTotal > 0;

  const openAttach = () => {
    setDraftId(null);
    setDraftName('');
    setDraftAmount(0);
    setDraftGiven(0);
    setDraftPct(defaultPct);
    setAttachOpen(true);
  };

  /**
   * Commitment vs cash: `draftAmount` is what the investor PROMISED (no money
   * moves); `draftGiven` is what they handed over right now  only that posts
   * to the account. Later instalments go through Add Investment, and if the
   * paid-in total ever exceeds the commitment it auto-raises.
   */
  const onAttachInvestor = async () => {
    const name = draftName.trim();
    if (!name || draftAmount <= 0) return;
    if (draftGiven > 0 && !draftAccountId) return;
    setSaving(true);
    try {
      const investorId = draftId ?? (await addInvestor({ name })).id;
      await addProjectInvestor({
        projectId,
        investorId,
        committedAmount: draftAmount,
        profitPct: draftPct,
      });
      if (draftGiven > 0 && draftAccountId) {
        await addInvestment({
          investorId,
          projectId,
          amount: draftGiven,
          date: todayISO(),
          accountId: draftAccountId,
        });
      }
      setAttachOpen(false);
      await Promise.all([loadAll(), refreshProjects()]);
      setAccounts(await listAccountsWithBalance());
    } finally {
      setSaving(false);
    }
  };

  if (!project || !cost || !constr || !saleSum) {
    return (
      <View style={styles.screen}>
        <AppHeader title="" onBack={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        title={project.name}
        onBack={() => navigation.goBack()}
        rightAction={{
          icon: 'ledger',
          onPress: () => navigation.navigate('Transactions', { projectId }),
          accessibilityLabel: t('transactions'),
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {/* Closed banner */}
        {completed ? (
          <View style={styles.closedBanner}>
            <AppIcon name="checkCircle" size={20} color="success" />
            <AppText size="sm" weight="bold" color="success" style={styles.flex}>
              {t('closedBanner')}
            </AppText>
          </View>
        ) : null}

        {/* Total cost hero */}
        <View style={styles.hero}>
          <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
            {t('projectTotalCost')}
          </AppText>
          <AppText size="display" weight="bold" color="primary" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(cost.totalCost)}
          </AppText>
          <AppText size="xs" color="textSecondary" numberOfLines={2}>
            {`${t('phasePlot')} ${formatRupees(cost.plotCost)} · ${t('phaseConstruction')} ${formatRupees(cost.constructionCost)} · ${t('phaseSale')} ${formatRupees(cost.saleCost)}`}
          </AppText>
        </View>

        {/* Phase: Plot */}
        {project.plot_id ? (
          <PhaseCard
            title={t('phasePlot')}
            icon="plot"
            tone="primary"
            headline={plotSum?.totalCost ?? 0}
            headlineLabel={t('totalCostLabel')}
            metrics={[
              { label: t('dealPrice'), value: formatRupees(plotSum?.dealPrice ?? 0) },
              { label: t('paidToSeller'), value: formatRupees(plotSum?.paidToSeller ?? 0), tone: 'success' },
              { label: t('remaining'), value: formatRupees(plotSum?.remaining ?? 0) },
              { label: t('plotExpensesLabel'), value: formatRupees(plotSum?.expenses ?? 0) },
            ]}
            onPress={() => navigation.navigate('PlotDetail', { plotId: project.plot_id! })}
          />
        ) : (
          <AppCard onPress={() => navigation.navigate('Tabs', { screen: 'Plots' })} style={styles.noPlotCard}>
            <View style={styles.noPlotRow}>
              <AppIcon name="plot" size={22} color="textSecondary" />
              <View style={styles.flex}>
                <AppText size="md" weight="bold" color="textSecondary">
                  {t('phasePlot')}
                </AppText>
                <AppText size="xs" color="textSecondary">
                  {t('selectPlot')}
                </AppText>
              </View>
              <AppText size="sm" weight="semibold" color="accent">
                {t('plotsTitle')}
              </AppText>
            </View>
          </AppCard>
        )}

        {/* Phase: Construction */}
        <PhaseCard
          title={t('phaseConstruction')}
          icon="tools"
          tone="accent"
          headline={constr.total}
          headlineLabel={t('constructionCost')}
          metrics={constructionMetrics}
          onPress={() => navigation.navigate('ConstructionDetail', { projectId })}
        />

        {/* Phase: Sale */}
        <PhaseCard
          title={t('phaseSale')}
          icon="tag"
          tone="gold"
          headline={saleSum.sale?.agreed_price ?? 0}
          headlineLabel={t('saleDeal')}
          metrics={[
            { label: t('buyerReceipts'), value: formatRupees(saleSum.receiptsTotal), tone: 'success' },
            { label: t('outstanding'), value: formatRupees(saleSum.outstanding) },
            { label: t('saleCosts'), value: formatRupees(saleSum.costs) },
          ]}
          onPress={() => navigation.navigate('SaleDetail', { projectId })}
        />

        {/* Investors */}
        <View style={styles.sectionHeader}>
          <AppText size="lg" weight="bold">
            {`${t('tabInvestors')} (${shares.length})`}
          </AppText>
          {!completed ? (
            <Pressable onPress={openAttach} hitSlop={theme.touch.hitSlop} accessibilityRole="button">
              <AppText size="sm" weight="semibold" color="accent">
                {t('attachInvestor')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
        <AppCard compact>
          {shares.length === 0 ? (
            <AppText size="sm" color="textSecondary" center style={styles.emptyPad}>
              {t('guideInvestors')}
            </AppText>
          ) : (
            shares.map((s, i) => (
              <Pressable
                key={s.projectInvestorId}
                onPress={() => navigation.navigate('InvestorProfile', { investorId: s.investorId })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.invRow, i > 0 && styles.ruled, pressed && styles.pressed]}
              >
                <View style={styles.invIcon}>
                  <AppIcon name="investor" size={18} color="gold" />
                </View>
                <View style={styles.flex}>
                  <AppText size="sm" weight="bold" numberOfLines={1}>
                    {s.name}
                  </AppText>
                  <AppText size="xs" color="textSecondary" tabular>
                    {formatRupees(s.capital)}
                  </AppText>
                </View>
                <AppText size="sm" weight="bold" tabular color="textSecondary">
                  {`${Math.round(s.ownershipPct)}%`}
                </AppText>
                <AppIcon name="forward" size={18} color="textSecondary" />
              </Pressable>
            ))
          )}
        </AppCard>

        {/* Summary / settlement */}
        {showSummary && settlement ? (
          <>
            <View style={styles.sectionHeader}>
              <AppText size="lg" weight="bold">
                {t('projectSummary')}
              </AppText>
            </View>
            <AppCard>
              <SummaryRow label={t('revenue')} value={formatRupees(settlement.revenue)} first />
              <SummaryRow label={t('totalExpenses')} value={formatRupees(settlement.expenses)} />
              <SummaryRow
                label={t(settlement.isProfit ? 'netProfit' : 'netLoss')}
                value={formatRupees(Math.abs(settlement.net))}
                tone={settlement.isProfit ? 'success' : 'danger'}
              />

              {settlement.investors.map((inv) => (
                <View key={inv.investorId} style={[styles.partyBlock, styles.ruled]}>
                  <AppText size="sm" weight="bold" numberOfLines={1}>
                    {inv.name}
                  </AppText>
                  <AppText size="xs" color="textSecondary" tabular>
                    {`${t('paidInCapital')}: ${formatRupees(inv.invested)} · ${inv.profitPct}%`}
                  </AppText>
                  <View style={styles.partyLine}>
                    <AppText size="xs" color={inv.profitOrLoss >= 0 ? 'success' : 'danger'} tabular>
                      {`${t(inv.profitOrLoss >= 0 ? 'netProfit' : 'netLoss')} ${formatRupees(Math.abs(inv.profitOrLoss))}`}
                    </AppText>
                    {inv.donation > 0 ? (
                      <AppText size="xs" color="textSecondary" tabular>
                        {`${t('donationLabel')} ${formatRupees(inv.donation)}`}
                      </AppText>
                    ) : null}
                    <AppText size="xs" weight="bold" tabular>
                      {`${t('payoutLabel')} ${formatRupees(inv.finalPayout)}`}
                    </AppText>
                  </View>
                </View>
              ))}

              <View style={[styles.partyBlock, styles.ruled]}>
                <AppText size="sm" weight="bold">
                  {t('owner')}
                </AppText>
                <AppText size="xs" color="textSecondary" tabular>
                  {`${t('ownerInvested')}: ${formatRupees(settlement.owner.invested)}`}
                </AppText>
                <View style={styles.partyLine}>
                  <AppText size="xs" color={settlement.owner.profitOrLoss >= 0 ? 'success' : 'danger'} tabular>
                    {`${t(settlement.owner.profitOrLoss >= 0 ? 'netProfit' : 'netLoss')} ${formatRupees(Math.abs(settlement.owner.profitOrLoss))}`}
                  </AppText>
                  {settlement.owner.donation > 0 ? (
                    <AppText size="xs" color="textSecondary" tabular>
                      {`${t('donationLabel')} ${formatRupees(settlement.owner.donation)}`}
                    </AppText>
                  ) : null}
                </View>
              </View>

              {settlement.totalDonation > 0 ? (
                <SummaryRow label={t('totalDonation')} value={formatRupees(settlement.totalDonation)} />
              ) : null}

              {canSettle ? (
                <View style={styles.settleBtn}>
                  <AppButton
                    label={t('settleTitle')}
                    icon="checkCircle"
                    onPress={() => navigation.navigate('Settlement', { projectId })}
                  />
                </View>
              ) : null}
            </AppCard>
          </>
        ) : null}

        {/* Tools */}
        <AppCard compact onPress={() => navigation.navigate('PhotoDiary', { projectId })}>
          <View style={styles.toolRow}>
            <AppIcon name="camera" size={20} color="primary" />
            <AppText size="sm" weight="bold" style={styles.flex}>
              {t('photoDiary')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </View>
        </AppCard>
      </ScrollView>

      {/* Attach-investor sheet */}
      <Modal visible={attachOpen} transparent animationType="slide" onRequestClose={() => setAttachOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={() => setAttachOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold" center>
            {t('attachInvestor')}
          </AppText>

          {allInvestors.length > 0 ? (
            <>
              <AppText size="sm" weight="semibold" color="textSecondary">
                {t('selectInvestor')}
              </AppText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipRow}
              >
                {allInvestors.map((inv) => {
                  const selected = draftId === inv.id;
                  return (
                    <Pressable
                      key={inv.id}
                      onPress={() => {
                        setDraftId(inv.id);
                        setDraftName(inv.name);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={inv.name}
                      style={[styles.chip, selected && styles.chipActive]}
                    >
                      <AppIcon name="investor" size={16} color={selected ? 'onPrimary' : 'primary'} />
                      <AppText size="sm" weight="bold" color={selected ? 'onPrimary' : 'textPrimary'} numberOfLines={1}>
                        {inv.name}
                      </AppText>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <AppText size="xs" color="textSecondary" center>
                {t('orAddNew')}
              </AppText>
            </>
          ) : null}

          <FloatingLabelInput
            label={t('newInvestor')}
            value={draftId ? '' : draftName}
            onChangeText={(v) => {
              setDraftId(null);
              setDraftName(v);
            }}
          />

          {/* The promise  no money moves for this. */}
          <AmountInput
            label={t('committedAmount')}
            value={draftAmount}
            onChange={setDraftAmount}
            floating
            surface={theme.colors.card}
          />

          {/* What they handed over right now  only this hits the account. */}
          <AmountInput
            label={t('givenNow')}
            value={draftGiven}
            onChange={setDraftGiven}
            floating
            surface={theme.colors.card}
          />

          {/* Profit % stepper */}
          <View style={styles.pctRow}>
            <AppText size="md" weight="semibold" style={styles.flex}>
              {t('profitPct')}
            </AppText>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setDraftPct((p) => Math.max(0, p - 5))}
                hitSlop={theme.touch.hitSlop}
                accessibilityRole="button"
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <AppText size="lg" weight="bold" color="primary">−</AppText>
              </Pressable>
              <AppText size="md" weight="bold" tabular style={styles.stepValue}>
                {`${draftPct}%`}
              </AppText>
              <Pressable
                onPress={() => setDraftPct((p) => Math.min(100, p + 5))}
                hitSlop={theme.touch.hitSlop}
                accessibilityRole="button"
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <AppText size="lg" weight="bold" color="primary">+</AppText>
              </Pressable>
            </View>
          </View>

          {/* Destination account  the capital lands here */}
          <Pressable onPress={() => setAccountSheet(true)} style={styles.accountChip} accessibilityRole="button">
            <AppIcon name={draftAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
            <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
              {draftAccount ? `${draftAccount.name} · ${formatRupees(draftAccount.balance)}` : t('selectAccount')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <AppButton
            label={t('add')}
            icon="check"
            onPress={onAttachInvestor}
            loading={saving}
            disabled={!draftName.trim() || draftAmount <= 0 || (draftGiven > 0 && !draftAccountId)}
          />
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <SelectSheet
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        options={accountOptions}
        selectedId={draftAccountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setDraftAccountId(o.id)}
      />
    </View>
  );
}

/* ------------------------------ helpers --------------------------------- */

function SummaryRow({
  label,
  value,
  tone,
  first,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
  first?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={[styles.summaryRow, !first && styles.ruled]}>
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
    content: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
    closedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.successSoft,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    hero: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    noPlotCard: { opacity: 0.85 },
    noPlotRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    emptyPad: { paddingVertical: theme.spacing.lg },
    invRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      minHeight: theme.touch.minTarget,
    },
    invIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.goldSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ruled: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    pressed: { opacity: 0.7 },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm,
    },
    partyBlock: { paddingVertical: theme.spacing.sm, gap: 2 },
    partyLine: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    settleBtn: { marginTop: theme.spacing.md },
    toolRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    /* sheet */
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
    chipRow: { gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
      maxWidth: 200,
    },
    chipActive: { backgroundColor: theme.colors.primary },
    pctRow: { flexDirection: 'row', alignItems: 'center' },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepValue: { minWidth: 48, textAlign: 'center' },
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
