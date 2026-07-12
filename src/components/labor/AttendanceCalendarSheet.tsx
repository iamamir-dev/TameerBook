import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, MonthCalendar, type DayVisual } from '@/components/ui';
import {
  listAttendance,
  markAttendance,
  type AttendanceStatus,
  type LaborAttendanceRow,
} from '@/db';
import { ATTENDANCE_STATUSES } from '@/db/schema';
import { useSaveAction } from '@/hooks';
import { useTranslation, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';

const ATT_LABEL: Record<AttendanceStatus, TranslationKey> = {
  FULL: 'attFull',
  HALF: 'attHalf',
  ABSENT: 'attAbsent',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  projectLaborerId: string | null;
  projectName: string;
  /** Called after any mark (parent reloads the khata). */
  onSaved: () => Promise<void> | void;
}

/**
 * The worker's attendance calendar for ONE project, built on the reusable
 * `MonthCalendar`: every day wears its status — green full dihari, gold half
 * day, red absent — so the month reads at a glance. Tap any past day (or
 * today) and mark FULL / HALF / ABSENT for THAT date. The one-dihari-a-day
 * guard still applies across projects.
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
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [monthPrefix, setMonthPrefix] = useState(dayjs().format('YYYY-MM'));
  const [rows, setRows] = useState<LaborAttendanceRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const { saving, run: runSave } = useSaveAction();

  const loadMonth = useCallback(async () => {
    if (!projectLaborerId) return;
    setRows(await listAttendance(projectLaborerId, monthPrefix));
  }, [projectLaborerId, monthPrefix]);

  // Today preselected on open; reload rows on open and per month change.
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
    switch (statusOf(date)) {
      case 'FULL':
        return { bg: theme.colors.accentSoft, tone: 'accent' };
      case 'HALF':
        return { bg: theme.colors.goldSoft, tone: 'gold' };
      case 'ABSENT':
        return { bg: theme.colors.dangerSoft, tone: 'danger' };
      default:
        return null;
    }
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <View style={styles.grabber} />
        <AppText size="lg" weight="bold">
          {t('attendanceTitle')}
        </AppText>
        <AppText size="sm" color="textSecondary" numberOfLines={1}>
          {projectName}
        </AppText>

        <MonthCalendar
          selected={selected}
          onSelectDate={setSelected}
          dayVisual={dayVisual}
          onMonthChange={setMonthPrefix}
        />

        {/* Legend */}
        <View style={styles.legend}>
          {ATTENDANCE_STATUSES.map((s) => {
            const v = s === 'FULL'
              ? { bg: theme.colors.accentSoft, tone: 'accent' as const }
              : s === 'HALF'
                ? { bg: theme.colors.goldSoft, tone: 'gold' as const }
                : { bg: theme.colors.dangerSoft, tone: 'danger' as const };
            return (
              <View key={s} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: v.bg }]} />
                <AppText size="xs" weight="semibold" color={v.tone}>
                  {t(ATT_LABEL[s])}
                </AppText>
              </View>
            );
          })}
        </View>

        {/* Mark the selected date */}
        {selected ? (
          <>
            <View style={styles.rule} />
            <AppText size="overline" weight="bold" color="textSecondary" uppercase>
              {dayjs(selected).format('DD MMM YYYY')}
            </AppText>
            <View style={styles.segmentRow}>
              {ATTENDANCE_STATUSES.map((s) => {
                const active = selectedStatus === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => onMark(s)}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.segmentChip, active && styles.segmentChipActive]}
                  >
                    <AppText size="sm" weight="bold" color={active ? 'accent' : 'textSecondary'}>
                      {t(ATT_LABEL[s])}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.overlay },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.sm,
      ...theme.shadows.raised,
    },
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    legend: { flexDirection: 'row', gap: theme.spacing.lg, justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    legendDot: { width: 12, height: 12, borderRadius: 6 },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginVertical: theme.spacing.xs },
    segmentRow: { flexDirection: 'row', gap: theme.spacing.sm },
    segmentChip: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    segmentChipActive: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accentSoft,
    },
  });
