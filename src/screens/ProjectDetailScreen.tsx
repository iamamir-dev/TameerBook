import {
  type RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { ProgressBar } from '@/components/ProgressBar';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AmountInput, AppButton, AppCard, AppHeader, AppIcon, AppText, type IconKey } from '@/components/ui';
import {
  addAcquisitionPayment,
  addDocument,
  addInvestment,
  addInvestor,
  addProjectInvestor,
  addSaleReceipt,
  getAcquisitionSummary,
  getConstructionSummary,
  getProjectCapitalSummary,
  getProjectSettlementSummary,
  getProjectSummary,
  getSaleSummary,
  listDocuments,
  listInvestors,
  listMilestones,
  listProperties,
  listPropertyPayments,
  moveProjectToNextStage,
  setMilestoneStatus,
  setTransferDate,
  settleProject,
  upsertSale,
  type DocumentRow,
  type InvestorRow,
  type MilestoneRow,
  type OwnershipShare,
  type PaymentMode,
  type ProjectSummary,
  type PropertyRow,
  type SaleSummary,
  type SettlementSummary,
  type SizeUnit,
} from '@/db';
import { PROJECT_STAGES, type ProjectStage } from '@/db/schema';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';
import type { ColorPalette, Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';
import { pickDocumentImage } from '@/utils/photo';
import { PROJECT_STAGE_LABEL, stageIndex } from '@/utils/projectStage';
import { checkNextStage, type StageCheck } from '@/utils/stageRules';
import { softToneColor } from '@/utils/tones';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'ProjectDetail'>;
type ColorKey = keyof ColorPalette;
type Phase = 'khareedari' | 'tameer' | 'sale';
type Status = 'done' | 'active' | 'pending';

const UNIT_KEY: Record<SizeUnit, TranslationKey> = {
  MARLA: 'unitMarla',
  KANAL: 'unitKanal',
  SQYD: 'unitSqyd',
};

/** Raw figures the screen needs, loaded once and used to build the journey. */
interface Stats {
  acqPaid: number;
  acqPrice: number;
  constrTotal: number;
  saleOutstanding: number | null;
  docsCount: number;
}

/**
 * Every pipeline stage is shown as its own step in the tracker. Each stage maps
 * to the work screen (phase) it belongs to and the phase name shown as its
 * sub-line: Buying covers deal→possession, Build the construction stages, Sale
 * the listing→close. Indices match the order of `PROJECT_STAGES`.
 */
function phaseForStage(i: number): { phase: Phase; labelKey: TranslationKey } {
  if (i <= 3) return { phase: 'khareedari', labelKey: 'tabKhareedari' };
  if (i <= 5) return { phase: 'tameer', labelKey: 'tabTameer' };
  return { phase: 'sale', labelKey: 'tabSale' };
}

/** The three collapsible phases and the pipeline-index range each covers. */
const PHASES: { key: Phase; labelKey: TranslationKey; lo: number; hi: number }[] = [
  { key: 'khareedari', labelKey: 'tabKhareedari', lo: 0, hi: 3 },
  { key: 'tameer', labelKey: 'tabTameer', lo: 4, hi: 5 },
  { key: 'sale', labelKey: 'tabSale', lo: 6, hi: 7 },
];

/** Plain-language description shown at the top of every stage drawer. */
const STAGE_DESC: Record<ProjectStage, TranslationKey> = {
  TOKEN_PAID: 'sTokenPaid',
  BAYANA_PAID: 'sBayanaPaid',
  TRANSFER: 'sTransfer',
  POSSESSION: 'sPossession',
  CONSTRUCTION: 'sConstruction',
  FINISHING: 'sFinishing',
  LISTED_FOR_SALE: 'sListed',
  CLOSED: 'sClosed',
};

/** The document captured at each step (offered for upload in its drawer). */
const STAGE_DOC: Partial<Record<ProjectStage, TranslationKey>> = {
  TOKEN_PAID: 'docFard',
  BAYANA_PAID: 'docAgreement',
  TRANSFER: 'docNdc',
  POSSESSION: 'docRegistry',
};

export function ProjectDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { projectId } = useRoute<DetailRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const refreshProjects = useProjectsStore((s) => s.refresh);

  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [stats, setStats] = useState<Stats>({ acqPaid: 0, acqPrice: 0, constrTotal: 0, saleOutstanding: null, docsCount: 0 });
  const [capital, setCapital] = useState(0);
  const [shares, setShares] = useState<OwnershipShare[]>([]);
  const [stageCheck, setStageCheck] = useState<StageCheck>({ ok: true, reasonKey: null });
  const [showTimeline, setShowTimeline] = useState(false);
  // Which phase group is expanded (null = default to the active phase,
  // 'none' = the user collapsed it).
  const [openPhase, setOpenPhase] = useState<Phase | 'none' | null>(null);
  // Pipeline index of the stage whose detail/input sheet is open (null = none).
  const [sheetStage, setSheetStage] = useState<number | null>(null);
  // The single "+" entry chooser (Income / Expense / Investment).
  const [entryOpen, setEntryOpen] = useState(false);
  // Completion summary (investors + owner P&L) — loaded for the closed view.
  const [settle, setSettle] = useState<SettlementSummary | null>(null);
  // Documents attached to the property (drives the per-stage "doc attached?" check).
  const [propertyDocs, setPropertyDocs] = useState<DocumentRow[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  // Per-stage drawer inputs (payments / receipts / milestones / sale).
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [saleSum, setSaleSum] = useState<SaleSummary | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState<PaymentMode>('CASH');
  const [payReceipt, setPayReceipt] = useState<string | null>(null);
  // Recorded token/bayana payments (amount + receipt image) for read mode.
  const [payInfo, setPayInfo] = useState<Partial<Record<'TOKEN' | 'BAYANA', { amount: number; receipt: string | null }>>>({});
  const [saleAgreed, setSaleAgreed] = useState(0);
  const [busy, setBusy] = useState(false);
  // Project documents drawer + full-screen image viewer.
  const [projectDocs, setProjectDocs] = useState<DocumentRow[]>([]);
  const [docsOpen, setDocsOpen] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  // Attach-investor drawer (existing investor or new) — no navigation.
  const defaultPct = useSettingsStore((s) => s.investorProfitPct);
  const [allInvestors, setAllInvestors] = useState<InvestorRow[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [draftInvId, setDraftInvId] = useState<string | null>(null);
  const [draftInvName, setDraftInvName] = useState('');
  const [draftInvAmount, setDraftInvAmount] = useState(0);
  const [draftInvPct, setDraftInvPct] = useState(defaultPct);

  const load = useCallback(async () => {
    const ym = todayISO().slice(0, 7);
    const [s, props, constr, sale, cap, docs, settlement] = await Promise.all([
      getProjectSummary(projectId),
      listProperties(projectId),
      getConstructionSummary(projectId, ym),
      getSaleSummary(projectId),
      getProjectCapitalSummary(projectId),
      listDocuments('project', projectId),
      getProjectSettlementSummary(projectId),
    ]);
    setSummary(s);
    setCapital(cap.totalCapital);
    setShares(cap.shares);
    setSettle(settlement);
    setSaleSum(sale);
    setProjectDocs(docs);
    setMilestones(await listMilestones(projectId));
    setStageCheck(await checkNextStage(projectId));
    const prop = props[0] ?? null;
    setProperty(prop);
    setPropertyDocs(prop ? await listDocuments('property', prop.id) : []);
    const pmts = prop ? await listPropertyPayments(prop.id) : [];
    const info: Partial<Record<'TOKEN' | 'BAYANA', { amount: number; receipt: string | null }>> = {};
    for (const p of pmts) {
      if (p.type === 'TOKEN' || p.type === 'BAYANA') {
        const rdocs = await listDocuments('property_payment', p.id);
        info[p.type] = { amount: p.amount, receipt: rdocs[0]?.file_uri ?? null };
      }
    }
    setPayInfo(info);
    const acq = prop ? await getAcquisitionSummary(prop.id) : null;
    setStats({
      acqPaid: acq?.totalPaid ?? 0,
      acqPrice: acq?.agreedPrice ?? 0,
      constrTotal: constr.total,
      saleOutstanding: sale.sale ? sale.outstanding : null,
      docsCount: docs.length,
    });
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
      listInvestors().then(setAllInvestors).catch(() => undefined);
    }, [load])
  );

  // Each step owns its own inputs — clear the draft payment/receipt/sale fields
  // whenever a different stage drawer opens so one step's data never shows in
  // another. (Recorded values are re-read per stage from `payInfo` in `load`.)
  useEffect(() => {
    setPayAmount(0);
    setPayReceipt(null);
    setPayMode('CASH');
    setSaleAgreed(0);
  }, [sheetStage]);

  const openAttach = () => {
    setDraftInvId(null);
    setDraftInvName('');
    setDraftInvAmount(0);
    setDraftInvPct(defaultPct);
    setAttachOpen(true);
  };

  const confirmAttach = async () => {
    if (!draftInvName.trim() || draftInvAmount <= 0) return;
    setBusy(true);
    try {
      const investorId = draftInvId ?? (await addInvestor({ name: draftInvName.trim() })).id;
      await addProjectInvestor({ projectId, investorId, committedAmount: draftInvAmount, profitPct: draftInvPct });
      await addInvestment({ investorId, projectId, amount: draftInvAmount, date: todayISO(), mode: 'CASH' });
      setAttachOpen(false);
      await load();
      await refreshProjects();
    } finally {
      setBusy(false);
    }
  };

  const addProjectDoc = async () => {
    setBusy(true);
    try {
      const uri = await pickDocumentImage();
      if (uri) {
        await addDocument({ entityType: 'project', entityId: projectId, label: 'docOther', fileUri: uri });
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  // Attach a required document (e.g. Fard / NDC / Registry) to the property.
  const uploadStageDoc = async (label: TranslationKey) => {
    if (!property) return;
    setUploadingDoc(true);
    try {
      const uri = await pickDocumentImage();
      if (uri) {
        await addDocument({ entityType: 'property', entityId: property.id, label, fileUri: uri });
        await load();
      }
    } finally {
      setUploadingDoc(false);
    }
  };


  /* ---- per-stage drawer input handlers (all stay in the drawer) ---------- */
  /**
   * The single "Save & continue" action for a step's drawer: record the data
   * entered for this step (token/bayana payment; auto-set transfer date for
   * possession), then advance the project into this stage if the requirements
   * are met. If blocked, stay open and surface the reason.
   */
  const saveAndAdvance = async (stage: ProjectStage, payType: 'TOKEN' | 'BAYANA' | null) => {
    setBusy(true);
    try {
      if (payType && payAmount > 0 && property) {
        await addAcquisitionPayment({
          propertyId: property.id,
          projectId,
          type: payType,
          amount: payAmount,
          date: todayISO(),
          mode: payMode,
          receiptUri: payReceipt,
        });
        setPayAmount(0);
        setPayReceipt(null);
      }
      // Transfer date is captured when completing the Transfer step.
      if (stage === 'TRANSFER' && property && !property.transfer_date) {
        await setTransferDate(property.id, todayISO());
      }
      const check = await checkNextStage(projectId);
      if (check.ok) {
        await moveProjectToNextStage(projectId);
        setSheetStage(null);
      }
      await load();
      await refreshProjects();
      if (!check.ok) setStageCheck(check);
    } finally {
      setBusy(false);
    }
  };

  const toggleMilestone = async (m: MilestoneRow) => {
    setBusy(true);
    try {
      const done = m.status === 'DONE';
      await setMilestoneStatus(m.id, done ? 'PENDING' : 'DONE', done ? null : todayISO());
      await load();
      await refreshProjects();
    } finally {
      setBusy(false);
    }
  };

  const recordSaleReceipt = async () => {
    if (payAmount <= 0) return;
    setBusy(true);
    try {
      const price = saleAgreed || saleSum?.sale?.agreed_price || 0;
      const s = await upsertSale(projectId, { agreedPrice: price });
      await addSaleReceipt({ saleId: s.id, amount: payAmount, date: todayISO(), mode: payMode });
      setPayAmount(0);
      await load();
      await refreshProjects();
    } finally {
      setBusy(false);
    }
  };

  const saveSalePrice = async () => {
    if (saleAgreed <= 0) return;
    setBusy(true);
    try {
      await upsertSale(projectId, { agreedPrice: saleAgreed });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const doSettle = async () => {
    setBusy(true);
    try {
      await settleProject(projectId);
      setSheetStage(null);
      await load();
      await refreshProjects();
    } finally {
      setBusy(false);
    }
  };

  if (!summary) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('projects')} onBack={() => navigation.goBack()} />
      </View>
    );
  }

  const { project, totalIn, totalOut, progressPercent } = summary;
  const currentIndex = stageIndex(project.stage);
  const readOnly = project.stage === 'CLOSED' || project.status === 'COMPLETED';
  // Real construction progress; a completed project always reads 100%.
  const shownProgress = readOnly ? 100 : Math.round(progressPercent);
  // Real lifecycle progress: how far the project has moved through the stages.
  const lastStageIdx = PROJECT_STAGES.length - 1;
  const stageProgress = readOnly ? 100 : Math.round((currentIndex / lastStageIdx) * 100);
  const net = totalIn - totalOut;

  const locationParts: string[] = [];
  if (property?.society) locationParts.push(property.society);
  if (property?.block && property?.plot_no) locationParts.push(`${property.block}-${property.plot_no}`);
  else if (property?.plot_no) locationParts.push(property.plot_no);
  if (property?.size_value && property?.size_unit) locationParts.push(`${property.size_value} ${t(UNIT_KEY[property.size_unit])}`);
  const location = locationParts.join('  ·  ');

  // Status of a stage by its pipeline index vs. where the project is now.
  const stageStatus = (i: number): Status =>
    readOnly || i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'pending';

  // Color of the line segment leading into the NEXT node (done→green,
  // current→dark, pending→grey), matching a clean progress tracker.
  const lineTone = (s: Status): ColorKey =>
    s === 'done' ? 'success' : s === 'active' ? 'primary' : 'border';

  // Status of a whole phase, from where the project currently is.
  const phaseStatus = (p: (typeof PHASES)[number]): Status =>
    readOnly || currentIndex > p.hi ? 'done' : currentIndex >= p.lo ? 'active' : 'pending';

  // Which phase is expanded — defaults to the one the project is currently in.
  const activePhaseKey =
    PHASES.find((p) => currentIndex >= p.lo && currentIndex <= p.hi)?.key ?? PHASES[0].key;
  const expandedPhase = openPhase === null ? activePhaseKey : openPhase;

  // Progress tracker: three collapsible phases; expand one to reveal every
  // sub-stage. Tap a sub-stage to open its detail / input sheet.
  const timeline = (
    <AppCard style={styles.progressCard}>
      <AppText size="lg" weight="bold" style={styles.progressHeading}>
        {t('progressTitle')}
      </AppText>
      {PHASES.map((p, pi) => {
        const status = phaseStatus(p);
        const isLastPhase = pi === PHASES.length - 1;
        const open = expandedPhase === p.key;
        const stages = PROJECT_STAGES.slice(p.lo, p.hi + 1);
        const doneInPhase = readOnly ? stages.length : Math.min(stages.length, Math.max(0, currentIndex - p.lo));
        return (
          <View key={p.key}>
            {/* phase header — tap to collapse / expand */}
            <Pressable
              onPress={() => setOpenPhase(open ? 'none' : p.key)}
              accessibilityRole="button"
              accessibilityLabel={`${t(p.labelKey)} — ${t(status === 'done' ? 'statusDone' : status === 'active' ? 'statusCurrent' : 'statusPending')}`}
              style={({ pressed }) => [styles.stepRow, pressed && styles.pressed]}
            >
              <View style={styles.rail}>
                <View
                  style={[
                    styles.node,
                    status === 'done' && { backgroundColor: theme.colors.success },
                    status === 'active' && { backgroundColor: theme.colors.primary },
                    status === 'pending' && styles.nodePending,
                  ]}
                >
                  {status === 'done' ? <AppIcon name="check" size={16} color="onHero" strokeWidth={3} /> : null}
                </View>
                {!isLastPhase ? (
                  <View style={[styles.railLine, { backgroundColor: theme.colors[lineTone(phaseStatus(PHASES[pi + 1]))] }]} />
                ) : null}
              </View>

              <View style={[styles.stepBody, !isLastPhase && styles.stepBodyGap]}>
                <AppText size="md" weight="bold" numberOfLines={1} color={status === 'pending' ? 'textSecondary' : 'textPrimary'}>
                  {t(p.labelKey)}
                </AppText>
                <AppText size="sm" color="textSecondary" numberOfLines={1} style={styles.stepDesc}>
                  {`${doneInPhase} / ${stages.length} · ${t('stagesTitle')}`}
                </AppText>
              </View>

              <View style={styles.stepRight}>
                {status !== 'pending' ? (
                  <View style={[styles.pill, status === 'done' ? styles.pillDone : styles.pillNow]}>
                    <AppText size="xs" weight="bold" color={status === 'done' ? 'success' : 'textPrimary'}>
                      {t(status === 'done' ? 'statusDone' : 'statusCurrent')}
                    </AppText>
                  </View>
                ) : null}
                <View style={[styles.chevron, open && styles.chevronOpen]}>
                  <AppIcon name="forward" size={18} color="textSecondary" />
                </View>
              </View>
            </Pressable>

            {/* sub-stages — revealed when the phase is expanded */}
            {open ? (
              <View style={styles.subList}>
                {stages.map((stage, si) => {
                  const gi = p.lo + si;
                  const sStatus = stageStatus(gi);
                  // Open the current + the next (to-do) stage; lock anything further
                  // ahead, and CLOSED (which is reached only via settlement).
                  const locked = !readOnly && gi > currentIndex;
                  return (
                    <Pressable
                      key={stage}
                      onPress={() => setSheetStage(gi)}
                      disabled={locked}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: locked }}
                      accessibilityLabel={t(PROJECT_STAGE_LABEL[stage])}
                      style={({ pressed }) => [styles.subRow, locked && styles.subRowLocked, pressed && styles.pressed]}
                    >
                      <View
                        style={[
                          styles.subDot,
                          sStatus === 'done' && { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
                          sStatus === 'active' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                        ]}
                      />
                      <AppText
                        size="sm"
                        weight={sStatus === 'active' ? 'bold' : 'regular'}
                        color={locked ? 'textSecondary' : 'textPrimary'}
                        numberOfLines={1}
                        style={styles.flex}
                      >
                        {t(PROJECT_STAGE_LABEL[stage])}
                      </AppText>
                      {sStatus === 'done' ? (
                        <AppText size="xs" weight="bold" color="success">
                          {t('statusDone')}
                        </AppText>
                      ) : sStatus === 'active' ? (
                        <AppText size="xs" weight="bold" color="textPrimary">
                          {t('statusCurrent')}
                        </AppText>
                      ) : locked ? (
                        <AppIcon name="lock" size={15} color="textSecondary" />
                      ) : (
                        <AppIcon name="forward" size={16} color="textSecondary" />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </AppCard>
  );

  // Investors section — how many are involved, each tappable to their profile.
  const investorsSection = (
    <View>
      <View style={styles.sectionHeadRow}>
        <AppText size="lg" weight="bold" style={styles.flex}>
          {`${t('investors')} · ${shares.length}`}
        </AppText>
        {!readOnly ? (
          <Pressable
            onPress={openAttach}
            hitSlop={theme.touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('addInvestor')}
            style={({ pressed }) => [styles.headAction, pressed && styles.pressed]}
          >
            <AppIcon name="add" size={18} color="primary" />
            <AppText size="sm" weight="bold" color="primary">
              {t('addInvestor')}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {shares.length === 0 ? (
        <AppText size="sm" color="textSecondary" style={styles.tapHint}>
          {t('noInvestorsYet')}
        </AppText>
      ) : (
        <AppCard>
          {shares.map((sh, idx) => (
            <React.Fragment key={sh.projectInvestorId}>
              {idx > 0 ? <View style={styles.sDivider} /> : null}
              <Pressable
                onPress={() => navigation.navigate('InvestorProfile', { investorId: sh.investorId })}
                accessibilityRole="button"
                accessibilityLabel={sh.name || t('investor')}
                style={({ pressed }) => [styles.investorRow, pressed && styles.pressed]}
              >
                <View style={[styles.investorAvatar, { backgroundColor: softToneColor(theme, 'gold') }]}>
                  <AppIcon name="investor" size={18} color="gold" />
                </View>
                <View style={styles.flex}>
                  <AppText size="sm" weight="bold" numberOfLines={1}>
                    {sh.name || t('investor')}
                  </AppText>
                  <AppText size="xs" color="textSecondary">
                    {`${t('ownershipPct')}: ${sh.ownershipPct.toFixed(1)}%`}
                  </AppText>
                </View>
                <AppText size="sm" weight="bold" color="gold" tabular>
                  {formatRupees(sh.capital)}
                </AppText>
                <AppIcon name="forward" size={18} color="textSecondary" />
              </Pressable>
            </React.Fragment>
          ))}
        </AppCard>
      )}
    </View>
  );

  // Project documents tool (full-width) — opens the docs drawer.
  const docsTool = (
    <ToolCard
      icon="document"
      tone="primary"
      label={t('tabDocs')}
      caption={String(stats.docsCount)}
      onPress={() => setDocsOpen(true)}
      styles={styles}
      theme={theme}
    />
  );

  // Full completion summary: project totals, each investor's P&L, owner residual.
  const plColor = (v: number): ColorKey => (v >= 0 ? 'success' : 'danger');
  const summaryBlock = (
    <View style={styles.summaryWrap}>
      <AppText size="lg" weight="bold" style={styles.sectionHeading}>
        {t('projectSummary')}
      </AppText>
      <AppCard>
        <SummaryRow label={t('invested')} value={formatRupees(settle?.investorsInvested ?? capital)} styles={styles} />
        <View style={styles.sDivider} />
        <SummaryRow label={t('revenue')} value={formatRupees(settle?.revenue ?? totalIn)} color="success" styles={styles} />
        <View style={styles.sDivider} />
        <SummaryRow label={t('totalExpenses')} value={formatRupees(settle?.expenses ?? totalOut)} color="danger" styles={styles} />
        <View style={styles.sDivider} />
        <SummaryRow
          label={settle && !settle.isProfit ? t('netLoss') : t('netProfit')}
          value={formatRupees(settle?.net ?? net)}
          color={plColor(settle?.net ?? net)}
          bold
          styles={styles}
        />
      </AppCard>

      {settle && (settle.investors.length > 0 || settle.owner.invested > 0) ? (
        <>
          <AppText size="lg" weight="bold" style={styles.sectionHeading}>
            {t('investorDetails')}
          </AppText>
          <AppCard>
            {settle.investors.map((row, idx) => (
              <React.Fragment key={row.investorId}>
                {idx > 0 ? <View style={styles.sDivider} /> : null}
                <Pressable
                  onPress={() => navigation.navigate('InvestorProfile', { investorId: row.investorId })}
                  accessibilityRole="button"
                  accessibilityLabel={row.name || t('investor')}
                  style={({ pressed }) => [styles.investorRow, pressed && styles.pressed]}
                >
                  <View style={[styles.investorAvatar, { backgroundColor: softToneColor(theme, 'gold') }]}>
                    <AppIcon name="investor" size={18} color="gold" />
                  </View>
                  <View style={styles.flex}>
                    <AppText size="sm" weight="bold" numberOfLines={1}>
                      {row.name || t('investor')}
                    </AppText>
                    <AppText size="xs" color="textSecondary">
                      {`${t('invested')}: ${formatRupees(row.invested)} · ${row.profitPct}%`}
                    </AppText>
                  </View>
                  <View style={styles.plCol}>
                    <AppText size="sm" weight="bold" color={plColor(row.profitOrLoss)} tabular>
                      {`${row.profitOrLoss >= 0 ? '+' : '−'}${formatRupees(Math.abs(row.profitOrLoss))}`}
                    </AppText>
                    <AppText size="xs" color="textSecondary" tabular>
                      {formatRupees(row.invested + row.profitOrLoss)}
                    </AppText>
                  </View>
                  <AppIcon name="forward" size={18} color="textSecondary" />
                </Pressable>
              </React.Fragment>
            ))}
            {/* Owner residual */}
            <View style={styles.sDivider} />
            <View style={styles.investorRow}>
              <View style={[styles.investorAvatar, { backgroundColor: softToneColor(theme, 'primary') }]}>
                <AppIcon name="project" size={18} color="primary" />
              </View>
              <View style={styles.flex}>
                <AppText size="sm" weight="bold" numberOfLines={1}>
                  {t('owner')}
                </AppText>
                <AppText size="xs" color="textSecondary">
                  {`${t('invested')}: ${formatRupees(settle.owner.invested)}`}
                </AppText>
              </View>
              <AppText size="sm" weight="bold" color={plColor(settle.owner.profitOrLoss)} tabular>
                {`${settle.owner.profitOrLoss >= 0 ? '+' : '−'}${formatRupees(Math.abs(settle.owner.profitOrLoss))}`}
              </AppText>
            </View>
          </AppCard>
        </>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <AppHeader
        title={project.name}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'ledger', onPress: () => navigation.navigate('Transactions', { projectId }), accessibilityLabel: t('transactions') }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {readOnly ? (
          <View style={styles.banner}>
            <AppIcon name="check" size={16} color="onPrimary" strokeWidth={2.6} />
            <AppText size="sm" weight="bold" color="onPrimary" style={styles.flex}>
              {t('closedBanner')}
            </AppText>
          </View>
        ) : null}

        {/* Status hero — dark "live" card: stage pill, big progress, ring. */}
        <View style={styles.heroDark}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <AppText size="overline" weight="bold" color="onHero" style={styles.liveText}>
              {t(PROJECT_STAGE_LABEL[project.stage]).toUpperCase()}
            </AppText>
          </View>
          <View style={styles.heroMain}>
            <View style={styles.flex}>
              <AppText size="sm" color="onPrimaryMuted">
                {t('progressTitle')}
              </AppText>
              <AppText weight="bold" color="onHero" style={styles.heroBig} tabular>
                {stageProgress}%
              </AppText>
              <View style={styles.heroBar}>
                <View style={[styles.heroBarFill, { width: `${stageProgress}%` }]} />
              </View>
            </View>
            <ProgressRing percent={stageProgress} theme={theme} styles={styles} />
          </View>

          {/* Income / Expense totals live inside the hero now. */}
          <View style={styles.heroMoneyRow}>
            <View style={styles.flex}>
              <AppText size="xs" color="onPrimaryMuted">
                {t('totalAamdani')}
              </AppText>
              <AppText size="lg" weight="bold" color="success" tabular numberOfLines={1}>
                {formatRupees(totalIn)}
              </AppText>
            </View>
            <View style={styles.heroMoneyDivider} />
            <View style={styles.flex}>
              <AppText size="xs" color="onPrimaryMuted">
                {t('totalLagat')}
              </AppText>
              <AppText size="lg" weight="bold" color="danger" tabular numberOfLines={1}>
                {formatRupees(totalOut)}
              </AppText>
            </View>
          </View>
        </View>

        {readOnly ? (
          <>
            {/* Completed: summary + investors first, the journey behind a toggle. */}
            {summaryBlock}
            <AppButton
              label={showTimeline ? t('hideTimeline') : t('viewTimeline')}
              icon="activity"
              variant="secondary"
              onPress={() => setShowTimeline((v) => !v)}
            />
            {showTimeline ? (
              <View>
                <AppText size="sm" color="textSecondary" center style={styles.tapHint}>
                  {t('tapStageHint')}
                </AppText>
                {timeline}
              </View>
            ) : null}
          </>
        ) : (
          <>
            {/* In progress: one "+" entry button, the journey, investors, docs. */}
            <AppButton label={t('add')} icon="add" onPress={() => setEntryOpen(true)} />

            {timeline}

            {investorsSection}
            {docsTool}
          </>
        )}
      </ScrollView>

      {/* Single "+" entry chooser: Income / Expense / Investment */}
      <Modal visible={entryOpen} transparent animationType="slide" onRequestClose={() => setEntryOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEntryOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold" center style={styles.sheetTitle}>
            {t('add')}
          </AppText>
          <EntryOption
            icon="moneyIn"
            tone="success"
            label={t('aamdani')}
            onPress={() => {
              setEntryOpen(false);
              navigation.navigate('Entry', { direction: 'IN', prefill: { projectId } });
            }}
            styles={styles}
            theme={theme}
          />
          <EntryOption
            icon="moneyOut"
            tone="danger"
            label={t('kharcha')}
            onPress={() => {
              setEntryOpen(false);
              navigation.navigate('Entry', { direction: 'OUT', prefill: { projectId } });
            }}
            styles={styles}
            theme={theme}
          />
          <EntryOption
            icon="investor"
            tone="gold"
            label={t('addInvestment')}
            onPress={() => {
              setEntryOpen(false);
              navigation.navigate('Investment');
            }}
            styles={styles}
            theme={theme}
          />
        </View>
      </Modal>

      {/* Per-stage detail + input sheet (slides up from the bottom) */}
      <Modal
        visible={sheetStage !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetStage(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSheetStage(null)} />
        {sheetStage !== null
          ? (() => {
              const i = sheetStage;
              const stage = PROJECT_STAGES[i];
              const sStatus = stageStatus(i);
              const grp = phaseForStage(i);
              const reqDoc = STAGE_DOC[stage];
              const attachedDoc = reqDoc ? propertyDocs.find((d) => d.label === reqDoc) : undefined;
              const isActive = !readOnly && i === currentIndex;
              const payType: 'TOKEN' | 'BAYANA' | null =
                stage === 'TOKEN_PAID' ? 'TOKEN' : stage === 'BAYANA_PAID' ? 'BAYANA' : null;
              const isConstruction = stage === 'CONSTRUCTION' || stage === 'FINISHING';
              const isSale = stage === 'LISTED_FOR_SALE';

              // Step position within its phase (e.g. "Buying · 1/4").
              const phaseDef = PHASES.find((p) => i >= p.lo && i <= p.hi) ?? PHASES[0];
              const stepNum = i - phaseDef.lo + 1;
              const stepTotal = phaseDef.hi - phaseDef.lo + 1;

              // Read mode = a finished (past) step; otherwise the active step is editable.
              const readMode = sStatus === 'done';
              const recorded = payType ? payInfo[payType] : undefined;
              const paymentDone = !!recorded;

              // Validation: the active step's "Save & continue" gate.
              const paymentReady = paymentDone || (payAmount > 0 && !!payReceipt);
              const docReady = !reqDoc || !!attachedDoc;
              const canSave = isActive
                ? (!payType || paymentReady) && docReady && (stage !== 'FINISHING' || shownProgress > 0)
                : false;
              // Re-mount the sheet body when the image-bearing data changes so a
              // just-picked receipt / document appears immediately (Android keeps
              // a Modal's children stale after returning from the picker activity).
              const sheetKey = `${i}:${payReceipt ?? ''}:${attachedDoc?.file_uri ?? ''}:${recorded?.receipt ?? ''}`;
              return (
                <View key={sheetKey} style={[styles.stageSheet, { paddingBottom: insets.bottom + theme.spacing.md }]}>
                  <View style={styles.grabber} />

                  {/* Header — title left; phase + step shown as a tag on the right */}
                  <View style={styles.sheetHead}>
                    <AppText size="xl" weight="bold" numberOfLines={1} style={styles.flex}>
                      {t(PROJECT_STAGE_LABEL[stage])}
                    </AppText>
                    <View style={styles.stepTag}>
                      <AppText size="xs" weight="bold" color="textSecondary">
                        {`${t(grp.labelKey)} · ${stepNum}/${stepTotal}`}
                      </AppText>
                    </View>
                  </View>

                  {/* Scrollable middle */}
                  <ScrollView
                    style={styles.stageBody}
                    contentContainerStyle={styles.stageBodyContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {isActive ? (
                      <AppText size="sm" color="textSecondary">{t(STAGE_DESC[stage])}</AppText>
                    ) : null}

                    {/* READ MODE — payment step: big amount + the two images */}
                    {readMode && payType && recorded ? (
                      <>
                        <View style={styles.readAmountWrap}>
                          <AppText size="sm" color="textSecondary">{t(payType === 'TOKEN' ? 'ptToken' : 'ptBayana')}</AppText>
                          <AppText weight="bold" tabular style={styles.readAmount}>{formatRupees(recorded.amount)}</AppText>
                        </View>
                        {recorded.receipt || attachedDoc ? (
                          <View style={styles.tileRow}>
                            {recorded.receipt ? (
                              <DocTile uri={recorded.receipt} title={t('photoReceipt')} onPress={() => setViewerUri(recorded.receipt)} styles={styles} theme={theme} />
                            ) : null}
                            {attachedDoc ? (
                              <DocTile uri={attachedDoc.file_uri} title={reqDoc ? t(reqDoc) : t('tabDocs')} onPress={() => setViewerUri(attachedDoc.file_uri)} styles={styles} theme={theme} />
                            ) : null}
                          </View>
                        ) : null}
                      </>
                    ) : null}

                    {/* READ MODE — document-only step: the image */}
                    {readMode && !payType && attachedDoc ? (
                      <View style={styles.tileRow}>
                        <DocTile uri={attachedDoc.file_uri} title={reqDoc ? t(reqDoc) : t('tabDocs')} onPress={() => setViewerUri(attachedDoc.file_uri)} styles={styles} theme={theme} />
                      </View>
                    ) : null}

                    {/* READ MODE — figures (construction / sale / transfer) */}
                    {readMode && (isConstruction || (isSale && saleSum?.sale) || (stage === 'TRANSFER' && property?.transfer_date)) ? (
                      <View style={styles.sheetGroup}>
                        {isConstruction ? (
                          <View style={styles.sheetRow}>
                            <AppText size="sm" color="textSecondary">{t('constructionCost')}</AppText>
                            <AppText size="sm" weight="bold" tabular>{formatRupees(stats.constrTotal)}</AppText>
                          </View>
                        ) : null}
                        {isSale && saleSum?.sale ? (
                          <View style={styles.sheetRow}>
                            <AppText size="sm" color="textSecondary">{t('outstanding')}</AppText>
                            <AppText size="sm" weight="bold" tabular>{formatRupees(saleSum.outstanding)}</AppText>
                          </View>
                        ) : null}
                        {stage === 'TRANSFER' && property?.transfer_date ? (
                          <View style={styles.sheetRow}>
                            <AppText size="sm" color="textSecondary">{t('transferDate')}</AppText>
                            <AppText size="sm" weight="bold">{property.transfer_date}</AppText>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {/* INPUT — payment step: amount, mode, then receipt + document tiles */}
                    {isActive && payType ? (
                      <>
                        <AmountInput floating surface={theme.colors.card} label={t(payType === 'TOKEN' ? 'ptToken' : 'ptBayana')} value={payAmount} onChange={setPayAmount} />
                        <ModeChips mode={payMode} onPick={setPayMode} t={t} styles={styles} theme={theme} />
                        <View style={styles.tileRow}>
                          <DocTile
                            uri={payReceipt}
                            title={t('photoReceipt')}
                            onPress={
                              payReceipt
                                ? () => setViewerUri(payReceipt)
                                : async () => {
                                    const u = await pickDocumentImage();
                                    if (u) setPayReceipt(u);
                                  }
                            }
                            styles={styles}
                            theme={theme}
                          />
                          {reqDoc ? (
                            <DocTile
                              uri={attachedDoc?.file_uri}
                              title={t(reqDoc)}
                              loading={uploadingDoc}
                              onPress={attachedDoc ? () => setViewerUri(attachedDoc.file_uri) : () => uploadStageDoc(reqDoc)}
                              styles={styles}
                              theme={theme}
                            />
                          ) : null}
                        </View>
                      </>
                    ) : null}

                    {/* INPUT — document-only step (transfer / possession) */}
                    {isActive && !payType && reqDoc && !isConstruction && !isSale ? (
                      <View style={styles.tileRow}>
                        <DocTile
                          uri={attachedDoc?.file_uri}
                          title={t(reqDoc)}
                          loading={uploadingDoc}
                          onPress={attachedDoc ? () => setViewerUri(attachedDoc.file_uri) : () => uploadStageDoc(reqDoc)}
                          styles={styles}
                          theme={theme}
                        />
                      </View>
                    ) : null}

                    {/* INPUT — construction milestones */}
                    {isActive && isConstruction && milestones.length > 0 ? (
                      <View style={styles.sheetGroup}>
                        <AppText size="overline" weight="bold" color="textSecondary" style={styles.sheetGroupLabel}>
                          {t('milestonesTitle')}
                        </AppText>
                        {milestones.map((m) => {
                          const done = m.status === 'DONE';
                          return (
                            <Pressable
                              key={m.id}
                              onPress={() => toggleMilestone(m)}
                              disabled={busy}
                              accessibilityRole="button"
                              accessibilityState={{ checked: done }}
                              accessibilityLabel={m.name}
                              style={({ pressed }) => [styles.msRow, pressed && styles.pressed]}
                            >
                              <AppIcon name={done ? 'checkCircle' : 'dotNext'} size={20} color={done ? 'success' : 'textSecondary'} />
                              <AppText size="sm" weight={done ? 'bold' : 'regular'} style={styles.flex} numberOfLines={1}>
                                {m.name}
                              </AppText>
                              <AppText size="xs" color="textSecondary" tabular>{`${m.pct_weight}%`}</AppText>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}

                    {/* INPUT — sale */}
                    {isActive && isSale ? (
                      <View style={styles.sheetGroup}>
                        <AppText size="overline" weight="bold" color="textSecondary" style={styles.sheetGroupLabel}>
                          {t('tabSale')}
                        </AppText>
                        {!saleSum?.sale ? (
                          <>
                            <AmountInput floating surface={theme.colors.card} label={t('agreedPrice')} value={saleAgreed} onChange={setSaleAgreed} />
                            <AppButton label={t('save')} icon="check" loading={busy} disabled={saleAgreed <= 0} onPress={saveSalePrice} />
                          </>
                        ) : (
                          <>
                            <AmountInput floating surface={theme.colors.card} label={t('addReceipt')} value={payAmount} onChange={setPayAmount} />
                            <ModeChips mode={payMode} onPick={setPayMode} t={t} styles={styles} theme={theme} />
                            <AppButton label={t('addReceipt')} icon="check" variant="secondary" loading={busy} disabled={payAmount <= 0} onPress={recordSaleReceipt} />
                            <AppButton label={t('settleTitle')} icon="balance" loading={busy} onPress={doSettle} />
                          </>
                        )}
                      </View>
                    ) : null}
                  </ScrollView>

                  {/* Footer — fixed at bottom, gated by validation */}
                  {isActive && !isSale && stage !== 'CLOSED' ? (
                    <View style={styles.stageFooter}>
                      {!canSave ? (
                        <AppText size="xs" color="textSecondary" center style={styles.footerHint}>
                          {t('fillRequired')}
                        </AppText>
                      ) : null}
                      <AppButton
                        label={t('saveAndNext')}
                        icon="forward"
                        loading={busy}
                        disabled={!canSave}
                        onPress={() => saveAndAdvance(stage, payType)}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })()
          : null}
      </Modal>

      {/* Attach-investor sheet (existing investor or new) — no navigation */}
      <Modal visible={attachOpen} transparent animationType="slide" onRequestClose={() => setAttachOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAttachOpen(false)} />
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + theme.spacing.lg }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold" center>
            {t('addInvestor')}
          </AppText>
          {allInvestors.length > 0 ? (
            <>
              <AppText size="sm" weight="semibold" color="textSecondary">
                {t('selectInvestor')}
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
                {allInvestors.map((inv) => {
                  const selected = draftInvId === inv.id;
                  return (
                    <Pressable
                      key={inv.id}
                      onPress={() => {
                        setDraftInvId(inv.id);
                        setDraftInvName(inv.name);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={inv.name}
                      style={[styles.existChip, selected && { backgroundColor: theme.colors.primary }]}
                    >
                      <AppIcon name="investor" size={16} color={selected ? 'onPrimary' : 'primary'} />
                      <AppText size="sm" weight="bold" color={selected ? 'onPrimary' : 'textPrimary'} numberOfLines={1}>
                        {inv.name}
                      </AppText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}
          <FloatingLabelInput
            label={t('newInvestor')}
            value={draftInvId ? '' : draftInvName}
            onChangeText={(v) => {
              setDraftInvId(null);
              setDraftInvName(v);
            }}
          />
          <AmountInput label={t('committedAmount')} value={draftInvAmount} onChange={setDraftInvAmount} />
          <View style={styles.sheetRow}>
            <AppText size="md" weight="semibold">{t('profitPct')}</AppText>
            <View style={styles.modeRow}>
              <Pressable onPress={() => setDraftInvPct((p) => Math.max(0, p - 5))} hitSlop={theme.touch.hitSlop} style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}>
                <AppText size="lg" weight="bold" color="primary">−</AppText>
              </Pressable>
              <AppText size="md" weight="bold" tabular style={styles.stepValue}>{draftInvPct}%</AppText>
              <Pressable onPress={() => setDraftInvPct((p) => Math.min(100, p + 5))} hitSlop={theme.touch.hitSlop} style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}>
                <AppText size="lg" weight="bold" color="primary">+</AppText>
              </Pressable>
            </View>
          </View>
          <AppButton label={t('add')} icon="check" loading={busy} disabled={!draftInvName.trim() || draftInvAmount <= 0} onPress={confirmAttach} />
        </ScrollView>
      </Modal>

      {/* Documents drawer — thumbnails, tap to view large */}
      <Modal visible={docsOpen} transparent animationType="slide" onRequestClose={() => setDocsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setDocsOpen(false)} />
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + theme.spacing.lg }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold" center>
            {t('tabDocs')}
          </AppText>
          {projectDocs.length === 0 ? (
            <AppText size="sm" color="textSecondary" center style={styles.tapHint}>
              {t('noDocs')}
            </AppText>
          ) : (
            <View style={styles.docGrid}>
              {projectDocs.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => setViewerUri(d.file_uri)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={d.label ? t(d.label as TranslationKey) : t('tabDocs')}
                  style={({ pressed }) => [styles.docThumbWrap, pressed && styles.pressed]}
                >
                  <Image source={{ uri: d.file_uri }} style={styles.docThumb} resizeMode="cover" />
                </Pressable>
              ))}
            </View>
          )}
          <AppButton label={t('addDocument')} icon="camera" loading={busy} onPress={addProjectDoc} />
        </ScrollView>
      </Modal>

      {/* Full-screen image viewer */}
      <Modal visible={viewerUri !== null} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewerUri(null)}>
          {viewerUri ? <Image source={{ uri: viewerUri }} style={styles.viewerImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * A document/image container: the image fills the box and its title sits in a
 * bar at the bottom. Acts as the picker when empty and the preview when filled
 * (tap → onPress). Sized to flex into a side-by-side row.
 */
function DocTile({
  uri,
  title,
  onPress,
  loading,
  styles,
  theme,
}: {
  uri: string | null | undefined;
  title: string;
  onPress: () => void;
  loading?: boolean;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="imagebutton"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.docTile, pressed && styles.pressed]}
    >
      <View style={[styles.docTileInner, !uri && styles.docTileEmpty]}>
        <View style={styles.docTileImgWrap}>
          {loading ? (
            <ActivityIndicator color={theme.colors.textSecondary} />
          ) : uri ? (
            <Image source={{ uri }} style={styles.docTileImg} resizeMode="cover" />
          ) : (
            <AppIcon name="camera" size={26} color="textSecondary" />
          )}
        </View>
        <AppText size="xs" weight="semibold" center numberOfLines={1} style={styles.docTileTitle}>
          {title}
        </AppText>
      </View>
    </Pressable>
  );
}

/** Payment-mode selector (Cash / Bank / JazzCash) for the in-drawer inputs. */
function ModeChips({
  mode,
  onPick,
  t,
  styles,
  theme,
}: {
  mode: PaymentMode;
  onPick: (m: PaymentMode) => void;
  t: (k: TranslationKey) => string;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}): React.JSX.Element {
  const MODES: { id: PaymentMode; labelKey: TranslationKey }[] = [
    { id: 'CASH', labelKey: 'modeCash' },
    { id: 'BANK', labelKey: 'modeBank' },
    { id: 'JAZZCASH', labelKey: 'modeJazzcash' },
  ];
  return (
    <View style={styles.modeRow}>
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <Pressable
            key={m.id}
            onPress={() => onPick(m.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(m.labelKey)}
            style={[styles.modeChip, active && { backgroundColor: theme.colors.primary }]}
          >
            <AppText size="sm" weight="bold" color={active ? 'onPrimary' : 'textSecondary'}>
              {t(m.labelKey)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Circular progress ring (white arc on a faint track) with a centred icon. */
function ProgressRing({
  percent,
  theme,
  styles,
}: {
  percent: number;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element {
  const size = 104;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, percent));
  const dash = (circ * p) / 100;
  const c = size / 2;
  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={theme.colors.onPrimaryDivider} strokeWidth={stroke} fill="none" />
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={theme.colors.onHero}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <AppIcon name="project" size={26} color="heroBg" />
      </View>
    </View>
  );
}

/** A soft-tinted pill action that opens the Entry flow for this project. */
/** A row option inside the "+" entry chooser sheet. */
function EntryOption({
  tone,
  icon,
  label,
  onPress,
  styles,
  theme,
}: {
  tone: 'success' | 'danger' | 'gold';
  icon: IconKey;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.entryOption, pressed && styles.pressed]}
    >
      <View style={[styles.entryIcon, { backgroundColor: softToneColor(theme, tone) }]}>
        <AppIcon name={icon} size={22} color={tone} />
      </View>
      <AppText size="md" weight="bold" style={styles.flex}>
        {label}
      </AppText>
      <AppIcon name="forward" size={20} color="textSecondary" />
    </Pressable>
  );
}

/** A compact "tool" card (Investors / Docs) — leading icon, label, count. */
function ToolCard({
  icon,
  tone,
  label,
  caption,
  onPress,
  styles,
  theme,
}: {
  icon: IconKey;
  tone: ColorKey;
  label: string;
  caption: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.toolCard, pressed && styles.pressed]}
    >
      <View style={[styles.toolChip, { backgroundColor: softToneColor(theme, tone) }]}>
        <AppIcon name={icon} size={22} color={tone} />
      </View>
      <View style={styles.flex}>
        <AppText size="md" weight="bold" numberOfLines={1}>
          {label}
        </AppText>
        <AppText size="xs" color="textSecondary">
          {caption}
        </AppText>
      </View>
      <AppIcon name="forward" size={20} color="textSecondary" />
    </Pressable>
  );
}

function SummaryRow({
  label,
  value,
  color = 'textPrimary',
  bold = false,
  styles,
}: {
  label: string;
  value: string;
  color?: ColorKey;
  bold?: boolean;
  styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element {
  return (
    <View style={styles.sRow}>
      <AppText size="sm" color="textSecondary" weight={bold ? 'bold' : 'regular'}>
        {label}
      </AppText>
      <AppText size={bold ? 'md' : 'sm'} weight="bold" color={color} tabular>
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
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
    },
    /* hero — dark "live" card with a circular progress ring */
    heroDark: {
      backgroundColor: theme.colors.heroBg,
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.lg,
      ...theme.shadows.raised,
    },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.onPrimaryChip,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 5,
      borderRadius: theme.radius.pill,
    },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.accent },
    liveText: { letterSpacing: theme.typography.tracking },
    heroMain: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg },
    heroBig: { fontSize: 46, lineHeight: 50, marginTop: 2 },
    heroBar: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.onPrimaryDivider,
      overflow: 'hidden',
      marginTop: theme.spacing.md,
    },
    heroBarFill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.onHero },
    heroMoneyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.onPrimaryDivider,
    },
    heroMoneyDivider: { width: 1, alignSelf: 'stretch', backgroundColor: theme.colors.onPrimaryDivider },
    ringWrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
    ringCenter: {
      position: 'absolute',
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.onHero,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    /* quick actions */
    quickActionsRow: { flexDirection: 'row', gap: theme.spacing.md },
    quickAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.touch.minTarget,
      borderRadius: theme.radius.card,
      paddingHorizontal: theme.spacing.lg,
    },
    /* section heading */
    sectionHeading: { marginTop: theme.spacing.sm },
    sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
    headAction: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    /* "+" entry chooser options */
    entryOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: theme.touch.minTarget,
      paddingHorizontal: theme.spacing.sm,
    },
    entryIcon: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /* progress tracker — one vertical rail of stage steps */
    progressCard: { gap: 0 },
    progressHeading: { marginBottom: theme.spacing.md },
    stepRow: { flexDirection: 'row' },
    rail: { width: 26, alignItems: 'center' },
    node: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.track,
      marginTop: 1,
    },
    nodePending: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    railLine: { flex: 1, width: 2, marginVertical: 4 },
    stepBody: { flex: 1, marginLeft: theme.spacing.md, gap: 3 },
    stepBodyGap: { paddingBottom: theme.spacing.xl },
    stepDesc: {},
    stepRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginLeft: theme.spacing.sm },
    pill: { paddingHorizontal: theme.spacing.sm, paddingVertical: 3, borderRadius: theme.radius.pill },
    pillDone: { backgroundColor: theme.colors.successSoft },
    pillNow: { backgroundColor: theme.colors.primarySoft },
    pillPending: { backgroundColor: theme.colors.track },
    chevron: { transform: [{ rotate: '0deg' }] },
    chevronOpen: { transform: [{ rotate: '90deg' }] },
    /* expanded sub-stage list */
    subList: {
      marginLeft: 12,
      borderLeftWidth: 2,
      borderLeftColor: theme.colors.track,
      paddingLeft: 24,
      paddingBottom: theme.spacing.lg,
      gap: theme.spacing.xs,
    },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: 42 },
    subRowLocked: { opacity: 0.5 },
    subDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: 'transparent',
    },
    /* stage sheet */
    sheetScroll: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '88%',
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      ...theme.shadows.raised,
    },
    sheetContent: { padding: theme.spacing.xl, gap: theme.spacing.md },
    /* stage sheet: fixed header + scrollable body + fixed footer */
    stageSheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '90%',
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.sm,
      ...theme.shadows.raised,
    },
    stageBody: { flexShrink: 1 },
    stageBodyContent: { gap: theme.spacing.md, paddingVertical: theme.spacing.md },
    stageFooter: {
      marginHorizontal: -theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    footerHint: { marginBottom: theme.spacing.sm },
    /* phase + step shown as a tag in the header */
    stepTag: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
    },
    /* read-mode big amount */
    readAmountWrap: { gap: 2, paddingVertical: theme.spacing.xs },
    readAmount: { fontSize: 40, lineHeight: 46 },
    /* document / receipt tile: image fills, title bar at the bottom */
    tileRow: { flexDirection: 'row', gap: theme.spacing.md },
    docTile: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.card,
      ...theme.shadows.card,
    },
    docTileInner: {
      flex: 1,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.background,
      overflow: 'hidden',
    },
    docTileEmpty: { borderWidth: 1.5, borderColor: theme.colors.border, borderStyle: 'dashed' },
    docTileImgWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    docTileImg: { width: '100%', height: '100%' },
    docTileTitle: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    sheetGroup: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    sheetGroupLabel: { letterSpacing: theme.typography.tracking },
    reqRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: 30 },
    sheetFooter: { gap: theme.spacing.sm, marginTop: theme.spacing.xs },
    sheetHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginTop: theme.spacing.xs },
    sheetDetail: { gap: theme.spacing.sm },
    sheetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    msRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: 40 },
    modeRow: { flexDirection: 'row', gap: theme.spacing.sm },
    modeChip: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.track,
    },
    existChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
      maxWidth: 200,
    },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepValue: { minWidth: 48, textAlign: 'center' },
    docGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    docThumbWrap: {
      width: '31%',
      aspectRatio: 1,
      borderRadius: theme.radius.md,
      overflow: 'hidden',
      backgroundColor: theme.colors.track,
    },
    docThumb: { width: '100%', height: '100%' },
    docPreview: {
      width: '100%',
      height: 170,
      borderRadius: theme.radius.md,
      overflow: 'hidden',
      backgroundColor: theme.colors.track,
    },
    docPreviewImg: { width: '100%', height: '100%' },
    viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
    viewerImage: { width: '100%', height: '85%' },
    sheetDocNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: softToneColor(theme, 'gold'),
      padding: theme.spacing.md,
      borderRadius: theme.radius.chip,
    },
    pressed: { opacity: 0.6 },
    /* tools */
    toolsRow: { flexDirection: 'row', gap: theme.spacing.md },
    toolCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.touch.minTarget,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      padding: theme.spacing.md,
      ...theme.shadows.card,
    },
    toolChip: { width: 40, height: 40, borderRadius: theme.radius.chip, alignItems: 'center', justifyContent: 'center' },
    /* whole-project summary */
    summaryWrap: { gap: theme.spacing.md },
    tapHint: { marginTop: theme.spacing.sm, marginBottom: theme.spacing.xs },
    sRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sDivider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.sm },
    investorRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    plCol: { alignItems: 'flex-end' },
    investorAvatar: { width: 38, height: 38, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
    blockNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: softToneColor(theme, 'danger'),
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
    },
    /* confirm sheet */
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
    sheetTitle: { marginTop: theme.spacing.xs },
    sheetBadge: { alignItems: 'center' },
    sheetButtons: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm },
  });
