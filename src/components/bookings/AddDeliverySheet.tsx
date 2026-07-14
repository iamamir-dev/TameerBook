import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AmountInput, AppButton, AppIcon, AppText, AppToggle, DateField, SelectSheet } from '@/components/ui';
import { addDelivery, payBooking, type AccountWithBalance } from '@/db';
import { useAccountOptions, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatPakistaniGrouping, formatRupees } from '@/utils/money';

interface Props {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  /** Qty the supplier still owes — a delivery can never exceed it. */
  qtyRemaining: number;
  unit: string | null;
  /** Money still owed on the booking (caps the paid-now amount). */
  payRemaining: number;
  accounts: AccountWithBalance[];
  /** Reload the booking after the delivery lands. */
  onSaved: () => Promise<void> | void;
}

/**
 * Record material arriving against the booking ("1000 bricks aa gayi aaj").
 * The remaining hint quick-fills the field; the repo's `LimitExceededError`
 * backstops the over-delivery guard.
 */
export function AddDeliverySheet({
  visible,
  onClose,
  bookingId,
  qtyRemaining,
  unit,
  payRemaining,
  accounts,
  onSaved,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const today = todayISO().slice(0, 10);
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  // "Also paid now": cash-on-delivery logs receive + pay in ONE sheet.
  const [paidNow, setPaidNow] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountSheet, setAccountSheet] = useState(false);
  const { saving, run: runSave } = useSaveAction();
  const accountOptions = useAccountOptions(accounts);
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  // Fresh form every open.
  useEffect(() => {
    if (visible) {
      setQty('');
      setDate(today);
      setNote('');
      setPaidNow(false);
      setPayAmount(0);
      setAccountId(accounts[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, accounts]);

  const qtyNum = Number(qty) || 0;
  const over = qtyNum > qtyRemaining;
  const payError =
    !paidNow || payAmount <= 0
      ? null
      : payAmount > payRemaining
        ? t('exceedsRemaining')
        : selectedAccount && payAmount > selectedAccount.balance
          ? t('insufficientFunds')
          : null;
  const canSave =
    qtyNum > 0 && !over && (!paidNow || (payAmount > 0 && !!accountId && !payError));
  const remainingText = `${formatPakistaniGrouping(qtyRemaining)}${unit ? ` ${unit}` : ''}`;

  const onSave = () => {
    if (!canSave || saving) return;
    void (async () => {
      const ok = await runSave(async () => {
        await addDelivery({ bookingId, qty: qtyNum, date, note: note.trim() || null });
        if (paidNow && accountId) {
          await payBooking({ bookingId, amount: payAmount, date, accountId, note: note.trim() || null });
        }
        await onSaved();
      });
      if (ok) onClose();
    })();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold">
            {t('addDelivery')}
          </AppText>

          {/* Remaining hint — tapping quick-fills the qty, capped at what is left */}
          <Pressable
            onPress={() => setQty(String(qtyRemaining))}
            accessibilityRole="button"
            accessibilityLabel={`${t('remainingQty')} ${remainingText}`}
          >
            <AppText size="sm" weight="semibold" color="accent">
              {`${t('remainingQty')}: ${remainingText}`}
            </AppText>
          </Pressable>

          <FloatingLabelInput label={t('qtyLabel')} value={qty} onChangeText={setQty} keyboardType="number-pad" />

          {over ? (
            <AppText size="xs" weight="semibold" color="danger">
              {t('exceedsRemaining')}
            </AppText>
          ) : null}

          {/* Delivery date — defaults to today, back-datable for late logging. */}
          <DateField value={date} onChange={setDate} maxDate={today} />

          <FloatingLabelInput label={t('note')} value={note} onChangeText={setNote} />

          {/* Cash-on-delivery: pay the supplier in the same save. */}
          <View style={styles.toggleRow}>
            <AppText size="sm" weight="semibold" style={styles.flex}>
              {t('alsoPaidNow')}
            </AppText>
            <AppToggle value={paidNow} onValueChange={setPaidNow} accessibilityLabel={t('alsoPaidNow')} />
          </View>

          {paidNow ? (
            <>
              <Pressable
                onPress={() => setPayAmount(Math.floor(payRemaining))}
                accessibilityRole="button"
              >
                <AppText size="sm" weight="semibold" color="accent">
                  {`${t('payRemainingLabel')}: ${formatRupees(payRemaining)}`}
                </AppText>
              </Pressable>
              <AmountInput
                label={t('amount')}
                value={payAmount}
                onChange={setPayAmount}
                floating
                surface={theme.colors.card}
                error={payError}
              />
              <Pressable onPress={() => setAccountSheet(true)} style={styles.rowChip} accessibilityRole="button">
                <AppIcon name={selectedAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
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
            </>
          ) : null}

          <AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!canSave} />
        </View>
      </KeyboardAvoidingView>

      <SelectSheet
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        options={accountOptions}
        selectedId={accountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setAccountId(o.id)}
      />
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    rowChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.background,
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
