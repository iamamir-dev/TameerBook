import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppSheet, AppText, MonthCalendar, type DayVisual } from '@/components/ui';
import {
  listAttendance,
  markAttendance,
  type AttendanceStatus,
  type LaborAttendanceRow,
} from '@/db';
import { ATTENDANCE_STATUSES } from '@/db/schema';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { swallow } from '@/utils/log';

import { AttendanceChips } from './AttendanceChips';
import { ATT_LABEL, ATT_SOFT, ATT_TONE } from '../utils/attendance';
import { makeStyles } from '../styled/AttendanceCalendarSheet.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  projectLaborerId: string | null;
  projectName: string;
  /** Called after any mark (parent reloads the khata). */
  onSaved: () => Promise<void> | void;
}

/**
 * The worker's attendance calendar for ONE project, on the shared `AppSheet` +
 * `MonthCalendar`: each day wears its status colour; tap a past/today date and
 * mark FULL/HALF/ABSENT via the shared `AttendanceChips`.
 */
export function AttendanceCalendarSheet({
  visible,
  onClose,
  projectLaborerId,
  projectName,
  onSaved,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const [monthPrefix, setMonthPrefix] = useState(dayjs().format('YYYY-MM'));
  const [rows, setRows] = useState<LaborAttendanceRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const { saving, run: runSave } = useSaveAction();

  const loadMonth = useCallback(async () => {
    if (!projectLaborerId) return;
    setRows(await listAttendance(projectLaborerId, monthPrefix));
  }, [projectLaborerId, monthPrefix]);

  useEffect(() => {
    if (visible) {
      setMonthPrefix(dayjs().format('YYYY-MM'));
      setSelected(dayjs().format('YYYY-MM-DD'));
    }
  }, [visible]);

  useEffect(() => {
    if (visible) loadMonth().catch(swallow('attendanceCalendar:load'));
  }, [visible, loadMonth]);

  const statusOf = (date: string): AttendanceStatus | null =>
    rows.find((r) => r.date === date)?.status ?? null;

  const dayVisual = (date: string): DayVisual | null => {
    const s = statusOf(date);
    return s ? { bg: theme.colors[ATT_SOFT[s]], tone: ATT_TONE[s] } : null;
  };

  const onMark = (status: AttendanceStatus) => {
    if (!projectLaborerId || !selected) return;
    void runSave(async () => {
      await markAttendance({ projectLaborerId, date: selected, status });
      await loadMonth();
      await onSaved();
    });
  };

  const selectedStatus = selected ? statusOf(selected) : null;

  return (
    <AppSheet visible={visible} onClose={onClose} title={t('attendanceTitle')}>
      <AppText size="sm" color="textSecondary" numberOfLines={1}>
        {projectName}
      </AppText>

      <MonthCalendar selected={selected} onSelectDate={setSelected} dayVisual={dayVisual} onMonthChange={setMonthPrefix} />

      {/* Legend */}
      <View style={styles.legend}>
        {ATTENDANCE_STATUSES.map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors[ATT_SOFT[s]] }]} />
            <AppText size="xs" weight="semibold" color={ATT_TONE[s]}>
              {t(ATT_LABEL[s])}
            </AppText>
          </View>
        ))}
      </View>

      {selected ? (
        <>
          <View style={styles.rule} />
          <AppText size="overline" weight="bold" color="textSecondary" uppercase>
            {dayjs(selected).format('DD MMM YYYY')}
          </AppText>
          <AttendanceChips value={selectedStatus} onMark={onMark} disabled={saving} />
        </>
      ) : null}
    </AppSheet>
  );
}
