import {
  type RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InvestorSheet, type InvestorInclusion, type InvestorOption } from '@/components/InvestorSheet';
import { AddPlotSheet } from '@/components/project/AddPlotSheet';
import { PhaseCardsSection } from '@/components/project/PhaseCardsSection';
import { ProjectCostCard } from '@/components/project/ProjectCostCard';
import { ProjectGalleryCard } from '@/components/project/ProjectGalleryCard';
import { ProjectSummaryCard, SettleAction, type SettleActionProps } from '@/components/project/ProjectSummaryCard';
import {
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  LoadErrorState,
  type PhaseMetric,
} from '@/components/ui';
import {
  addDocument,
  attachInvestorsToProject,
  getCompletionWarnings,
  getConstructionSummary,
  getPlotSummary,
  getProjectCapitalSummary,
  getProjectCost,
  getProjectSettlementSummary,
  getProjectSummary,
  getSaleSummary,
  includePlotInProject,
  listDocuments,
  listInvestorsWithCapacity,
  listPlots,
  markProjectCompleted,
  type ConstructionSummary,
  type DocumentRow,
  type InvestorCapacity,
  type OwnershipShare,
  type PlotRow,
  type PlotSummary,
  type ProjectCost,
  type ProjectSummary,
  type SaleSummary,
  type SettlementSummary,
} from '@/db';
import { useFocusReload, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import { captureReceipt } from '@/utils/photo';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'ProjectDetail'>;

/**
 * v2 Project Detail  the project is a PLOT + CONSTRUCTION + SALE. A total-cost
 * hero, three tappable phase cards into the phase detail screens, the milestone
 * progress card, the investors (Musharakah) section, the live settlement
 * summary with the settle affordance, and the manual "mark completed" action.
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
  const [photos, setPhotos] = useState<DocumentRow[]>([]);
  const [freePlots, setFreePlots] = useState<PlotRow[]>([]);
  // On a completed project only the summary shows; this reveals the rest.
  const [showAllSections, setShowAllSections] = useState(false);

  // Sheets: attach-investor (shared <InvestorSheet>) + add-plot picker.
  const [allInvestors, setAllInvestors] = useState<InvestorCapacity[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [plotSheetOpen, setPlotSheetOpen] = useState(false);

  const { saving, run: runSave } = useSaveAction();

  const loadAll = useCallback(async () => {
    const s = await getProjectSummary(projectId);
    setSummary(s);
    const [c, cs, ss, cap, stl, plot, pics, owned] = await Promise.all([
      getProjectCost(projectId),
      getConstructionSummary(projectId, dayjs().format('YYYY-MM')),
      getSaleSummary(projectId),
      getProjectCapitalSummary(projectId),
      getProjectSettlementSummary(projectId),
      s?.project.plot_id ? getPlotSummary(s.project.plot_id) : Promise.resolve(null),
      listDocuments('site_photo', projectId),
      s?.project.plot_id ? Promise.resolve<PlotRow[]>([]) : listPlots('OWNED'),
    ]);
    setCost(c);
    setConstr(cs);
    setSaleSum(ss);
    setShares(cap.shares);
    setSettlement(stl);
    setPlotSum(plot);
    setPhotos(pics);
    setFreePlots(owned);
  }, [projectId]);

  const load = useCallback(async () => {
    await Promise.all([loadAll(), listInvestorsWithCapacity().then(setAllInvestors)]);
  }, [loadAll]);

  const { loadFailed, reload } = useFocusReload(load);

  const project = summary?.project ?? null;
  const completed = project?.status === 'COMPLETED';
  // A completed project shows only its summary until the user reveals the rest.
  const detailsVisible = !completed || showAllSections;

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

  const showSummary = (saleSum?.receiptsTotal ?? 0) > 0 || completed;
  const canSettle =
    !!project &&
    project.status === 'ACTIVE' &&
    !!saleSum?.sale &&
    saleSum.outstanding <= 0 &&
    saleSum.receiptsTotal > 0;

  // Settle affordance (V-18): visible once a sale exists, hidden when
  // completed, disabled with the concrete reason until fully received.
  const settleAction: SettleActionProps | null =
    !!saleSum?.sale && !completed
      ? {
        enabled: canSettle,
        outstanding: saleSum.outstanding,
        onPress: () => navigation.navigate('Settlement', { projectId }),
      }
      : null;

  // Investors not yet on this project (so the sheet doesn't offer duplicates).
  const attachedIds = useMemo(() => new Set(shares.map((s) => s.investorId)), [shares]);
  const availableInvestors: InvestorOption[] = useMemo(
    () =>
      allInvestors
        .filter((i) => !attachedIds.has(i.id))
        .map((i) => ({ id: i.id, name: i.name, staked: i.staked, remaining: i.remaining })),
    [allInvestors, attachedIds]
  );

  const openAttach = () => setAttachOpen(true);

  /**
   * Include the selected investors: each brings the amount entered in the
   * drawer as their project stake (recorded as INITIAL capital so ownership %
   * is derived from those amounts). Profit % comes from Settings, same for all.
   * The cash was already handled when the investor was added, so no account here.
   */
  const onAttachInvestors = async (inclusions: InvestorInclusion[]) => {
    const ok = await runSave(async () => {
      await attachInvestorsToProject(
        projectId,
        inclusions
          .filter(({ investorId }) => allInvestors.some((i) => i.id === investorId))
          .map(({ investorId, amount }) => ({ investorId, amount, profitPct: defaultPct }))
      );
    });
    if (!ok) return;
    setAttachOpen(false);
    await Promise.all([reload(), refreshProjects().catch(swallow('project:refresh'))]);
  };

  /**
   * Capture a site photo into the project gallery, then refresh it. The
   * camera step stays OUTSIDE the save action — a cancelled capture is not a
   * failed save (and must not alert or bump the data version).
   */
  const onCapturePhoto = () => {
    void (async () => {
      const uri = await captureReceipt().catch(swallow('project:capture'));
      if (!uri) return;
      await runSave(async () => {
        await addDocument({ entityType: 'site_photo', entityId: projectId, fileUri: uri, mime: 'image/jpeg' });
        setPhotos(await listDocuments('site_photo', projectId));
      });
    })();
  };

  /** "Add plot later" (UC-2): always open the picker — it lists OWNED plots
   *  and a "New plot" row, so an empty list is never a dead end. */
  const onAddPlot = () => setPlotSheetOpen(true);

  const onSelectPlot = async (plotId: string) => {
    setPlotSheetOpen(false);
    const ok = await runSave(() => includePlotInProject(plotId, projectId));
    // Reload even after a conflict — the free-plot list may have gone stale (1.4).
    await reload();
    if (ok) await refreshProjects().catch(swallow('project:refresh'));
  };

  /**
   * Manual "Mark completed" (UC-10): confirm with the loose ends listed
   * (unpaid labor, buyer outstanding) — completing with either is allowed.
   */
  const onMarkCompleted = () => {
    void (async () => {
      const warnings = (await getCompletionWarnings(projectId).catch(
        swallow('project:completionWarnings')
      )) ?? { laborOutstanding: 0, saleOutstanding: 0 };
      const body =
        t('markCompletedBody') +
        (warnings.laborOutstanding > 0
          ? `\n${t('warnLaborDues')}: ${formatRupees(warnings.laborOutstanding)}`
          : '') +
        (warnings.saleOutstanding > 0
          ? `\n${t('warnBuyerOwes')}: ${formatRupees(warnings.saleOutstanding)}`
          : '');
      Alert.alert(t('markCompletedTitle'), body, [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('markCompleted'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const ok = await runSave(() => markProjectCompleted(projectId));
              if (!ok) return;
              await Promise.all([reload(), refreshProjects().catch(swallow('project:refresh'))]);
            })();
          },
        },
      ]);
    })();
  };

  if (!project || !cost || !constr || !saleSum) {
    return (
      <View style={styles.screen}>
        <AppHeader title="" onBack={() => navigation.goBack()} />
        {loadFailed ? <LoadErrorState onRetry={() => void reload()} /> : null}
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

        {/* Total cost hero with the color-coded phase columns */}
        <ProjectCostCard cost={cost} />

        {/* Completed projects lead with the settlement summary (the project's
            final story); on active projects it appears after investors below. */}
        {completed && settlement ? (
          <ProjectSummaryCard settlement={settlement} settle={null} />
        ) : null}

        {/* Reveal / hide the rest of the project on a completed project (UC-10). */}
        {completed ? (
          <AppCard compact onPress={() => setShowAllSections((v) => !v)}>
            <View style={styles.toolRow}>
              <AppIcon name={showAllSections ? 'collapse' : 'expand'} size={20} color="primary" />
              <AppText size="sm" weight="bold" style={styles.flex}>
                {showAllSections ? t('hideSections') : t('showSections')}
              </AppText>
              <AppIcon name="forward" size={18} color="textSecondary" />
            </View>
          </AppCard>
        ) : null}

        {detailsVisible ? (
          <>
            {/* Phase cards: Plot / Construction / Sale */}
            <PhaseCardsSection
              project={project}
              completed={completed}
              plotSum={plotSum}
              constr={constr}
              saleSum={saleSum}
              constructionMetrics={constructionMetrics}
              hasFreePlots={freePlots.length > 0}
              onAddPlot={onAddPlot}
              onOpenPlot={(plotId) => navigation.navigate('PlotDetail', { plotId })}
              onOpenConstruction={() => navigation.navigate('ConstructionDetail', { projectId })}
              onOpenSale={() => navigation.navigate('SaleDetail', { projectId })}
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

            {/* Active-project summary / settle affordance. Renders even before a
                receipt exists (standalone card) so it is never a dead-end. */}
            {!completed && showSummary && settlement ? (
              <ProjectSummaryCard settlement={settlement} settle={settleAction} />
            ) : !completed && settleAction ? (
              <AppCard>
                <SettleAction {...settleAction} />
              </AppCard>
            ) : null}

            {/* Mark completed  manual close without a settlement (UC-10) */}
            {project.status === 'ACTIVE' ? (
              <AppCard compact onPress={onMarkCompleted}>
                <View style={styles.toolRow}>
                  <AppIcon name="checkCircle" size={20} color="success" />
                  <AppText size="sm" weight="bold" style={styles.flex}>
                    {t('markCompleted')}
                  </AppText>
                  <AppIcon name="forward" size={18} color="textSecondary" />
                </View>
              </AppCard>
            ) : null}

            {/* Site-photo gallery (styled, with lightbox + "see all" → diary) */}
            <ProjectGalleryCard
              photos={photos}
              onCapture={onCapturePhoto}
              busy={saving}
              onSeeAll={() => navigation.navigate('PhotoDiary', { projectId })}
              readOnly={completed}
            />
          </>
        ) : null}
      </ScrollView>

      {/* Attach-investor sheet — the ONE shared investor drawer. */}
      <InvestorSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        existingInvestors={availableInvestors}
        saving={saving}
        onSubmit={onAttachInvestors}
      />

      {/* Add-plot picker: OWNED plots + a "New plot" row that returns here. */}
      <AddPlotSheet
        visible={plotSheetOpen}
        onClose={() => setPlotSheetOpen(false)}
        plots={freePlots}
        onSelect={(plotId) => void onSelectPlot(plotId)}
        onNewPlot={() => {
          setPlotSheetOpen(false);
          navigation.navigate('NewPlot', { forProjectId: projectId });
        }}
      />
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
    toolRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  });
