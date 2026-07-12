import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountInput, AppButton, AppIcon, AppText, SelectSheet } from '@/components/ui';
import {
  payLaborer,
  type AccountWithBalance,
  type LaborerProjectParticipation,
} from '@/db';
import { useAccountOptions, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatDisplayDate, todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

interface PayWorkerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** All of the worker's participations; only those still owed are payable. */
  participations: LaborerProjectParticipation[];
  accounts: AccountWithBalance[];
  /** Reload the khata after the payment lands. */
  onSaved: () => Promise<void>;
}

/**
 * Bottom sheet that pays a worker from their khata. A payment always books to
 * ONE project participation (it is that project's cost), so when the worker is
 * owed on several projects the user picks which one to pay. The owed amount is
 * shown and quick-fills the field, capped to the balance (V-9); the repo's
 * `LimitExceededError` backstops it.
 */
export function PayWorkerSheet({
  visible,
  onClose,
  participations,
  accounts,
  onSaved,
}: PayWorkerSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const today = todayISO();
  const payables = participations.filter((p) => p.balance.balance > 0);

  const [selectedPlId, setSelectedPlId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountSheet, setAccountSheet] = useState(false);

  const { saving, run } = useSaveAction();
  const accountOptions = useAccountOptions(accounts);
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  // Fresh form per open, defaulting to the only (or first) payable project.
  useEffect(() => {
    if (!visible) return;
    setAmount(0);
    setAccountId(null);
    setSelectedPlId(
      participations.find((p) => p.balance.balance > 0)?.projectLaborer.id ?? null
    );
  }, [visible, participations]);

  const selected = payables.find((p) => p.projectLaborer.id === selectedPlId) ?? null;
  const owed = selected?.balance.balance ?? 0;

  const canSave =
    amount > 0 &&
    selectedPlId !== null &&
    accountId !== null &&
    amount <= owed &&
    (!selectedAccount || amount <= selectedAccount.balance);

  const onPay = (): void => {
    if (!canSave || saving || !selectedPlId || !accountId) return;
    void run(async () => {
      await payLaborer({
        projectLaborerId: selectedPlId,
        amount,
        date: today,
        accountId,
      });
      onClose();
      await onSaved();
    });
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            <View style={styles.grabber} />
            <AppText size="lg" weight="bold">
              {t('payWorker')}
            </AppText>

            {/* Which project's khata gets the payment (when owed on several) */}
            {payables.length > 1 ? (
              <View style={styles.chipWrap}>
                {payables.map((p) => {
                  const isSelected = selectedPlId === p.projectLaborer.id;
                  return (
                    <Pressable
                      key={p.projectLaborer.id}
                      onPress={() => setSelectedPlId(p.projectLaborer.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      style={[styles.pillChip, isSelected && styles.pillChipActive]}
                    >
                      <AppText
                        size="sm"
                        weight="semibold"
                        color={isSelected ? 'accent' : 'textPrimary'}
                      >
                        {`${p.projectName} · ${formatRupees(p.balance.balance)}`}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {/* Owed hint — tapping quick-fills the amount, capped to the owed balance */}
            <Pressable
              onPress={() => setAmount(Math.floor(owed))}
              accessibilityRole="button"
              accessibilityLabel={`${t('owedToWorker')} ${formatRupees(owed)}`}
            >
              <AppText size="sm" weight="semibold" color="accent">
                {`${t('owedToWorker')}: ${formatRupees(owed)}`}
              </AppText>
            </Pressable>

            <AmountInput
              label={t('amount')}
              value={amount}
              onChange={setAmount}
              floating
              surface={theme.colors.card}
            />

            <Pressable
              onPress={() => setAccountSheet(true)}
              style={styles.rowChip}
              accessibilityRole="button"
            >
              <AppIcon
                name={selectedAccount?.type === 'BANK' ? 'bank' : 'balance'}
                size={18}
                color="primary"
              />
              <AppText
                size="sm"
                weight="semibold"
                numberOfLines={1}
                style={styles.flex}
                color={selectedAccount ? 'textPrimary' : 'textSecondary'}
              >
                {selectedAccount
                  ? `${selectedAccount.name} · ${formatRupees(selectedAccount.balance)}`
                  : t('selectAccount')}
              </AppText>
              <AppIcon name="forward" size={18} color="textSecondary" />
            </Pressable>

            {/* Payment date — always today, per the entry-form rules */}
            <View style={styles.dateRow}>
              <AppIcon name="today" size={16} color="textSecondary" />
              <AppText size="xs" color="textSecondary">
                {`${t('today')} · ${formatDisplayDate(today)}`}
              </AppText>
            </View>

            <AppButton
              label={t('payWorker')}
              icon="moneyOut"
              onPress={onPay}
              loading={saving}
              disabled={!canSave}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SelectSheet
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        options={accountOptions}
        selectedId={accountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setAccountId(o.id)}
      />
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    pillChip: {
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
    pillChipActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
    rowChip: {
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
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.overlay,
    },
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
    grabber: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
    },
  });
