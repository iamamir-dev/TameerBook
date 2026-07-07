import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  AppHeader,
  AppIcon,
  AppText,
  SelectSheet,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import {
  addInvestment,
  addInvestor,
  addProjectInvestor,
  createProject,
  listAccountsWithBalance,
  listInvestors,
  listPlots,
  type AccountWithBalance,
  type InvestorRow,
  type PlotRow,
} from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

/** A to-be-saved investor entered during creation. `investorId` null = new. */
interface DraftInvestor {
  investorId: string | null;
  name: string;
  /** What they PROMISED to invest  no money moves for this. */
  amount: number;
  /** What they handed over right now  only this hits the account. */
  given: number;
  profitPct: number;
  /** The account the given cash lands in (needed only when given > 0). */
  accountId: string | null;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STEPS: { title: TranslationKey; icon: IconKey; guide: TranslationKey | null }[] = [
  { title: 'projectName', icon: 'project', guide: null },
  { title: 'tabInvestors', icon: 'investor', guide: 'guideInvestors' },
  { title: 'review', icon: 'checkCircle', guide: 'guideReview' },
];

/**
 * v2 "New Project" wizard  3 steps: name + (optional) plot to include,
 * investors with their capital (landing in an account), then review + create.
 * Plots are created standalone (New Plot) and picked here.
 */
export function NewProjectWizard(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const refreshProjects = useProjectsStore((s) => s.refresh);
  const defaultPct = useSettingsStore((s) => s.investorProfitPct);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [plots, setPlots] = useState<PlotRow[]>([]);
  const [plotId, setPlotId] = useState<string | null>(null);

  // Investors entered during creation + the add-investor sheet's draft state.
  const [investors, setInvestors] = useState<DraftInvestor[]>([]);
  const [allInvestors, setAllInvestors] = useState<InvestorRow[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [accountSheet, setAccountSheet] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftAmount, setDraftAmount] = useState(0);
  const [draftGiven, setDraftGiven] = useState(0);
  const [draftPct, setDraftPct] = useState(defaultPct);
  const [draftAccountId, setDraftAccountId] = useState<string | null>(null);

  // Reload free plots on focus  the user may return from "New Plot".
  useFocusEffect(
    useCallback(() => {
      listPlots('OWNED').then(setPlots).catch(() => undefined);
      listInvestors().then(setAllInvestors).catch(() => undefined);
      listAccountsWithBalance().then(setAccounts).catch(() => undefined);
    }, [])
  );

  useEffect(() => {
    if (!draftAccountId && accounts.length > 0) setDraftAccountId(accounts[0].id);
  }, [accounts, draftAccountId]);

  const selectedPlot = plots.find((p) => p.id === plotId) ?? null;
  const draftAccount = accounts.find((a) => a.id === draftAccountId) ?? null;

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

  const goBack = () => (step === 0 ? navigation.goBack() : setStep((s) => s - 1));
  const goNext = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  const canProceed = step !== 0 || name.trim().length > 0;

  const openAddInvestor = () => {
    setDraftId(null);
    setDraftName('');
    setDraftAmount(0);
    setDraftGiven(0);
    setDraftPct(defaultPct);
    setAddOpen(true);
  };

  const confirmAddInvestor = () => {
    if (!draftName.trim() || draftAmount <= 0) return;
    if (draftGiven > 0 && !draftAccountId) return;
    setInvestors((list) => [
      ...list,
      {
        investorId: draftId,
        name: draftName.trim(),
        amount: draftAmount,
        given: draftGiven,
        profitPct: draftPct,
        accountId: draftGiven > 0 ? draftAccountId : null,
      },
    ]);
    setAddOpen(false);
  };

  const onCreate = async () => {
    setSaving(true);
    try {
      const project = await createProject({ name: name.trim(), plotId });

      // Attach investors: link the participation (the committed PROMISE +
      // profit %); only what was actually handed over now posts to an account
      // as paid-in capital. Later instalments go through Add Investment.
      const today = todayISO();
      for (const inv of investors) {
        const investorId = inv.investorId ?? (await addInvestor({ name: inv.name })).id;
        await addProjectInvestor({
          projectId: project.id,
          investorId,
          committedAmount: inv.amount,
          profitPct: inv.profitPct,
        });
        if (inv.given > 0 && inv.accountId) {
          await addInvestment({
            investorId,
            projectId: project.id,
            amount: inv.given,
            date: today,
            accountId: inv.accountId,
          });
        }
      }

      await refreshProjects();
      navigation.replace('ProjectDetail', { projectId: project.id });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t(STEPS[step].title)}
        subtitle={`${step + 1} / ${STEPS.length}`}
        onBack={goBack}
      />

      {/* Progress dots */}
      <View style={styles.dots}>
        {STEPS.map((s, i) => (
          <View
            key={s.title}
            style={[styles.dot, i === step ? styles.dotActive : i < step ? styles.dotDone : null]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Step icon + guidance */}
          <View style={styles.stepIcon}>
            <AppIcon name={STEPS[step].icon} size={28} color="accent" />
          </View>
          {STEPS[step].guide ? (
            <AppText size="sm" color="textSecondary" center style={styles.guide}>
              {t(STEPS[step].guide as TranslationKey)}
            </AppText>
          ) : null}

          {step === 0 ? (
            <>
              <FloatingLabelInput label={t('projectName')} value={name} onChangeText={setName} />

              {/* Plot picker  optional but recommended */}
              <AppText size="sm" weight="semibold" color="textSecondary">
                {t('selectPlot')}
              </AppText>
              {plots.length === 0 ? (
                <>
                  <AppText size="sm" color="textSecondary" center style={styles.guide}>
                    {t('noFreePlots')}
                  </AppText>
                  <AppButton
                    label={t('newPlot')}
                    icon="add"
                    variant="secondary"
                    onPress={() => navigation.navigate('NewPlot')}
                  />
                </>
              ) : (
                plots.map((p) => {
                  const selected = p.id === plotId;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setPlotId(selected ? null : p.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[styles.plotCard, selected && styles.plotCardActive]}
                    >
                      <View style={[styles.plotIcon, selected && styles.plotIconActive]}>
                        <AppIcon name="plot" size={20} color={selected ? 'onAccent' : 'primary'} />
                      </View>
                      <View style={styles.flex}>
                        <AppText size="sm" weight="bold" numberOfLines={1}>
                          {p.name}
                        </AppText>
                        <AppText size="xs" color="textSecondary" tabular>
                          {`${t('dealPrice')}: ${formatRupees(p.deal_price)}`}
                        </AppText>
                      </View>
                      {selected ? <AppIcon name="checkCircle" size={22} color="accent" /> : null}
                    </Pressable>
                  );
                })
              )}
            </>
          ) : null}

          {step === 1 ? (
            <>
              {investors.length === 0 ? (
                <AppText size="sm" color="textSecondary" center style={styles.guide}>
                  {t('noInvestorsYet')}
                </AppText>
              ) : (
                <View style={styles.reviewCard}>
                  {investors.map((inv, i) => (
                    <View key={`${inv.name}-${i}`} style={[styles.invRow, i > 0 && styles.ruled]}>
                      <View style={styles.invIcon}>
                        <AppIcon name="investor" size={18} color="gold" />
                      </View>
                      <View style={styles.flex}>
                        <AppText size="sm" weight="bold" numberOfLines={1}>
                          {inv.name}
                        </AppText>
                        <AppText size="xs" color="textSecondary">
                          {`${t('committedAmount')} ${formatRupees(inv.amount)} · ${inv.profitPct}%${inv.given > 0
                              ? ` · ${t('givenNow')} ${formatRupees(inv.given)} (${accounts.find((a) => a.id === inv.accountId)?.name ?? ''
                              })`
                              : ''
                            }`}
                        </AppText>
                      </View>
                      <Pressable
                        onPress={() => setInvestors((l) => l.filter((_, j) => j !== i))}
                        hitSlop={theme.touch.hitSlop}
                        accessibilityRole="button"
                        accessibilityLabel={inv.name}
                      >
                        <AppIcon name="trash" size={20} color="danger" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              <AppButton
                label={t('addInvestor')}
                icon="add"
                variant="secondary"
                onPress={openAddInvestor}
              />
            </>
          ) : null}

          {step === 2 ? (
            <View style={styles.reviewCard}>
              <ReviewRow label={t('projectName')} value={name.trim()} first />
              <ReviewRow
                label={t('phasePlot')}
                value={
                  selectedPlot
                    ? `${selectedPlot.name} · ${formatRupees(selectedPlot.deal_price)}`
                    : ''
                }
              />
              {investors.map((inv, i) => (
                <ReviewRow
                  key={`${inv.name}-${i}`}
                  label={inv.name}
                  value={`${formatRupees(inv.amount)} · ${inv.profitPct}%${inv.given > 0 ? ` · ${t('givenNow')} ${formatRupees(inv.given)}` : ''
                    }`}
                />
              ))}
              <ReviewRow label={t('tabInvestors')} value={String(investors.length)} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <View style={styles.backBtn}>
          <AppButton label={t('back')} icon="back" variant="secondary" onPress={goBack} />
        </View>
        <View style={styles.nextBtn}>
          {step < STEPS.length - 1 ? (
            <AppButton label={t('next')} icon="forward" onPress={goNext} disabled={!canProceed} />
          ) : (
            <AppButton
              label={t('create')}
              icon="check"
              onPress={onCreate}
              loading={saving}
              disabled={name.trim().length === 0}
            />
          )}
        </View>
      </View>

      {/* Add-investor sheet */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={() => setAddOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold" center>
            {t('addInvestor')}
          </AppText>

          {/* Existing investors  tap a chip to pick one (inline, no nested modal) */}
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
                      <AppText
                        size="sm"
                        weight="bold"
                        color={selected ? 'onPrimary' : 'textPrimary'}
                        numberOfLines={1}
                      >
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

          {/* Destination account  only needed when cash is given now */}
          {draftGiven > 0 ? (
            <Pressable onPress={() => setAccountSheet(true)} style={styles.accountChip} accessibilityRole="button">
              <AppIcon name={draftAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
              <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
                {draftAccount ? `${draftAccount.name} · ${formatRupees(draftAccount.balance)}` : t('selectAccount')}
              </AppText>
              <AppIcon name="forward" size={18} color="textSecondary" />
            </Pressable>
          ) : null}

          <AppButton
            label={t('add')}
            icon="check"
            onPress={confirmAddInvestor}
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

function ReviewRow({
  label,
  value,
  first,
}: {
  label: string;
  value: string;
  first?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={[styles.reviewRow, first ? null : styles.ruled]}>
      <AppText size="sm" color="textSecondary">
        {label}
      </AppText>
      <AppText size="sm" weight="bold" numberOfLines={1} style={styles.reviewValue}>
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
      paddingVertical: theme.spacing.lg,
    },
    dot: {
      width: 9,
      height: 9,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.border,
    },
    dotActive: { backgroundColor: theme.colors.accent, width: 28 },
    dotDone: { backgroundColor: theme.colors.success },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    stepIcon: {
      alignSelf: 'center',
      width: 64,
      height: 64,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.sm,
    },
    guide: { marginBottom: theme.spacing.sm },
    /* plot picker */
    plotCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
    },
    plotCardActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
    plotIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primarySoft,
    },
    plotIconActive: { backgroundColor: theme.colors.accent },
    /* review */
    reviewCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      paddingHorizontal: theme.spacing.lg,
      ...theme.shadows.card,
    },
    reviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    ruled: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    reviewValue: { flex: 1, textAlign: 'right' },
    footer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
    },
    backBtn: { flex: 1 },
    nextBtn: { flex: 2 },
    /* investor list rows */
    invRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    invIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.goldSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /* add-investor sheet */
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
    pressed: { opacity: 0.6 },
  });
