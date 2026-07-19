import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { AppButton, AppSheet, AppText } from '@/components/ui';
import {
  listAttendance,
  markAttendance,
  type AccountWithBalance,
  type AttendanceStatus,
  type LaborAttendanceRow,
  type LaborerProjectParticipation,
  type ProjectLaborerSummary,
} from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatDisplayDate, todayISO } from '@/utils/date';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';

import { AttendanceChips } from './AttendanceChips';
import { PayWorkerSheet } from './PayWorkerSheet';
import { ATT_LABEL } from '../utils/attendance';
import { makeStyles } from '../styled/WorkerSheet.styles';

interface WorkerSheetProps {
  /** The worker to show; null keeps the sheet closed. */
  worker: ProjectLaborerSummary | null;
  onClose: () => void;
  accounts: AccountWithBalance[];
  /** Reload the screen's data after attendance/payment writes. */
  onSaved: () => Promise<void>;
}

/**
 * In-project worker sheet: mark today's attendance (shared `AttendanceChips`,
 * optimistic), review recent days, and pay wages — paying reuses the shared
 * `PayWorkerSheet` (one pay form for the whole app). On the shared `AppSheet`.
 */
export function WorkerSheet({ worker, onClose, accounts, onSaved }: WorkerSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const today = todayISO().slice(0, 10);

  const [attendance, setAttendance] = useState<LaborAttendanceRow[]>([]);
  const [optimisticStatus, setOptimisticStatus] = useState<AttendanceStatus | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const { saving: marking, run: runMark } = useSaveAction();

  // Reset + (re)load attendance whenever the worker changes; a ref drops stale
  // responses from rapid worker switches.
  const workerId = worker?.projectLaborer.id ?? null;
  const currentWorkerIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentWorkerIdRef.current = workerId;
    setAttendance([]);
    setOptimisticStatus(null);
    if (!workerId) return;
    listAttendance(workerId)
      .then((rows) => {
        if (currentWorkerIdRef.current === workerId) setAttendance(rows);
      })
      .catch(swallow('construction:attendance'));
  }, [workerId]);

  const todayStatus = useMemo(
    () => optimisticStatus ?? attendance.find((a) => a.date === today)?.status ?? null,
    [optimisticStatus, attendance, today]
  );

  const onMark = (status: AttendanceStatus): void => {
    if (!workerId || marking) return;
    setOptimisticStatus(status); // instant feedback
    void (async () => {
      const ok = await runMark(async () => {
        await markAttendance({ projectLaborerId: workerId, date: today, status });
        const rows = await listAttendance(workerId);
        if (currentWorkerIdRef.current === workerId) setAttendance(rows);
        await onSaved();
      });
      // Clear the optimistic value either way: on success the reloaded rows now
      // carry today's status; on failure we revert to the real value.
      setOptimisticStatus(null);
    })();
  };

  // A single-participation view of this worker for the shared pay sheet.
  const participation: LaborerProjectParticipation | null = worker
    ? {
        projectLaborer: worker.projectLaborer,
        projectName: '',
        projectStatus: '',
        balance: worker.balance,
        todayStatus: worker.todayStatus,
      }
    : null;

  return (
    <>
      <AppSheet visible={worker !== null} onClose={onClose} title={worker?.laborer.name ?? ''}>
        <AppText size="sm" color="textSecondary">
          {`${t('dailyWage')}: ${formatRupees(worker?.projectLaborer.daily_wage ?? 0)} · ${t('wageBalance')}: ${formatRupees(worker?.balance.balance ?? 0)}`}
        </AppText>

        <AppText size="overline" weight="bold" color="textSecondary" uppercase style={styles.sectionLabel}>
          {`${t('attendanceTitle')} · ${t('today')}`}
        </AppText>
        <AttendanceChips value={todayStatus} onMark={onMark} disabled={marking} dailyWage={worker?.projectLaborer.daily_wage} />

        {attendance.slice(0, 7).map((a) => (
          <View key={a.id} style={styles.attRow}>
            <AppText size="xs" color="textSecondary" style={styles.flex}>
              {formatDisplayDate(a.date)}
            </AppText>
            <AppText size="xs" weight="semibold" color={a.status === 'ABSENT' ? 'danger' : 'textPrimary'}>
              {t(ATT_LABEL[a.status])}
            </AppText>
          </View>
        ))}

        <AppButton
          label={t('payWorker')}
          icon="moneyOut"
          onPress={() => setPayOpen(true)}
          disabled={(worker?.balance.balance ?? 0) <= 0}
        />
      </AppSheet>

      {/* Paying reuses the shared sheet (one pay form, one repo call). */}
      <PayWorkerSheet
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        participations={participation ? [participation] : []}
        accounts={accounts}
        onSaved={async () => {
          setPayOpen(false);
          onClose();
          await onSaved();
        }}
      />
    </>
  );
}
