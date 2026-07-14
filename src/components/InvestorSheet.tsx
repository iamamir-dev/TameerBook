import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InvestorPersonSheet } from '@/components/InvestorPersonSheet';
import { AmountInput, AppButton, AppIcon, AppText } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

/** An investor available to include, with their remaining capacity. */
export interface InvestorOption {
  id: string;
  name: string;
  /** Net capital already staked across ALL their projects. */
  staked: number;
  /** Pledge − staked (floored at 0): the most they can put into THIS project. */
  remaining: number;
}

/** One investor's participation in the project: their stake in THIS project. */
export interface InvestorInclusion {
  investorId: string;
  amount: number;
  /** Musharakah profit share % for this investor in this project. */
  profitPct: number;
}

interface InvestorSheetProps {
  visible: boolean;
  onClose: () => void;
  existingInvestors: InvestorOption[];
  saving?: boolean;
  /** Profit share % each newly-added investor starts on (from Settings). */
  defaultProfitPct: number;
  /** The investors selected + how much each one puts into this project. */
  onSubmit: (inclusions: InvestorInclusion[]) => void;
}

/**
 * The ONE "add investors to a project" drawer (New Project wizard + Project
 * Detail). Tick the investors who are in this project and enter how much each
 * one invests HERE — a live ownership % is worked out from those amounts. Only
 * investors with remaining capacity (pledge − staked everywhere) are listed
 * (V-5); the remaining figure pre-fills and caps the amount (V-4). "+ New
 * investor" opens the shared person modal.
 */
export function InvestorSheet({
  visible,
  onClose,
  existingInvestors,
  saving = false,
  defaultProfitPct,
  onSubmit,
}: InvestorSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  // Investors with nothing left to stake are hidden entirely (V-5).
  const [people, setPeople] = useState<InvestorOption[]>(() =>
    existingInvestors.filter((p) => p.remaining > 0)
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [personOpen, setPersonOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Reset the form ONLY when the sheet actually opens (visible false→true).
  // A data-version refresh while the sheet is open changes the
  // `existingInvestors` identity and must NOT wipe an in-progress selection —
  // it only re-syncs the people list (keeping locally-added investors).
  const prevVisibleRef = useRef(visible);
  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;
    if (!visible) return;
    const eligible = existingInvestors.filter((p) => p.remaining > 0);
    if (!wasVisible) {
      setPeople(eligible);
      setSelected(new Set());
      setAmounts({});
      setExpanded(false);
      return;
    }
    setPeople((prev) => {
      const ids = new Set(eligible.map((p) => p.id));
      // Keep rows the refresh doesn't know about yet (e.g. "+ New investor"
      // additions) so selected ids and their amounts survive the sync.
      const extras = prev.filter((p) => !ids.has(p.id));
      return [...eligible, ...extras];
    });
  }, [visible, existingInvestors]);

  // Ticking an investor pre-fills their project stake with their remaining
  // capacity; the user can override it. Un-ticking clears the amount.
  const toggle = (inv: InvestorOption) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(inv.id)) {
        next.delete(inv.id);
        setAmounts((m) => {
          const { [inv.id]: _drop, ...rest } = m;
          return rest;
        });
      } else {
        next.add(inv.id);
        setAmounts((m) => ({ ...m, [inv.id]: m[inv.id] ?? inv.remaining }));
      }
      return next;
    });

  const chosen = people.filter((p) => selected.has(p.id));
  const totalAmount = chosen.reduce((s, p) => s + (amounts[p.id] ?? 0), 0);
  // Every selected investor needs a real stake within their capacity: an
  // amount greater than 0 and no more than what they have left to invest (V-4).
  const allValid =
    chosen.length > 0 &&
    chosen.every((p) => {
      const a = amounts[p.id] ?? 0;
      return a > 0 && a <= p.remaining;
    });
  const canSubmit = allValid;

  const submit = () => {
    if (!canSubmit || saving) return;
    // Profit share is one project-wide % (from Settings) applied to everyone —
    // it's equal for all investors in a project.
    onSubmit(
      chosen.map((p) => ({ investorId: p.id, amount: amounts[p.id] ?? 0, profitPct: defaultProfitPct }))
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            expanded ? { top: insets.top + theme.spacing.sm } : { maxHeight: '90%' },
            { paddingBottom: insets.bottom + theme.spacing.lg },
          ]}
        >
          <View style={styles.grabber} />

          {/* Header: title + maximize / restore toggle */}
          <View style={styles.header}>
            <AppText size="lg" weight="bold" style={styles.flex}>
              {t('attachInvestor')}
            </AppText>
            <Pressable
              onPress={() => setExpanded((e) => !e)}
              accessibilityRole="button"
              accessibilityLabel={expanded ? t('collapse') : t('expand')}
              hitSlop={theme.touch.hitSlop}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <AppIcon name={expanded ? 'collapse' : 'expand'} size={20} color="textSecondary" />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <AppText size="sm" color="textSecondary">
              {t('enterInvestorAmounts')}
            </AppText>

            {people.length === 0 ? (
              <AppText size="sm" color="textSecondary">
                {t('noEligibleInvestors')}
              </AppText>
            ) : null}

            {people.map((inv) => {
              const isSel = selected.has(inv.id);
              const amt = amounts[inv.id] ?? 0;
              const pct = isSel && totalAmount > 0 ? Math.round((amt / totalAmount) * 100) : 0;
              return (
                <View key={inv.id} style={[styles.row, isSel && styles.rowActive]}>
                  <Pressable
                    onPress={() => toggle(inv)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSel }}
                    accessibilityLabel={inv.name}
                    style={styles.rowHead}
                  >
                    <AppIcon name={isSel ? 'checkCircle' : 'dotNext'} size={22} color={isSel ? 'accent' : 'textSecondary'} />
                    <View style={styles.rowBody}>
                      <AppText size="md" weight="bold" numberOfLines={1}>
                        {inv.name}
                      </AppText>
                      <AppText size="xs" color="textSecondary" tabular>
                        {`${formatRupees(inv.staked)} ${t('investedLabel')} · ${formatRupees(inv.remaining)} ${t('remainingToInvest')}`}
                      </AppText>
                    </View>
                    {isSel ? (
                      <AppText size="md" weight="bold" color="accent" tabular>
                        {`${pct}%`}
                      </AppText>
                    ) : null}
                  </Pressable>
                  {isSel ? (
                    <AmountInput
                      label={t('investmentInProject')}
                      value={amt}
                      // Their project stake can NEVER exceed their remaining
                      // capacity — clamp in real time (V-4).
                      onChange={(v) =>
                        setAmounts((m) => ({ ...m, [inv.id]: Math.min(v, inv.remaining) }))
                      }
                      floating
                      surface={theme.colors.background}
                    />
                  ) : null}
                </View>
              );
            })}

            <Pressable
              onPress={() => setPersonOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('newInvestor')}
              style={({ pressed }) => [styles.newRow, pressed && styles.pressed]}
            >
              <AppIcon name="add" size={20} color="accent" />
              <AppText size="sm" weight="bold" color="accent">
                {t('newInvestor')}
              </AppText>
            </Pressable>

            {totalAmount > 0 ? (
              <View style={styles.totalRow}>
                <AppText size="sm" weight="semibold" color="textSecondary">
                  {t('totalCapital')}
                </AppText>
                <AppText size="md" weight="bold" tabular>
                  {formatRupees(totalAmount)}
                </AppText>
              </View>
            ) : null}
            <AppText size="xs" color="textSecondary" style={styles.hint}>
              {t('ownershipAutoNote')}
            </AppText>
          </ScrollView>

          {/* Pinned action  always in reach below the scrolling list */}
          <View style={styles.footer}>
            <AppButton label={t('add')} icon="check" onPress={submit} loading={saving} disabled={!canSubmit} />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* + New investor → the shared person modal; append + select on save. */}
      <InvestorPersonSheet
        visible={personOpen}
        onClose={() => setPersonOpen(false)}
        onSaved={(inv) => {
          // A brand-new investor has staked nothing yet, so their whole pledge
          // is their capacity; one saved without a pledge has none and can't be
          // added to a project — tell the user instead of silently dropping it.
          if (inv.committed_amount <= 0) {
            Alert.alert(t('setPledgeToAdd'));
            return;
          }
          const opt = { id: inv.id, name: inv.name, staked: 0, remaining: inv.committed_amount };
          setPeople((list) => (list.some((p) => p.id === inv.id) ? list : [...list, opt]));
          setSelected((prev) => new Set(prev).add(inv.id));
          setAmounts((m) => ({ ...m, [inv.id]: m[inv.id] ?? inv.committed_amount }));
        }}
      />
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.overlay },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.sm,
      ...theme.shadows.raised,
    },
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingTop: theme.spacing.sm },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
    scroll: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    body: { gap: theme.spacing.md, paddingTop: theme.spacing.md },
    row: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    rowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: theme.touch.minTarget,
    },
    rowActive: { borderColor: theme.colors.accent },
    rowBody: { flex: 1, gap: 2 },
    newRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.touch.minTarget,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accentSoft,
    },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    hint: { marginLeft: theme.spacing.sm, marginTop: -theme.spacing.xs },
    footer: {
      paddingTop: theme.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    pressed: { opacity: 0.7 },
  });
