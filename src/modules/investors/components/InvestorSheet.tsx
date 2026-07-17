import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { AmountInput, AppButton, AppIcon, AppSheet, AppText } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/InvestorSheet.styles';
import { InvestorPersonSheet } from './InvestorPersonSheet';

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
}

interface InvestorSheetProps {
  visible: boolean;
  onClose: () => void;
  existingInvestors: InvestorOption[];
  saving?: boolean;
  /** The investors selected + how much each one puts into this project. */
  onSubmit: (inclusions: InvestorInclusion[]) => void;
}

/**
 * The ONE "add investors to a project" drawer (New Project wizard + Project
 * Detail), on the shared `AppSheet`. Tick investors and enter each one's stake
 * in THIS project; a live ownership % is derived. "+ New investor" opens the
 * shared person sheet.
 */
export function InvestorSheet({
  visible,
  onClose,
  existingInvestors,
  saving = false,
  onSubmit,
}: InvestorSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const [people, setPeople] = useState<InvestorOption[]>(() => existingInvestors);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [personOpen, setPersonOpen] = useState(false);

  // Reset only when the sheet opens (false→true). A data-version refresh while
  // open re-syncs the list without wiping an in-progress selection.
  const prevVisibleRef = useRef(visible);
  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;
    if (!visible) return;
    if (!wasVisible) {
      setPeople(existingInvestors);
      setSelected(new Set());
      setAmounts({});
      return;
    }
    setPeople((prev) => {
      const ids = new Set(existingInvestors.map((p) => p.id));
      const extras = prev.filter((p) => !ids.has(p.id));
      return [...existingInvestors, ...extras];
    });
  }, [visible, existingInvestors]);

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
        setAmounts((m) => ({ ...m, [inv.id]: m[inv.id] ?? 0 }));
      }
      return next;
    });

  const chosen = people.filter((p) => selected.has(p.id));
  const totalAmount = chosen.reduce((s, p) => s + (amounts[p.id] ?? 0), 0);
  const canSubmit = chosen.length > 0 && chosen.every((p) => (amounts[p.id] ?? 0) > 0);

  const submit = () => {
    if (!canSubmit || saving) return;
    onSubmit(chosen.map((p) => ({ investorId: p.id, amount: amounts[p.id] ?? 0 })));
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={t('attachInvestor')}
      footer={<AppButton label={t('add')} icon="check" onPress={submit} loading={saving} disabled={!canSubmit} />}
    >
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
                  {`${t('investedLabel')} ${formatRupees(inv.staked)}`}
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
                onChange={(v) => setAmounts((m) => ({ ...m, [inv.id]: Math.min(v, inv.remaining) }))}
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

      {/* + New investor → the shared person sheet; append + select on save. */}
      <InvestorPersonSheet
        visible={personOpen}
        onClose={() => setPersonOpen(false)}
        onSaved={(inv) => {
          if (inv.committed_amount <= 0) {
            Alert.alert(t('enterAmount'));
            return;
          }
          const opt = { id: inv.id, name: inv.name, staked: 0, remaining: inv.committed_amount };
          setPeople((list) => (list.some((p) => p.id === inv.id) ? list : [...list, opt]));
          setSelected((prev) => new Set(prev).add(inv.id));
          setAmounts((m) => ({ ...m, [inv.id]: m[inv.id] ?? inv.committed_amount }));
        }}
      />
    </AppSheet>
  );
}
