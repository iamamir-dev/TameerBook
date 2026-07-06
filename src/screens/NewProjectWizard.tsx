import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

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
  addParty,
  addProjectInvestor,
  addProperty,
  createProject,
  listInvestors,
  type InvestorRow,
  type SizeUnit,
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
  amount: number;
  profitPct: number;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

const UNIT_LABEL: Record<SizeUnit, TranslationKey> = {
  MARLA: 'unitMarla',
  KANAL: 'unitKanal',
  SQYD: 'unitSqyd',
};

const STEPS: { title: TranslationKey; icon: IconKey; guide: TranslationKey }[] = [
  { title: 'plotInfo', icon: 'project', guide: 'guidePlot' },
  { title: 'priceSeller', icon: 'investor', guide: 'guidePrice' },
  { title: 'investors', icon: 'investor', guide: 'guideInvestors' },
  { title: 'review', icon: 'checkCircle', guide: 'guideReview' },
];

/**
 * Three-step "New Project" wizard — one focused screen per step with progress
 * dots, floating-label inputs, and big Back/Next buttons. Step 3 reviews then
 * creates the project, its property, and the seller/dealer parties.
 */
export function NewProjectWizard(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);
  const refreshProjects = useProjectsStore((s) => s.refresh);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [unitSheet, setUnitSheet] = useState(false);

  const [society, setSociety] = useState('');
  const [block, setBlock] = useState('');
  const [plotNo, setPlotNo] = useState('');
  const [sizeValue, setSizeValue] = useState('');
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('MARLA');
  const [agreedPrice, setAgreedPrice] = useState(0);
  const [sellerName, setSellerName] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [dealer, setDealer] = useState('');

  // Investors entered during creation + the add-investor sheet's draft state.
  const defaultPct = useSettingsStore((s) => s.investorProfitPct);
  const [investors, setInvestors] = useState<DraftInvestor[]>([]);
  const [allInvestors, setAllInvestors] = useState<InvestorRow[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftAmount, setDraftAmount] = useState(0);
  const [draftPct, setDraftPct] = useState(defaultPct);

  useEffect(() => {
    listInvestors()
      .then(setAllInvestors)
      .catch(() => undefined);
  }, []);

  const projectName = useMemo(() => {
    const plot = block && plotNo ? `${block}-${plotNo}` : plotNo;
    return [society.trim(), plot.trim()].filter(Boolean).join(' ').trim();
  }, [society, block, plotNo]);

  const unitOptions: SelectOption[] = useMemo(
    () =>
      (Object.keys(UNIT_LABEL) as SizeUnit[]).map((u) => ({ id: u, label: t(UNIT_LABEL[u]) })),
    [t]
  );

  const goBack = () => (step === 0 ? navigation.goBack() : setStep((s) => s - 1));
  const goNext = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  // Required fields per step (investors + review are optional → always proceed).
  const canProceed = useMemo(() => {
    if (step === 0) return projectName.trim().length > 0;
    if (step === 1) return agreedPrice > 0 && sellerName.trim().length > 0;
    return true;
  }, [step, projectName, agreedPrice, sellerName]);

  const openAddInvestor = () => {
    setDraftId(null);
    setDraftName('');
    setDraftAmount(0);
    setDraftPct(defaultPct);
    setAddOpen(true);
  };

  const confirmAddInvestor = () => {
    if (!draftName.trim() || draftAmount <= 0) return;
    setInvestors((list) => [
      ...list,
      { investorId: draftId, name: draftName.trim(), amount: draftAmount, profitPct: draftPct },
    ]);
    setAddOpen(false);
  };


  const onCreate = async () => {
    setSaving(true);
    try {
      const project = await createProject({
        name: projectName || t('newProject'),
        stage: 'TOKEN_PAID',
        startDate: todayISO(),
      });
      await addProperty({
        projectId: project.id,
        society: society || null,
        block: block || null,
        plotNo: plotNo || null,
        sizeValue: sizeValue ? Number(sizeValue) : null,
        sizeUnit,
        agreedPrice: agreedPrice || null,
        sellerName: sellerName || null,
        sellerPhone: sellerPhone || null,
      });
      if (sellerName.trim()) {
        await addParty({ type: 'SELLER', name: sellerName.trim(), phone: sellerPhone || null });
      }
      if (dealer.trim()) await addParty({ type: 'DEALER', name: dealer.trim() });

      // Attach investors: link the participation (committed + profit %), then
      // record the amount as paid-in capital (INITIAL).
      const today = todayISO();
      for (const inv of investors) {
        const investorId = inv.investorId ?? (await addInvestor({ name: inv.name })).id;
        await addProjectInvestor({
          projectId: project.id,
          investorId,
          committedAmount: inv.amount,
          profitPct: inv.profitPct,
        });
        if (inv.amount > 0) {
          await addInvestment({ investorId, projectId: project.id, amount: inv.amount, date: today, mode: 'CASH' });
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          <AppText size="sm" color="textSecondary" center style={styles.guide}>
            {t(STEPS[step].guide)}
          </AppText>

          {step === 0 ? (
            <>
              <FloatingLabelInput
                label={t('society')}
                value={society}
                onChangeText={setSociety}
                hint={t('hintSociety')}
              />
              <View style={styles.row}>
                <View style={styles.flex}>
                  <FloatingLabelInput label={t('block')} value={block} onChangeText={setBlock} />
                </View>
                <View style={styles.flex}>
                  <FloatingLabelInput label={t('plotNo')} value={plotNo} onChangeText={setPlotNo} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <FloatingLabelInput
                    label={t('size')}
                    value={sizeValue}
                    onChangeText={setSizeValue}
                    keyboardType="number-pad"
                  />
                </View>
                <Pressable
                  onPress={() => setUnitSheet(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('sizeUnit')}
                  style={styles.selectBox}
                >
                  <AppText size="xs" weight="semibold" color="accent" style={styles.selectLabel}>
                    {t('sizeUnit')}
                  </AppText>
                  <View style={styles.selectValue}>
                    <AppText size="md" weight="semibold">
                      {t(UNIT_LABEL[sizeUnit])}
                    </AppText>
                    <AppIcon name="forward" size={18} color="textSecondary" />
                  </View>
                </Pressable>
              </View>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <AmountInput label={t('agreedPrice')} value={agreedPrice} onChange={setAgreedPrice} />
              <FloatingLabelInput
                label={t('sellerName')}
                value={sellerName}
                onChangeText={setSellerName}
              />
              <FloatingLabelInput
                label={t('sellerPhone')}
                value={sellerPhone}
                onChangeText={setSellerPhone}
                keyboardType="phone-pad"
                hint={t('hintPhone')}
              />
              <FloatingLabelInput
                label={t('dealerOptional')}
                value={dealer}
                onChangeText={setDealer}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              {investors.length === 0 ? (
                <AppText size="sm" color="textSecondary" center style={styles.guide}>
                  {t('noInvestorsYet')}
                </AppText>
              ) : (
                <View style={styles.reviewCard}>
                  {investors.map((inv, i) => (
                    <View key={`${inv.name}-${i}`} style={[styles.invRow, i > 0 && styles.invRowBordered]}>
                      <View style={styles.invIcon}>
                        <AppIcon name="investor" size={18} color="gold" />
                      </View>
                      <View style={styles.flex}>
                        <AppText size="sm" weight="bold" numberOfLines={1}>
                          {inv.name}
                        </AppText>
                        <AppText size="xs" color="textSecondary">
                          {`${formatRupees(inv.amount)} · ${inv.profitPct}% ${t('profitPct')}`}
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

          {step === 3 ? (
            <View style={styles.reviewCard}>
              <ReviewRow label={t('projectName')} value={projectName || ''} first />
              <ReviewRow label={t('society')} value={society || ''} />
              <ReviewRow label={t('block')} value={block || ''} />
              <ReviewRow label={t('plotNo')} value={plotNo || ''} />
              <ReviewRow
                label={t('size')}
                value={sizeValue ? `${sizeValue} ${t(UNIT_LABEL[sizeUnit])}` : ''}
              />
              <ReviewRow
                label={t('agreedPrice')}
                value={agreedPrice ? formatRupees(agreedPrice) : ''}
              />
              <ReviewRow label={t('sellerName')} value={sellerName || ''} />
              <ReviewRow label={t('sellerPhone')} value={sellerPhone || ''} />
              <ReviewRow label={t('investors')} value={String(investors.length)} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <View style={styles.backBtn}>
          <AppButton label={t('back')} icon="back" variant="secondary" onPress={goBack} />
        </View>
        <View style={styles.nextBtn}>
          {step < STEPS.length - 1 ? (
            <AppButton label={t('next')} icon="forward" onPress={goNext} disabled={!canProceed} />
          ) : (
            <AppButton label={t('create')} icon="check" onPress={onCreate} loading={saving} />
          )}
        </View>
      </View>

      <SelectSheet
        visible={unitSheet}
        onClose={() => setUnitSheet(false)}
        options={unitOptions}
        selectedId={sizeUnit}
        title={t('sizeUnit')}
        searchable={false}
        onSelect={(o) => setSizeUnit(o.id as SizeUnit)}
      />

      {/* Add-investor sheet */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold" center>
            {t('addInvestor')}
          </AppText>

          {/* Existing investors — tap a chip to pick one (inline, no nested modal) */}
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
                      style={[styles.existChip, selected && styles.existChipActive]}
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

          <AmountInput label={t('committedAmount')} value={draftAmount} onChange={setDraftAmount} />

          <View style={styles.pctRow}>
            <AppText size="md" weight="semibold" style={styles.flex}>
              {t('profitPct')}
            </AppText>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setDraftPct((p) => Math.max(0, p - 5))}
                hitSlop={theme.touch.hitSlop}
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <AppText size="lg" weight="bold" color="primary">−</AppText>
              </Pressable>
              <AppText size="md" weight="bold" tabular style={styles.stepValue}>
                {draftPct}%
              </AppText>
              <Pressable
                onPress={() => setDraftPct((p) => Math.min(100, p + 5))}
                hitSlop={theme.touch.hitSlop}
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <AppText size="lg" weight="bold" color="primary">+</AppText>
              </Pressable>
            </View>
          </View>

          <AppButton
            label={t('add')}
            icon="check"
            onPress={confirmAddInvestor}
            disabled={!draftName.trim() || draftAmount <= 0}
          />
        </View>
      </Modal>
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
    <View style={[styles.reviewRow, first ? null : styles.reviewRowBordered]}>
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
    row: { flexDirection: 'row', gap: theme.spacing.md },
    selectBox: {
      flex: 1,
      minHeight: theme.touch.minTarget,
      backgroundColor: theme.colors.background,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      justifyContent: 'center',
    },
    selectLabel: {
      position: 'absolute',
      left: theme.spacing.md,
      top: -10,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.xs,
    },
    selectValue: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
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
    reviewRowBordered: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    reviewValue: { flex: 1, textAlign: 'right' },
    footer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.lg,
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
    invRowBordered: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
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
    existChipActive: { backgroundColor: theme.colors.primary },
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
    pressed: { opacity: 0.6 },
  });
