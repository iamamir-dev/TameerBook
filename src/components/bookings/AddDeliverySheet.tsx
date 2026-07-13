import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AppButton, AppIcon, AppText } from '@/components/ui';
import { addDelivery } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatDisplayDate, todayISO } from '@/utils/date';
import { formatPakistaniGrouping } from '@/utils/money';

interface Props {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  /** Qty the supplier still owes — a delivery can never exceed it. */
  qtyRemaining: number;
  unit: string | null;
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
  onSaved,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const today = todayISO();
  const [qty, setQty] = useState('');
  const { saving, run: runSave } = useSaveAction();

  // Fresh form every open.
  useEffect(() => {
    if (visible) setQty('');
  }, [visible]);

  const qtyNum = Number(qty) || 0;
  const over = qtyNum > qtyRemaining;
  const canSave = qtyNum > 0 && !over;
  const remainingText = `${formatPakistaniGrouping(qtyRemaining)}${unit ? ` ${unit}` : ''}`;

  const onSave = () => {
    if (!canSave || saving) return;
    void (async () => {
      const ok = await runSave(async () => {
        await addDelivery({ bookingId, qty: qtyNum, date: today });
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

          {/* Delivery date — always today, per the entry-form rules */}
          <View style={styles.dateRow}>
            <AppIcon name="today" size={16} color="textSecondary" />
            <AppText size="xs" color="textSecondary">
              {`${t('today')} · ${formatDisplayDate(today)}`}
            </AppText>
          </View>

          <AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!canSave} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
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
