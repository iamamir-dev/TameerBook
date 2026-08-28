import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { InvestorSheet, type InvestorInclusion, type InvestorOption } from '@/modules/investors';
import {
  AppButton,
  AppHeader,
  AppIcon,
  AppText,
  DateField,
  type IconKey,
} from '@/components/ui';
import {
  attachInvestorsToProject,
  createProject,
  listInvestorsWithCapacity,
  listPlots,
  nowISO,
  type InvestorCapacity,
  type PlotRow,
} from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';

/** An investor staged for this project (persisted on Create). */
interface DraftInvestor {
  investorId: string;
  name: string;
  /** How much they invest in THIS project — their stake / ownership basis. */
  amount: number;
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

  const [step, setStep] = useState(0);
  const { saving, run: runSave } = useSaveAction();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(nowISO().slice(0, 10));
  const [plots, setPlots] = useState<PlotRow[]>([]);
  const [plotId, setPlotId] = useState<string | null>(null);

  // Investors entered during creation + the add-investor sheet's draft state.
  const [investors, setInvestors] = useState<DraftInvestor[]>([]);
  const [allInvestors, setAllInvestors] = useState<InvestorCapacity[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  // Reload free plots on focus — the user may return from "New Plot". A plot
  // that wasn't in the previous list is the one they just created: select it
  // automatically so the wizard continues without a re-tap.
  const knownPlotIds = useRef<Set<string> | null>(null);
  useFocusEffect(
    useCallback(() => {
      listPlots('OWNED')
        .then((rows) => {
          setPlots(rows);
          const prev = knownPlotIds.current;
          if (prev) {
            const fresh = rows.find((p) => !prev.has(p.id));
            if (fresh) setPlotId(fresh.id);
          }
          knownPlotIds.current = new Set(rows.map((p) => p.id));
        })
        .catch(swallow('newProject:plots'));
      listInvestorsWithCapacity().then(setAllInvestors).catch(swallow('newProject:investors'));
    }, [])
  );

  const selectedPlot = plots.find((p) => p.id === plotId) ?? null;

  const goBack = () => (step === 0 ? navigation.goBack() : setStep((s) => s - 1));
  const goNext = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  // A project is always built ON a plot — step 0 needs name AND a plot.
  const canProceed = step !== 0 || (name.trim().length > 0 && !!plotId);

  // Investors not yet staged (so the sheet doesn't offer duplicates).
  const stagedIds = new Set(investors.map((i) => i.investorId));
  const availableInvestors: InvestorOption[] = allInvestors
    .filter((i) => !stagedIds.has(i.id))
    .map((i) => ({ id: i.id, name: i.name, staked: i.staked, remaining: i.remaining }));

  const openAddInvestor = () => setAddOpen(true);

  // Wizard STAGES the chosen investors — the actual DB writes happen on Create.
  const confirmAddInvestors = (inclusions: InvestorInclusion[]) => {
    setInvestors((list) => {
      const have = new Set(list.map((i) => i.investorId));
      const additions = inclusions
        .filter(({ investorId }) => !have.has(investorId))
        .map(({ investorId, amount }) => {
          const inv = allInvestors.find((i) => i.id === investorId);
          return { investorId, name: inv?.name ?? '', amount };
        });
      return [...list, ...additions];
    });
    setAddOpen(false);
  };

  const onCreate = async () => {
    await runSave(async () => {
      const project = await createProject({ name: name.trim(), plotId, startDate });

      // Each investor's entered amount is their stake (recorded as INITIAL
      // capital so ownership % derives from those amounts); their profit share %
      // is whatever was set in the stake sheet (defaults to the Settings %).
      await attachInvestorsToProject(
        project.id,
        investors.map(({ investorId, amount }) => ({ investorId, amount }))
      );

      await refreshProjects();
      navigation.replace('ProjectDetail', { projectId: project.id });
    });
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

              <AppText size="sm" weight="semibold" color="textSecondary">
                {t('projectStartDate')}
              </AppText>
              <DateField value={startDate} onChange={setStartDate} />

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
                    onPress={() => navigation.navigate('NewPlot', { returnAfterCreate: true })}
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
                          {`${t('investmentInProject')}: ${formatRupees(inv.amount)}`}
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
              {/* Skipping the plot / investors is a visible choice, not an accident. */}
              {selectedPlot ? (
                <ReviewRow
                  label={t('phasePlot')}
                  value={`${selectedPlot.name} · ${formatRupees(selectedPlot.deal_price)}`}
                />
              ) : (
                <View style={[styles.reviewRow, styles.ruled]}>
                  <AppText size="sm" color="textSecondary">
                    {t('noPlotChoice')}
                  </AppText>
                </View>
              )}
              {investors.map((inv, i) => (
                <ReviewRow key={`${inv.name}-${i}`} label={inv.name} value={formatRupees(inv.amount)} />
              ))}
              {investors.length === 0 ? (
                <View style={[styles.reviewRow, styles.ruled]}>
                  <AppText size="sm" color="textSecondary">
                    {t('ownerFunded')}
                  </AppText>
                </View>
              ) : (
                <ReviewRow label={t('tabInvestors')} value={String(investors.length)} />
              )}
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

      {/* Add-investor sheet — the ONE shared investor drawer. */}
      <InvestorSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        existingInvestors={availableInvestors}
        onSubmit={confirmAddInvestors}
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
  });
