import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountInput, AppButton, AppIcon, AppText, SelectSheet } from '@/components/ui';
import { payBooking, type AccountWithBalance } from '@/db';
import { useAccountOptions, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatDisplayDate, todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

interface Props {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  /** What is still owed on the booking — a payment can never exceed it. */
  payRemaining: number;
  accounts: AccountWithBalance[];
  /** Reload the booking after the payment lands. */
  onSaved: () => Promise<void> | void;
}

/**
 * Pay the supplier some of the booking value from an account. The to-pay hint
 * quick-fills the amount; the repo's `LimitExceededError` / insufficient-funds
 * guards backstop the inline checks.
 */
export function PayBookingSheet({
  visible,
  onClose,
  bookingId,
  payRemaining,
  accounts,
  onSaved,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const today = todayISO();
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountSheet, setAccountSheet] = useState(false);

  const { saving, run: runSave } = useSaveAction();
  const accountOptions = useAccountOptions(accounts);
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  // Fresh form every open.
  useEffect(() => {
    if (!visible) return;
    setAmount(0);
    setAccountId(null);
  }, [visible]);

  const over = amount > payRemaining;
  const canSave =
    amount > 0 && accountId !== null && !over && (!selectedAccount || amount <= selectedAccount.balance);

  const onPay = () => {
    if (!canSave || saving || !accountId) return;
    void (async () => {
      const ok = await runSave(async () => {
        await payBooking({ bookingId, amount, date: today, accountId });
        await onSaved();
      });
      if (ok) onClose();
    })();
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            <View style={styles.grabber} />
            <AppText size="lg" weight="bold">
              {t('payBookingLabel')}
            </AppText>

            {/* To-pay hint — tapping quick-fills the amount, capped at what is owed */}
            <Pressable
              onPress={() => setAmount(Math.floor(payRemaining))}
              accessibilityRole="button"
              accessibilityLabel={`${t('payRemainingLabel')} ${formatRupees(payRemaining)}`}
            >
              <AppText size="sm" weight="semibold" color="accent">
                {`${t('payRemainingLabel')}: ${formatRupees(payRemaining)}`}
              </AppText>
            </Pressable>

            <AmountInput
              label={t('amount')}
              value={amount}
              onChange={setAmount}
              floating
              surface={theme.colors.card}
            />

            {over ? (
              <AppText size="xs" weight="semibold" color="danger">
                {t('exceedsRemaining')}
              </AppText>
            ) : null}

            <Pressable onPress={() => setAccountSheet(true)} style={styles.rowChip} accessibilityRole="button">
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
              label={t('payBookingLabel')}
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
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
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
