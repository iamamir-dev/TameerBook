import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AmountInput,
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  SelectSheet,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import {
  addInvestor,
  type ExitScenario,
  exitInvestor,
  getInvestor,
  getProjectCapitalSummary,
  type InvestorParticipation,
  type InvestorRow,
  listInvestorParticipations,
  listProjectInvestors,
  type OwnershipShare,
  type ProjectInvestorRow,
} from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { computeExitPreview } from '@/utils/exitPreview';
import { exitReceiptHtml } from '@/utils/exporter';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ExitRoute = RouteProp<RootStackParamList, 'ExitWizard'>;

const SCENARIOS: { id: ExitScenario; labelKey: TranslationKey; icon: IconKey }[] = [
  { id: 'PARTNER_BUY', labelKey: 'scPartnerBuy', icon: 'investors' },
  { id: 'NEW_INVESTOR', labelKey: 'scNewInvestor', icon: 'investor' },
  { id: 'OWNER_BUY', labelKey: 'scOwnerBuy', icon: 'balance' },
  { id: 'PARTIAL', labelKey: 'scPartial', icon: 'moneyOut' },
  { id: 'COMMITTED_UNPAID', labelKey: 'scCommitted', icon: 'empty' },
];

export function ExitWizardScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { investorId } = useRoute<ExitRoute>().params;
  const styles = makeStyles(theme);
  const refreshProjects = useProjectsStore((s) => s.refresh);

  const [investor, setInvestor] = useState<InvestorRow | null>(null);
  const [parts, setParts] = useState<InvestorParticipation[]>([]);
  const [step, setStep] = useState(0);

  const [piId, setPiId] = useState<string | null>(null);
  const [shares, setShares] = useState<OwnershipShare[]>([]);
  const [pis, setPis] = useState<ProjectInvestorRow[]>([]);
  const [scenario, setScenario] = useState<ExitScenario | null>(null);
  const [valuation, setValuation] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [buyerPiId, setBuyerPiId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [portion, setPortion] = useState(0);
  const [buyerSheet, setBuyerSheet] = useState(false);

  const { saving, run: runSave } = useSaveAction();

  useEffect(() => {
    let cancelled = false;
    getInvestor(investorId)
      .then((row) => {
        if (!cancelled) setInvestor(row);
      })
      .catch(swallow('exitWizard:investor'));
    listInvestorParticipations(investorId)
      .then((p) => {
        if (cancelled) return;
        setParts(p);
        if (p.length === 1) setPiId(p[0].id);
      })
      .catch(swallow('exitWizard:participations'));
    return () => {
      cancelled = true;
    };
  }, [investorId]);

  const selectedPart = parts.find((p) => p.id === piId) ?? null;
  const selectedProjectId = selectedPart?.project_id ?? null;

  // Load the project's capital picture when a participation is chosen; clear
  // it when the selection goes away so stale rows never leak into the preview.
  useEffect(() => {
    if (!selectedProjectId) {
      setShares([]);
      setPis([]);
      return;
    }
    let cancelled = false;
    getProjectCapitalSummary(selectedProjectId)
      .then((s) => {
        if (!cancelled) setShares(s.shares);
      })
      .catch(swallow('exitWizard:capital'));
    listProjectInvestors(selectedProjectId)
      .then((rows) => {
        if (!cancelled) setPis(rows);
      })
      .catch(swallow('exitWizard:projectInvestors'));
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const leaverShare = shares.find((s) => s.projectInvestorId === piId) ?? null;
  const statusById = useMemo(() => new Map(pis.map((p) => [p.id, p.status])), [pis]);

  const partnerOptions: SelectOption[] = useMemo(
    () =>
      shares
        .filter((s) => s.projectInvestorId !== piId && statusById.get(s.projectInvestorId) === 'ACTIVE')
        .map((s) => ({ id: s.projectInvestorId, label: s.name, icon: 'investor' as IconKey })),
    [shares, piId, statusById]
  );

  // ---- before / after preview (pure math lives in utils/exitPreview) ----
  const { before, after } = useMemo(
    () =>
      computeExitPreview({
        shares,
        pis,
        leaverPiId: piId,
        scenario,
        portion,
        buyerPiId,
        newInvestorName: newName,
        ownerLabel: t('scOwnerBuy'),
        buyerFallbackLabel: t('buyer'),
      }),
    [shares, pis, piId, scenario, portion, buyerPiId, newName, t]
  );

  const canNext = useMemo((): boolean => {
    if (step === 0) return !!piId;
    if (step === 1) return !!scenario;
    if (step === 2) return valuation > 0 && agreed;
    if (step === 3) {
      if (scenario === 'PARTNER_BUY') return !!buyerPiId;
      if (scenario === 'NEW_INVESTOR') return newName.trim().length > 0;
      if (scenario === 'PARTIAL') return portion > 0 && portion <= (leaverShare?.capital ?? 0);
      return true;
    }
    return true;
  }, [step, piId, scenario, valuation, agreed, buyerPiId, newName, portion, leaverShare]);

  const goBack = () => (step === 0 ? navigation.goBack() : setStep((s) => s - 1));
  const goNext = () => setStep((s) => Math.min(4, s + 1));

  const sharePdf = async (buyerName: string, amount: number) => {
    if (!investor || !selectedPart) return;
    const html = exitReceiptHtml({
      projectName: selectedPart.projectName,
      investorName: investor.name,
      buyerName,
      amount,
      labels: {
        title: t('exitReceipt'),
        project: t('projects'),
        who: t('exitWho'),
        buyer: t('buyer'),
        value: t('exitValue'),
        date: t('date'),
        note: t('exitValueNote'),
      },
    });
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('exitReceipt') });
    }
  };

  const onConfirm = async () => {
    if (!selectedPart || !scenario || !leaverShare) return;
    let buyerName = t('scOwnerBuy');
    if (scenario === 'NEW_INVESTOR') {
      buyerName = newName.trim();
    } else if (scenario === 'PARTNER_BUY') {
      buyerName = shares.find((s) => s.projectInvestorId === buyerPiId)?.name ?? t('buyer');
    } else if (scenario === 'PARTIAL' || scenario === 'COMMITTED_UNPAID') {
      buyerName = '';
    }
    const amount = scenario === 'PARTIAL' ? portion : leaverShare.capital;
    const ok = await runSave(async () => {
      let newInvestorId: string | null = null;
      if (scenario === 'NEW_INVESTOR') {
        const created = await addInvestor({ name: newName.trim() });
        newInvestorId = created.id;
      }
      await exitInvestor({
        projectId: selectedPart.project_id,
        projectInvestorId: selectedPart.id,
        scenario,
        valuationAmount: valuation,
        date: todayISO().slice(0, 10),
        portionAmount: portion,
        buyerProjectInvestorId: buyerPiId,
        newInvestorId,
      });
      await refreshProjects();
    });
    if (!ok) return;
    // The exit is committed at this point — a share failure/cancel must not
    // make it look failed (double-exit risk), so the PDF is best-effort.
    await sharePdf(buyerName, amount).catch(swallow('exitWizard:sharePdf'));
    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('exitTitle')} subtitle={`${step + 1} / 5`} onBack={goBack} />
      <View style={styles.dots}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.dot, i === step ? styles.dotActive : i < step ? styles.dotDone : null]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Step 1  who + which project */}
        {step === 0 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('exitWho')}
            </AppText>
            {parts.map((p) => {
              const active = p.id === piId;
              return (
                <Pressable key={p.id} onPress={() => setPiId(p.id)} style={[styles.optCard, active && styles.optActive]} accessibilityRole="button">
                  <AppIcon name="project" size={20} color={active ? 'accent' : 'textSecondary'} />
                  <AppText size="md" weight="semibold" style={styles.flex}>
                    {p.projectName}
                  </AppText>
                  {active ? <AppIcon name="checkCircle" size={20} color="accent" /> : null}
                </Pressable>
              );
            })}
            {leaverShare ? (
              <AppCard>
                <AppText size="sm" color="textSecondary">
                  {investor?.name} · {selectedPart?.projectName}
                </AppText>
                <View style={styles.snapRow}>
                  <AppText size="sm">{t('paidInCapital')}</AppText>
                  <AppText size="md" weight="bold" tabular>
                    {formatRupees(leaverShare.capital)}
                  </AppText>
                </View>
                <View style={styles.snapRow}>
                  <AppText size="sm">{t('ownershipPct')}</AppText>
                  <AppText size="md" weight="bold" color="gold" tabular>
                    {leaverShare.ownershipPct.toFixed(1)}%
                  </AppText>
                </View>
              </AppCard>
            ) : null}
          </>
        ) : null}

        {/* Step 2  scenario */}
        {step === 1 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('exitScenario')}
            </AppText>
            {SCENARIOS.map((sc) => {
              const active = sc.id === scenario;
              return (
                <Pressable key={sc.id} onPress={() => setScenario(sc.id)} style={[styles.optCard, active && styles.optActive]} accessibilityRole="button">
                  <View style={[styles.scIcon, active && styles.scIconActive]}>
                    <AppIcon name={sc.icon} size={20} color={active ? 'onAccent' : 'primary'} />
                  </View>
                  <AppText size="md" weight="semibold" style={styles.flex}>
                    {t(sc.labelKey)}
                  </AppText>
                </Pressable>
              );
            })}
          </>
        ) : null}

        {/* Step 3  value + consent */}
        {step === 2 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('exitValue')}
            </AppText>
            <AmountInput value={valuation} onChange={setValuation} autoFocus />
            <View style={styles.noteBox}>
              <AppText size="sm" color="textSecondary">
                {t('exitValueNote')}
              </AppText>
            </View>
            <Pressable onPress={() => setAgreed((a) => !a)} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
              <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
                {agreed ? <AppIcon name="check" size={16} color="onPrimary" strokeWidth={2.6} /> : null}
              </View>
              <AppText size="sm" weight="semibold" style={styles.flex}>
                {t('confirmAgreed')}
              </AppText>
            </Pressable>
          </>
        ) : null}

        {/* Step 4  buyer / portion */}
        {step === 3 ? (
          <>
            {scenario === 'PARTNER_BUY' ? (
              <Pressable onPress={() => setBuyerSheet(true)} style={styles.optCard} accessibilityRole="button">
                <AppIcon name="investor" size={20} color="primary" />
                <AppText size="md" weight="semibold" style={styles.flex} color={buyerPiId ? 'textPrimary' : 'textSecondary'}>
                  {shares.find((s) => s.projectInvestorId === buyerPiId)?.name ?? t('buyer')}
                </AppText>
                <AppIcon name="forward" size={18} color="textSecondary" />
              </Pressable>
            ) : null}
            {scenario === 'NEW_INVESTOR' ? <FloatingLabelInput label={t('personName')} value={newName} onChangeText={setNewName} /> : null}
            {scenario === 'PARTIAL' ? (
              <>
                <AppText size="sm" color="textSecondary">
                  {t('paidInCapital')}: {formatRupees(leaverShare?.capital ?? 0)}
                </AppText>
                <AmountInput label={t('portionAmount')} value={portion} onChange={setPortion} autoFocus />
              </>
            ) : null}
            {scenario === 'OWNER_BUY' || scenario === 'COMMITTED_UNPAID' ? (
              <AppCard>
                <AppText size="sm" color="textSecondary">
                  {scenario === 'OWNER_BUY' ? t('scOwnerBuy') : t('scCommitted')}
                </AppText>
              </AppCard>
            ) : null}
          </>
        ) : null}

        {/* Step 5  review */}
        {step === 4 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('beforeLabel')} → {t('afterLabel')}
            </AppText>
            <AppCard compact>
              <View style={styles.tblHead}>
                <AppText size="xs" weight="bold" color="textSecondary" style={styles.flex}>
                  {t('investors')}
                </AppText>
                <AppText size="xs" weight="bold" color="textSecondary" style={styles.tblCol}>
                  {t('beforeLabel')}
                </AppText>
                <AppText size="xs" weight="bold" color="textSecondary" style={styles.tblCol}>
                  {t('afterLabel')}
                </AppText>
              </View>
              {after.map((a, i) => {
                // `after` preserves `before` order for existing rows (appended
                // buyer/owner rows come last) — match by index, never by name,
                // so same-name investors cannot collide.
                const b = i < before.length ? before[i] : undefined;
                return (
                  <View key={a.name + i} style={styles.tblRow}>
                    <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex}>
                      {a.name}
                    </AppText>
                    <AppText size="sm" color="textSecondary" tabular style={styles.tblCol}>
                      {(b?.ownership ?? 0).toFixed(1)}%
                    </AppText>
                    <AppText size="sm" weight="bold" color="gold" tabular style={styles.tblCol}>
                      {a.ownership.toFixed(1)}%
                    </AppText>
                  </View>
                );
              })}
            </AppCard>
            <View style={styles.noteBox}>
              <AppText size="sm" color="textSecondary">
                {t('exitValue')}: {formatRupees(valuation)}
              </AppText>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.flex}>
          <AppButton label={t('back')} icon="back" variant="secondary" onPress={goBack} />
        </View>
        <View style={styles.flex2}>
          {step < 4 ? (
            <AppButton label={t('next')} icon="forward" onPress={goNext} disabled={!canNext} />
          ) : (
            <AppButton label={t('confirm')} icon="check" onPress={onConfirm} loading={saving} />
          )}
        </View>
      </View>

      <SelectSheet visible={buyerSheet} onClose={() => setBuyerSheet(false)} options={partnerOptions} selectedId={buyerPiId ?? undefined} title={t('buyer')} onSelect={(o) => setBuyerPiId(o.id)} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    flex2: { flex: 2 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.lg },
    dot: { width: 9, height: 9, borderRadius: theme.radius.pill, backgroundColor: theme.colors.border },
    dotActive: { backgroundColor: theme.colors.accent, width: 28 },
    dotDone: { backgroundColor: theme.colors.success },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    optCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      minHeight: theme.touch.minTarget,
    },
    optActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
    scIcon: { width: 36, height: 36, borderRadius: theme.radius.chip, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
    scIconActive: { backgroundColor: theme.colors.accent },
    snapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.sm },
    noteBox: { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.md, padding: theme.spacing.md },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm },
    checkbox: { width: 28, height: 28, borderRadius: theme.radius.sm, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
    checkboxOn: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
    tblHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
    tblRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm },
    tblCol: { width: 64, textAlign: 'right' },
    footer: { flexDirection: 'row', gap: theme.spacing.md, padding: theme.spacing.lg },
  });
