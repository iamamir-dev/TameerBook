import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AmountInput,
  AppButton,
  AppIcon,
  AppText,
  SelectSheet,
} from '@/components/ui';
import {
  listAttendance,
  markAttendance,
  payLaborer,
  type AccountWithBalance,
  type AttendanceStatus,
  type LaborAttendanceRow,
  type ProjectLaborerSummary,
} from '@/db';
import { useAccountOptions, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatDisplayDate, todayISO } from '@/utils/date';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';

const ATTENDANCE_CHOICES: AttendanceStatus[] = ['FULL', 'HALF', 'ABSENT'];

interface WorkerSheetProps {
  /** The worker to show; null keeps the sheet closed. */
  worker: ProjectLaborerSummary | null;
  onClose: () => void;
  accounts: AccountWithBalance[];
  /** Reload the screen's data after attendance/payment writes. */
  onSaved: () => Promise<void>;
}

/**
 * Bottom sheet for one worker's khata: mark today's attendance, review the
 * recent days, and pay wages from an account. Loads the attendance history
 * itself (stale responses from rapid worker switches are dropped) and owns
 * the pay form state.
 */
export function WorkerSheet({ worker, onClose, accounts, onSaved }: WorkerSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const today = todayISO().slice(0, 10);

  const [attendance, setAttendance] = useState<LaborAttendanceRow[]>([]);
  const [payAmount, setPayAmount] = useState(0);
  const [payAccountId, setPayAccountId] = useState<string | null>(null);
  const [payAccountSheet, setPayAccountSheet] = useState(false);

  const { saving: paying, run: runPay } = useSaveAction();
  const { saving: marking, run: runMark } = useSaveAction();

  const accountOptions = useAccountOptions(accounts);
  const selectedPayAccount = accounts.find((a) => a.id === payAccountId) ?? null;

  // Reset the form and (re)load attendance whenever the worker changes. The
  // ref guards against two rapid taps racing: a slow response for a previous
  // worker must not overwrite the current one's attendance.
  const workerId = worker?.projectLaborer.id ?? null;
  const currentWorkerIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentWorkerIdRef.current = workerId;
    setPayAmount(0);
    setPayAccountId(null);
    setAttendance([]);
    if (!workerId) return;
    listAttendance(workerId)
      .then((rows) => {
        if (currentWorkerIdRef.current === workerId) setAttendance(rows);
      })
      .catch(swallow('construction:attendance'));
  }, [workerId]);

  const todayStatus = useMemo(
    () => attendance.find((a) => a.date === today)?.status ?? null,
    [attendance, today]
  );

  const statusLabel = (s: AttendanceStatus): string =>
    t(s === 'FULL' ? 'attFull' : s === 'HALF' ? 'attHalf' : 'attAbsent');

  const onMarkAttendance = (status: AttendanceStatus): void => {
    if (!workerId || marking) return;
    void runMark(async () => {
      await markAttendance({ projectLaborerId: workerId, date: today, status });
      const rows = await listAttendance(workerId);
      if (currentWorkerIdRef.current === workerId) setAttendance(rows);
      await onSaved();
    });
  };

  const onPayWorker = (): void => {
    if (!workerId || payAmount <= 0 || !payAccountId) return;
    void runPay(async () => {
      await payLaborer({
        projectLaborerId: workerId,
        amount: payAmount,
        date: today,
        accountId: payAccountId,
      });
      onClose();
      await onSaved();
    });
  };

  return (
    <>
      <Modal visible={worker !== null} transparent animationType="fade" onRequestClose={onClose}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold">
            {worker?.laborer.name ?? ''}
          </AppText>
          <AppText size="sm" color="textSecondary">
            {t('dailyWage')}: {formatRupees(worker?.projectLaborer.daily_wage ?? 0)} · {t('wageBalance')}:{' '}
            {formatRupees(worker?.balance.balance ?? 0)}
          </AppText>

          {/* Today's attendance */}
          <AppText size="overline" weight="bold" color="textSecondary" uppercase>
            {t('attendanceTitle')} · {t('today')}
          </AppText>
          <View style={styles.segmentRow}>
            {ATTENDANCE_CHOICES.map((s) => {
              const selected = todayStatus === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => onMarkAttendance(s)}
                  disabled={marking}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.segmentChip, selected && styles.segmentChipActive]}
                >
                  <AppText size="sm" weight="bold" color={selected ? 'accent' : 'textSecondary'}>
                    {statusLabel(s)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {/* Recent attendance */}
          {attendance.slice(0, 7).map((a) => (
            <View key={a.id} style={styles.attRow}>
              <AppText size="xs" color="textSecondary" style={styles.flex}>
                {formatDisplayDate(a.date)}
              </AppText>
              <AppText size="xs" weight="semibold" color={a.status === 'ABSENT' ? 'danger' : 'textPrimary'}>
                {statusLabel(a.status)}
              </AppText>
            </View>
          ))}

          {/* Pay the worker */}
          <AppText size="overline" weight="bold" color="textSecondary" uppercase>
            {t('payWorker')}
          </AppText>
          <AmountInput value={payAmount} onChange={setPayAmount} floating surface={theme.colors.card} />
          <Pressable onPress={() => setPayAccountSheet(true)} style={styles.rowChip} accessibilityRole="button">
            <AppIcon name={selectedPayAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
            <AppText
              size="sm"
              weight="semibold"
              numberOfLines={1}
              style={styles.flex}
              color={selectedPayAccount ? 'textPrimary' : 'textSecondary'}
            >
              {selectedPayAccount
                ? `${selectedPayAccount.name} · ${formatRupees(selectedPayAccount.balance)}`
                : t('selectAccount')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>
          <AppButton
            label={t('payWorker')}
            icon="moneyOut"
            onPress={onPayWorker}
            loading={paying}
            disabled={
              payAmount <= 0 ||
              !payAccountId ||
              (!!selectedPayAccount && payAmount > selectedPayAccount.balance)
            }
          />
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <SelectSheet
        visible={payAccountSheet}
        onClose={() => setPayAccountSheet(false)}
        options={accountOptions}
        selectedId={payAccountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setPayAccountId(o.id)}
      />
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    /* attendance segmented control */
    segmentRow: { flexDirection: 'row', gap: theme.spacing.sm },
    segmentChip: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: theme.touch.minTarget,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    segmentChipActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
    attRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
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
