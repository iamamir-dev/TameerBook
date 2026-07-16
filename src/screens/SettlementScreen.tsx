import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  AppToggle,
  LoadErrorState,
  SelectSheet,
  StickyFooter,
} from '@/components/ui';
import {
  computeSettlement,
  getDonationPct,
  getProject,
  listAccountsWithBalance,
  settleProject,
  type AccountWithBalance,
  type Settlement,
} from '@/db';
import { useFocusReload, useSaveAction } from '@/hooks';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import { type DistributionRule, type DistributionRuleKind } from '@/utils/settlementMath';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type SettleRoute = RouteProp<RootStackParamList, 'Settlement'>;

const RULES: {
  kind: DistributionRuleKind;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  calcKey: TranslationKey;
}[] = [
  { kind: 'ownership', labelKey: 'ruleOwnership', descKey: 'ruleOwnershipDesc', calcKey: 'ruleOwnershipCalc' },
  { kind: 'agreedPct', labelKey: 'ruleAgreedPct', descKey: 'ruleAgreedPctDesc', calcKey: 'ruleAgreedPctCalc' },
  { kind: 'ownerFirst', labelKey: 'ruleOwnerFirst', descKey: 'ruleOwnerFirstDesc', calcKey: 'ruleOwnerFirstCalc' },
  { kind: 'prefReturn', labelKey: 'rulePrefReturn', descKey: 'rulePrefReturnDesc', calcKey: 'rulePrefReturnCalc' },
  { kind: 'manual', labelKey: 'ruleManual', descKey: 'ruleManualDesc', calcKey: 'ruleManualCalc' },
];

/** Percentage / number input — plain numeric field, no Rs prefix or chips. */
function PctInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}): React.JSX.Element {
  const [text, setText] = useState(value > 0 ? String(value) : '');
  useEffect(() => {
    // Sync when the value is changed from outside (quick-fill chips).
    const parsed = Number(text);
    if ((Number.isFinite(parsed) ? parsed : 0) !== value) setText(value > 0 ? String(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <FloatingLabelInput
      label={label}
      value={text}
      keyboardType="decimal-pad"
      onChangeText={(v) => {
        setText(v);
        const n = Number(v);
        onChange(Number.isFinite(n) && n >= 0 ? n : 0);
      }}
    />
  );
}

/**
 * Settle Up (Hisaab) wizard — 4 steps: Ownership → Rule → Preview → Confirm.
 * Everything is decided here on REALIZED profit with mutual consent (Shariah);
 * loss is locked to capital ratio. See src/utils/settlementMath.ts.
 */
export function SettlementScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { projectId } = useRoute<SettleRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const refreshProjects = useProjectsStore((s) => s.refresh);

  const [step, setStep] = useState(0);
  const [base, setBase] = useState<Settlement | null>(null);
  const [projectName, setProjectName] = useState('');
  const [donationPct, setDonationPct] = useState(0);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountSheet, setAccountSheet] = useState(false);

  // THE rule: builder's work share first, rest by ownership, charity per
  // person (with opt-out). All percentages editable here.
  const [ownerPct, setOwnerPct] = useState(20);
  const [investorsPct, setInvestorsPct] = useState(70);
  const [optOut, setOptOut] = useState<Record<string, boolean>>({});

  const { saving, run: runSave } = useSaveAction();
  // Which rule's explainer sheet is open (ⓘ on each rule card).
  const [infoRule, setInfoRule] = useState<DistributionRuleKind | null>(null);

  const load = useCallback(async () => {
    const [s, p, dPct, accs] = await Promise.all([
      computeSettlement(projectId),
      getProject(projectId),
      getDonationPct(projectId),
      listAccountsWithBalance(),
    ]);
    setAccounts(accs);
    setAccountId((prev) => prev ?? accs[0]?.id ?? null);
    setBase(s);
    setProjectName(p?.name ?? '');
    setDonationPct(dPct);
    setInvestorsPct(Math.max(0, 100 - 20 - dPct));
  }, [projectId]);
  const { loadFailed, reload } = useFocusReload(load);

  // The three-way split must total exactly 100 — live-checked, Next gated.
  const pctSum = Math.round((ownerPct + investorsPct + donationPct) * 100) / 100;
  const sumOk = Math.abs(pctSum - 100) <= 0.01;
  /** Cap an edited field so the trio can never exceed 100. */
  const capTo100 = (others: number) => (v: number) => Math.max(0, Math.min(v, Math.max(0, 100 - others)));

  const rule: DistributionRule = useMemo(() => ({ kind: 'ownerFirst', ownerPct }), [ownerPct]);

  // Live preview under the chosen rule (recomputed when inputs change).
  const [preview, setPreview] = useState<Settlement | null>(null);
  useEffect(() => {
    let alive = true;
    computeSettlement(projectId, rule, donationPct, optOut)
      .then((s) => alive && setPreview(s))
      .catch(swallow('settle:preview'));
    return () => {
      alive = false;
    };
  }, [projectId, rule, donationPct, optOut]);

  const data = preview ?? base;
  const isLoss = !(base?.isProfit ?? true);
  const participants = useMemo(
    () =>
      (base?.rows ?? []).map((r) => ({
        id: r.projectInvestorId,
        name: r.isOwner ? t('owner') : r.name,
        capital: r.capital,
        isOwner: r.isOwner,
      })),
    [base, t]
  );

  const ownerName = t('owner');
  const steps = isLoss ? 2 : 3; // loss skips the divide step
  const uiStep = isLoss && step > 0 ? step + 1 : step; // internal step → 0..2

  const canNext = useMemo(() => {
    if (!data) return false;
    if (uiStep === 1 && !isLoss) return data.errors.length === 0 && sumOk;
    if (uiStep === 2) return data.errors.length === 0 && !!accountId;
    return true;
  }, [data, uiStep, isLoss, sumOk]);

  const onNext = () => {
    if (step < steps - 1) setStep(step + 1);
    else onConfirm();
  };

  const sharePdf = async (s: Settlement) => {
    const showDonation = s.totalDonation > 0;
    const right = ' style="text-align:right"';
    const ruleLabel = t(RULES.find((r) => r.kind === s.rule.kind)?.labelKey ?? 'ruleOwnership');
    const rows = s.rows
      .map(
        (r) =>
          `<tr><td>${r.isOwner ? t('owner') : r.name}</td><td${right}>${formatRupees(r.capital)}</td><td${right}>${formatRupees(Math.abs(r.profitOrLoss))}</td>${showDonation ? `<td${right}>${formatRupees(r.donation)}</td>` : ''}<td${right}><b>${r.isOwner ? '' : formatRupees(r.finalPayout)}</b></td></tr>`
      )
      .join('');
    const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <style>body{font-family:-apple-system,Roboto,sans-serif;padding:24px;color:#211F1B}
      h1{color:#1D1C18;margin:0}.sub{color:#9A958B;margin:4px 0 16px}
      .k{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ECE8DF}
      table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:8px;border-bottom:1px solid #ECE8DF;font-size:13px;text-align:left}
      th{color:#9A958B;text-transform:uppercase;font-size:11px}</style></head><body>
      <h1>TameerBook</h1><div class="sub">${t('settlementReceipt')}  ${projectName} · ${dayjs().format('DD MMM YYYY')} · ${ruleLabel}</div>
      <div class="k"><span>${t('revenue')}</span><b>${formatRupees(s.revenue)}</b></div>
      <div class="k"><span>${t('totalExpenses')}</span><b>${formatRupees(s.expenses)}</b></div>
      <div class="k"><span>${s.isProfit ? t('netProfit') : t('netLoss')}</span><b>${formatRupees(Math.abs(s.net))}</b></div>
      ${showDonation ? `<div class="k"><span>${t('totalDonation')} (${s.donationPct}%)</span><b>${formatRupees(s.totalDonation)}</b></div>` : ''}
      <table><thead><tr><th>${t('investors')}</th><th${right}>${t('capitalBack')}</th><th${right}>${s.isProfit ? t('profitShare') : t('lossShare')}</th>${showDonation ? `<th${right}>${t('donationLabel')}</th>` : ''}<th${right}>${t('payoutLabel')}</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`;
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('settlementReceipt') });
    }
  };

  const doSettle = async () => {
    if (!data) return;
    const ok = await runSave(async () => {
      await settleProject(projectId, rule, {
        donationPct,
        donationOptOutById: optOut,
        payoutAccountId: accountId ?? undefined,
      });
    });
    if (!ok) return;
    await Promise.all([
      refreshProjects().catch(swallow('settlement:refresh')),
      sharePdf(data).catch(swallow('settlement:sharePdf')),
    ]);
    navigation.goBack();
  };

  const onConfirm = () => {
    Alert.alert(t('confirmSettleTitle'), t('confirmSettleBody'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), style: 'destructive', onPress: () => void doSettle() },
    ]);
  };

  if (loadFailed) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('settleTitle')} subtitle={projectName} onBack={() => navigation.goBack()} />
        <LoadErrorState onRetry={() => void reload()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('settleTitle')}
        subtitle={`${projectName} · ${step + 1} / ${steps}`}
        onBack={() => (step === 0 ? navigation.goBack() : setStep(step - 1))}
      />

      {/* Progress dots */}
      <View style={styles.dots}>
        {Array.from({ length: steps }, (_, i) => (
          <View key={i} style={[styles.dot, i === step ? styles.dotActive : i < step ? styles.dotDone : null]} />
        ))}
      </View>

      {data ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl }]}
        >
          {uiStep === 0 ? (
            <>
              {/* Net result hero */}
              <View style={[styles.hero, { backgroundColor: data.isProfit ? theme.colors.success : theme.colors.danger }]}>
                <AppText size="overline" weight="semibold" color="onHero" uppercase>
                  {data.isProfit ? t('netProfit') : t('netLoss')}
                </AppText>
                <AppText size="display" weight="bold" color="onHero" tabular numberOfLines={1} adjustsFontSizeToFit>
                  {formatRupees(Math.abs(data.net))}
                </AppText>
                <AppText size="sm" color="onHero">
                  {`${t('revenue')} ${formatRupees(data.revenue)} · ${t('totalExpenses')} ${formatRupees(data.expenses)}`}
                </AppText>
              </View>

              {isLoss ? (
                <AppCard compact style={styles.lossNote}>
                  <AppText size="sm" weight="semibold" color="danger">
                    {t('lossLockedNote')}
                  </AppText>
                </AppCard>
              ) : null}

              {/* Ownership — who owns how much, from real money. */}
              <AppText size="lg" weight="bold">
                {t('ownershipSection')}
              </AppText>
              <AppCard compact>
                {(base?.rows ?? []).map((r, i) => (
                  <View key={r.projectInvestorId} style={[styles.row, i > 0 && styles.ruled]}>
                    <AppText size="sm" weight={r.isOwner ? 'bold' : 'semibold'} style={styles.flex} numberOfLines={1}>
                      {r.isOwner ? ownerName : r.name}
                    </AppText>
                    <AppText size="sm" tabular color="textSecondary">
                      {formatRupees(r.capital)}
                    </AppText>
                    <AppText size="sm" weight="bold" tabular style={styles.pctCol}>
                      {`${r.ownershipPct.toFixed(1)}%`}
                    </AppText>
                  </View>
                ))}
              </AppCard>
            </>
          ) : null}

          {uiStep === 1 && !isLoss ? (
            <>
              <View style={styles.rowBetween}>
                <AppText size="lg" weight="bold" style={styles.flex}>
                  {t('distributionRule')}
                </AppText>
                <Pressable
                  onPress={() => setInfoRule('ownerFirst')}
                  hitSlop={theme.touch.hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel={t('ruleOwnerFirst')}
                >
                  <AppIcon name="info" size={20} color="textSecondary" />
                </Pressable>
              </View>

              {/* The three-way split: builder + investors + charity = 100%. */}
              <AppCard style={styles.inputsCard}>
                <PctInput
                  label={t('ownerWorkSharePct')}
                  value={ownerPct}
                  onChange={(v) => setOwnerPct(capTo100(investorsPct + donationPct)(v))}
                />
                <PctInput
                  label={t('investorsPoolPct')}
                  value={investorsPct}
                  onChange={(v) => setInvestorsPct(capTo100(ownerPct + donationPct)(v))}
                />
                <AppText size="xs" color="textSecondary">
                  {t('ruleOwnershipHint')}
                </AppText>
                <PctInput
                  label={t('sadaqahPct')}
                  value={donationPct}
                  onChange={(v) => setDonationPct(capTo100(ownerPct + investorsPct)(v))}
                />
                {/* Live calculator — must land exactly on 100%. */}
                <AppText size="sm" weight="bold" color={sumOk ? 'success' : 'danger'} tabular>
                  {`${ownerPct}% + ${investorsPct}% + ${donationPct}% = ${pctSum}%${sumOk ? ' ✓' : ` — ${t('sumMustBe100')}`}`}
                </AppText>
              </AppCard>

              {/* Charity toggles — per person; off = they keep their portion. */}
              {donationPct > 0 ? (
              <AppCard style={styles.inputsCard}>
                {participants.map((p) => (
                      <View key={p.id} style={styles.rowBetween}>
                        <AppText size="sm" weight="semibold" style={styles.flex} numberOfLines={1}>
                          {p.name}
                        </AppText>
                        <AppToggle
                          value={!optOut[p.id]}
                          onValueChange={(v) => setOptOut((m) => ({ ...m, [p.id]: !v }))}
                          accessibilityLabel={p.name}
                        />
                      </View>
                    ))}
                <AppText size="xs" color="textSecondary">
                  {t('charityToggleHint')}
                </AppText>
              </AppCard>
              ) : null}
            </>
          ) : null}

          {uiStep === 2 ? (
            <>
              <AppText size="lg" weight="bold">
                {t('stepPreview')}
              </AppText>
              {!isLoss ? (
                <AppText size="sm" color="textSecondary">
                  {t('ruleOwnerFirst')}
                </AppText>
              ) : null}
              <AppCard compact>
                {data.rows.map((r, i) => (
                  <View key={r.projectInvestorId} style={[styles.person, i > 0 && styles.ruled]}>
                    <AppText size="sm" weight="bold" numberOfLines={1}>
                      {r.isOwner ? ownerName : r.name}
                    </AppText>
                    <PRow label={t('capitalBack')} value={formatRupees(r.capital)} />
                    <PRow
                      label={data.isProfit ? t('profitShare') : t('lossShare')}
                      value={formatRupees(Math.abs(r.profitOrLoss))}
                      tone={r.profitOrLoss >= 0 ? 'success' : 'danger'}
                    />
                    {r.isOwner && data.isProfit ? (
                      <PRow
                        label={t('ownerWorkSharePct').replace(' %', '')}
                        value={formatRupees(Math.round((data.net * ownerPct) / 100))}
                      />
                    ) : null}
                    {r.donation > 0 ? <PRow label={t('donationLabel')} value={formatRupees(r.donation)} tone="gold" /> : null}
                    {!r.isOwner ? <PRow label={t('payoutLabel')} value={formatRupees(r.finalPayout)} bold /> : null}
                  </View>
                ))}
                {data.totalDonation > 0 ? (
                  <View style={[styles.person, styles.ruled]}>
                    <View style={styles.row}>
                      <AppText size="sm" weight="bold" color="gold" style={styles.flex}>
                        {`${t('totalDonation')} (${data.donationPct}%)`}
                      </AppText>
                      <AppText size="sm" weight="bold" color="gold" tabular>
                        {formatRupees(data.totalDonation)}
                      </AppText>
                    </View>
                  </View>
                ) : null}
              </AppCard>
              {/* The account holding the sale money — payouts leave here. */}
              <Pressable onPress={() => setAccountSheet(true)} style={styles.accountChip} accessibilityRole="button">
                <AppIcon
                  name={accounts.find((a) => a.id === accountId)?.type === 'BANK' ? 'bank' : 'balance'}
                  size={18}
                  color="primary"
                />
                <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
                  {(() => {
                    const a = accounts.find((x) => x.id === accountId);
                    return a ? `${a.name} · ${formatRupees(a.balance)}` : t('selectAccount');
                  })()}
                </AppText>
                <AppIcon name="forward" size={18} color="textSecondary" />
              </Pressable>
              <AppText size="sm" color="textSecondary" center>
                {t('confirmSettleBody')}
              </AppText>
            </>
          ) : null}
        </ScrollView>
        </KeyboardAvoidingView>
      ) : null}

      <SelectSheet
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        options={accounts.map((a) => ({
          id: a.id,
          label: a.name,
          subtitle: formatRupees(a.balance),
        }))}
        selectedId={accountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setAccountId(o.id)}
      />

      {/* Rule explainer sheet — structured: heading, prose, numbered steps. */}
      <Modal visible={infoRule !== null} transparent animationType="slide" onRequestClose={() => setInfoRule(null)}>
        <Pressable style={styles.backdrop} onPress={() => setInfoRule(null)} accessibilityRole="button" />
        <View style={[styles.infoSheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          {(() => {
            const r = RULES.find((x) => x.kind === infoRule);
            if (!r) return null;
            return (
              <>
                <AppText size="lg" weight="bold">
                  {t(r.labelKey)}
                </AppText>

                <AppText size="sm" weight="bold" color="accent">
                  {t('infoWhatTitle')}
                </AppText>
                <AppText size="sm" color="textSecondary">
                  {t(r.descKey)}
                </AppText>

                <AppText size="sm" weight="bold" color="accent">
                  {t('infoCalcTitle')}
                </AppText>
                {t(r.calcKey)
                  .split('\n')
                  .map((line, i) => (
                    <View key={i} style={styles.stepLine}>
                      <View style={styles.stepNum}>
                        <AppText size="xs" weight="bold" color="onAccent">
                          {String(i + 1)}
                        </AppText>
                      </View>
                      <AppText size="sm" color="textSecondary" style={styles.flex}>
                        {line}
                      </AppText>
                    </View>
                  ))}
              </>
            );
          })()}
          <AppButton label={t('done')} icon="check" onPress={() => setInfoRule(null)} />
        </View>
      </Modal>

      <StickyFooter>
        <AppButton
          label={step === steps - 1 ? t('confirm') : t('next')}
          icon={step === steps - 1 ? 'check' : 'forward'}
          onPress={onNext}
          loading={saving}
          disabled={!canNext}
        />
      </StickyFooter>
      {/* keep insets referenced for tablet safe-areas */}
      <View style={{ height: insets.bottom * 0 }} />
      {/* language kept for RTL-aware future tweaks */}
      {language ? null : null}
    </View>
  );
}

function PRow({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger' | 'gold';
  bold?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.row}>
      <AppText size="xs" color="textSecondary" style={styles.flex}>
        {label}
      </AppText>
      <AppText size={bold ? 'sm' : 'xs'} weight={bold ? 'bold' : 'semibold'} tabular color={tone ?? 'textPrimary'}>
        {value}
      </AppText>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
    },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.track },
    dotActive: { backgroundColor: theme.colors.accent, width: 20 },
    dotDone: { backgroundColor: theme.colors.accentSoft },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    hero: {
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    lossNote: { backgroundColor: theme.colors.dangerSoft },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.overlay },
    infoSheet: {
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
    stepLine: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
    stepNum: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xs },
    ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    pctCol: { width: 64, textAlign: 'right' },
    person: { paddingVertical: theme.spacing.sm, gap: theme.spacing.xs },
    inputsCard: { gap: theme.spacing.md },
    accountChip: {
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
    rowBetween: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  });
