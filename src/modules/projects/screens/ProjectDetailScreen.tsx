import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StageBadge } from '@/components/StageBadge';
import { InvestorSheet, type InvestorInclusion, type InvestorOption } from '@/modules/investors';
import {
  ActionsDrawer,
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  LoadErrorState,
  type DrawerAction,
  type PhaseMetric,
} from '@/components/ui';
import {
  addDocument,
  attachInvestorsToProject,
  cancelProject,
  getCompletionWarnings,
  includePlotInProject,
  listDocuments,
  markProjectCompleted,
  reactivateProject,
  setProjectOnHold,
} from '@/db';
import { useSaveAction, useSettlementReport } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import { captureReceipt } from '@/utils/photo';

import { AddPlotSheet } from '../components/AddPlotSheet';
import { PhaseCardsSection } from '../components/PhaseCardsSection';
import { ProjectCostCard } from '../components/ProjectCostCard';
import { ProjectGalleryCard } from '../components/ProjectGalleryCard';
import { ProjectSummaryCard, SettleAction, type SettleActionProps } from '../components/ProjectSummaryCard';
import { useProjectDetail } from '../hooks/useProjectDetail';
import { useProjectReport } from '../hooks/useProjectReport';
import { projectStatusMeta } from '../utils/status';
import { makeStyles } from '../styled/ProjectDetailScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'ProjectDetail'>;

/**
 * Project Detail — the project is a PLOT + CONSTRUCTION + SALE. Total-cost hero,
 * auto status, three phase cards, the Musharakah investors section, the live
 * settlement summary + settle affordance, gallery, and a ⋯ menu (history / PDF /
 * hold / cancel). Thin orchestrator over useProjectDetail.
 */
export function ProjectDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { projectId } = useRoute<DetailRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const refreshProjects = useProjectsStore((s) => s.refresh);

  const { data, loadFailed, reload } = useProjectDetail(projectId);
  const { summary, cost, plotSum, constr, saleSum, shares, settlement, distribution, photos, freePlots, settledReport, allInvestors } = data;
  const { saving, run: runSave } = useSaveAction();

  const [editMode, setEditMode] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [plotSheetOpen, setPlotSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const project = summary?.project ?? null;
  const completed = project?.status === 'COMPLETED';
  const detailsVisible = !completed || editMode;
  const projectPeriod = project ? { start: project.start_date ?? project.created_at, end: project.settled_at } : null;

  const report = useSettlementReport({
    projectName: project?.name ?? '',
    settlement: settledReport?.settlement ?? null,
    plot: plotSum?.plot ?? null,
    period: projectPeriod,
    payoutAccountName: settledReport?.payoutAccountName ?? null,
  });
  const projectReport = useProjectReport({
    project,
    cost,
    plotSum,
    constr,
    saleSum,
    settlement,
    progressPercent: summary?.progressPercent ?? 0,
    saleDeal: summary?.saleDeal ?? 0,
    saleReceived: summary?.saleReceived ?? 0,
  });

  const constructionMetrics: PhaseMetric[] = useMemo(() => {
    if (!constr) return [];
    const rows: PhaseMetric[] = constr.byCategory.slice(0, 3).map((c) => ({
      label: language === 'ur' ? c.nameUr : c.nameEn,
      value: formatRupees(c.total),
    }));
    if (constr.laborOutstanding > 0) {
      rows.push({ label: `${t('dehari')} · ${t('outstanding')}`, value: formatRupees(constr.laborOutstanding), tone: 'danger' });
    }
    return rows;
  }, [constr, language, t]);

  const showSummary = (saleSum?.receiptsTotal ?? 0) > 0 || completed;
  const completedUnsettled = !!project && project.status === 'COMPLETED' && project.settled_at == null;
  const canSettle =
    (!!project && project.status === 'ACTIVE' && !!saleSum?.sale && saleSum.outstanding <= 0 && saleSum.receiptsTotal > 0) ||
    completedUnsettled;
  const settleAction: SettleActionProps | null =
    (!!saleSum?.sale && !completed) || completedUnsettled
      ? { enabled: canSettle, outstanding: completedUnsettled ? 0 : saleSum?.outstanding ?? 0, onPress: () => navigation.navigate('Settlement', { projectId }) }
      : null;

  const attachedIds = useMemo(() => new Set(shares.map((s) => s.investorId)), [shares]);
  const availableInvestors: InvestorOption[] = useMemo(
    () => allInvestors.filter((i) => !attachedIds.has(i.id)).map((i) => ({ id: i.id, name: i.name, staked: i.staked, remaining: i.remaining })),
    [allInvestors, attachedIds]
  );

  const onAttachInvestors = async (inclusions: InvestorInclusion[]) => {
    const ok = await runSave(async () => {
      await attachInvestorsToProject(
        projectId,
        inclusions.filter(({ investorId }) => allInvestors.some((i) => i.id === investorId)).map(({ investorId, amount }) => ({ investorId, amount }))
      );
    });
    if (!ok) return;
    setAttachOpen(false);
    await Promise.all([reload(), refreshProjects().catch(swallow('project:refresh'))]);
  };

  const onCapturePhoto = () => {
    void (async () => {
      const uri = await captureReceipt().catch(swallow('project:capture'));
      if (!uri) return;
      await runSave(async () => {
        await addDocument({ entityType: 'site_photo', entityId: projectId, fileUri: uri, mime: 'image/jpeg' });
        await reload();
      });
    })();
  };

  const onSelectPlot = async (plotId: string) => {
    setPlotSheetOpen(false);
    const ok = await runSave(() => includePlotInProject(plotId, projectId));
    await reload();
    if (ok) await refreshProjects().catch(swallow('project:refresh'));
  };

  const afterStatusChange = async () => {
    await Promise.all([reload(), refreshProjects().catch(swallow('project:refresh'))]);
  };

  const onMarkCompleted = () => {
    void (async () => {
      const warnings = (await getCompletionWarnings(projectId).catch(swallow('project:completionWarnings'))) ?? { laborOutstanding: 0, saleOutstanding: 0 };
      const body =
        t('markCompletedBody') +
        (warnings.laborOutstanding > 0 ? `\n${t('warnLaborDues')}: ${formatRupees(warnings.laborOutstanding)}` : '') +
        (warnings.saleOutstanding > 0 ? `\n${t('warnBuyerOwes')}: ${formatRupees(warnings.saleOutstanding)}` : '');
      Alert.alert(t('markCompletedTitle'), body, [
        { text: t('cancel'), style: 'cancel' },
        { text: t('markCompleted'), style: 'destructive', onPress: () => void runSave(() => markProjectCompleted(projectId)).then((ok) => { if (ok) void afterStatusChange(); }) },
      ]);
    })();
  };

  const onCancelProject = () => {
    setMenuOpen(false);
    Alert.alert(t('cancelProjectTitle'), t('cancelProjectBody'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('cancelProject'), style: 'destructive', onPress: () => void runSave(() => cancelProject(projectId)).then((ok) => { if (ok) void afterStatusChange(); }) },
    ]);
  };

  if (!project || !cost || !constr || !saleSum) {
    return (
      <View style={styles.screen}>
        <AppHeader title="" onBack={() => navigation.goBack()} />
        {loadFailed ? <LoadErrorState onRetry={() => void reload()} /> : null}
      </View>
    );
  }

  const status = summary ? projectStatusMeta(summary) : null;
  const menuActions: DrawerAction[] = [
    { icon: 'history', label: t('transactions'), onPress: () => { setMenuOpen(false); navigation.navigate('Transactions', { projectId }); } },
    { icon: 'print', label: t('printLabel'), onPress: () => { setMenuOpen(false); projectReport.preview(); } },
    { icon: 'share', label: t('shareLabel'), onPress: () => { setMenuOpen(false); projectReport.share(); } },
    ...(project.status === 'ACTIVE'
      ? [{ icon: 'today' as const, label: t('putOnHold'), onPress: () => { setMenuOpen(false); void runSave(() => setProjectOnHold(projectId)).then((ok) => { if (ok) void afterStatusChange(); }); } }]
      : []),
    ...(project.status === 'ON_HOLD'
      ? [{ icon: 'check' as const, label: t('reactivate'), onPress: () => { setMenuOpen(false); void runSave(() => reactivateProject(projectId)).then((ok) => { if (ok) void afterStatusChange(); }); } }]
      : []),
    ...(project.status !== 'COMPLETED'
      ? [{ icon: 'close' as const, label: t('cancelProject'), onPress: onCancelProject }]
      : []),
  ];

  return (
    <View style={styles.screen}>
      <AppHeader title={project.name} onBack={() => navigation.goBack()} rightAction={{ icon: 'more', onPress: () => setMenuOpen(true), accessibilityLabel: t('actions') }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}>
        {completed ? (
          <View style={styles.closedBanner}>
            <AppIcon name="checkCircle" size={20} color="success" />
            <AppText size="sm" weight="bold" color="success" style={styles.flex}>
              {t('closedBanner')}
            </AppText>
          </View>
        ) : null}

        {completed && editMode ? (
          <AppCard compact onPress={() => setEditMode(false)}>
            <View style={styles.toolRow}>
              <AppIcon name="check" size={20} color="success" />
              <AppText size="sm" weight="bold" style={styles.flex}>
                {t('doneEditing')}
              </AppText>
              <AppIcon name="forward" size={18} color="textSecondary" />
            </View>
          </AppCard>
        ) : null}

        {detailsVisible ? (
          <>
            {status ? (
              <View style={styles.statusRow}>
                <StageBadge tone={status.tone} label={t(status.labelKey)} />
              </View>
            ) : null}
            <ProjectCostCard cost={cost} received={saleSum?.receiptsTotal ?? 0} salePrice={saleSum?.sale?.agreed_price ?? 0} />
          </>
        ) : null}

        {completed && !editMode && settlement ? (
          <ProjectSummaryCard settlement={settlement} distribution={distribution} settle={null} onEdit={() => setEditMode(true)} report={report} period={projectPeriod} />
        ) : null}

        {detailsVisible ? (
          <>
            <PhaseCardsSection
              project={project}
              completed={completed}
              plotSum={plotSum}
              constr={constr}
              saleSum={saleSum}
              constructionMetrics={constructionMetrics}
              hasFreePlots={freePlots.length > 0}
              onAddPlot={() => setPlotSheetOpen(true)}
              onOpenPlot={(plotId) => navigation.navigate('PlotDetail', { plotId })}
              onOpenConstruction={() => navigation.navigate('ConstructionDetail', { projectId })}
              onOpenSale={() => navigation.navigate('SaleDetail', { projectId })}
            />

            <View style={styles.sectionHeader}>
              <AppText size="lg" weight="bold">
                {`${t('tabInvestors')} (${shares.length})`}
              </AppText>
              {!completed ? (
                <Pressable onPress={() => setAttachOpen(true)} hitSlop={theme.touch.hitSlop} accessibilityRole="button">
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

            {!completed && showSummary && settlement ? (
              <ProjectSummaryCard settlement={settlement} distribution={distribution} settle={settleAction} period={projectPeriod} />
            ) : !completed && settleAction ? (
              <AppCard>
                <SettleAction {...settleAction} />
              </AppCard>
            ) : null}

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

            <ProjectGalleryCard photos={photos} onCapture={onCapturePhoto} busy={saving} onSeeAll={() => navigation.navigate('PhotoDiary', { projectId })} readOnly={completed} />
          </>
        ) : null}
      </ScrollView>

      <ActionsDrawer visible={menuOpen} onClose={() => setMenuOpen(false)} title={project.name} actions={menuActions} />

      <InvestorSheet visible={attachOpen} onClose={() => setAttachOpen(false)} existingInvestors={availableInvestors} saving={saving} onSubmit={onAttachInvestors} />

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
