import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppIcon, AppText } from '@/components/ui';
import type { AttendanceStatus, LaborerProjectParticipation } from '@/db';
import { ATTENDANCE_STATUSES } from '@/db/schema';
import { useTranslation, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

const ATT_LABEL: Record<AttendanceStatus, TranslationKey> = {
  FULL: 'attFull',
  HALF: 'attHalf',
  ABSENT: 'attAbsent',
};

interface ParticipationCardProps {
  /** One project the worker is (or was) attached to, with its own balance. */
  participation: LaborerProjectParticipation;
  /** Mark today's attendance on THIS project (repo guards one dihari/day). */
  onMarkAttendance?: (status: AttendanceStatus) => void;
  /** Open the edit-dihari sheet for this participation. */
  onEditWage?: () => void;
  /** Open the month attendance calendar (view + mark any past date). */
  onOpenCalendar?: () => void;
  /** Disables marking while a save is in flight. */
  saving?: boolean;
}

/**
 * One project on the worker's khata: the project name (badge once completed),
 * today's attendance as a tap-to-mark segmented row, and the dihari (tap to
 * change it) next to the balance still owed there. Everything a worker needs
 * day-to-day is doable right here — no trip into the project required.
 * Completed projects render read-only.
 */
export function ParticipationCard({
  participation,
  onMarkAttendance,
  onEditWage,
  onOpenCalendar,
  saving,
}: ParticipationCardProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const { projectLaborer, projectName, projectStatus, balance, todayStatus } = participation;
  const completed = projectStatus === 'COMPLETED';
  const daysWorked = balance.daysFull + balance.daysHalf;
  const canMark = !completed && !!onMarkAttendance;

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.title}>
          <AppText size="md" weight="bold" numberOfLines={1}>
            {projectName}
          </AppText>
          <AppText size="xs" color="textSecondary">
            {`${daysWorked} ${t('daysLabel')}`}
          </AppText>
        </View>
        <StageBadge
          tone={completed ? 'success' : 'accent'}
          label={completed ? t('statusDone') : t('statusCurrent')}
        />
      </View>

      {/* Today's attendance — mark it for THIS project right here. The
          calendar icon opens the month grid (view + mark any past date). */}
      {canMark ? (
        <>
          <View style={styles.attHeader}>
            <AppText size="overline" weight="bold" color="textSecondary" uppercase>
              {`${t('attendanceTitle')} · ${t('today')}`}
            </AppText>
            {onOpenCalendar ? (
              <Pressable
                onPress={onOpenCalendar}
                hitSlop={theme.touch.hitSlop}
                accessibilityRole="button"
                accessibilityLabel={t('attendanceTitle')}
              >
                <AppIcon name="today" size={18} color="accent" />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.segmentRow}>
            {ATTENDANCE_STATUSES.map((s) => {
              const selected = todayStatus === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => onMarkAttendance(s)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.segmentChip, selected && styles.segmentChipActive]}
                >
                  <AppText size="sm" weight="bold" color={selected ? 'accent' : 'textSecondary'}>
                    {t(ATT_LABEL[s])}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {/* One stretched line — dihari (tap to change) | balance. */}
      <View style={styles.columns}>
        <Pressable
          onPress={completed ? undefined : onEditWage}
          disabled={completed || !onEditWage}
          accessibilityRole="button"
          accessibilityLabel={t('dailyWage')}
          style={({ pressed }) => [styles.col, pressed && styles.pressed]}
        >
          <View style={styles.wageRow}>
            <AppText size="sm" weight="semibold" tabular numberOfLines={1} adjustsFontSizeToFit>
              {formatRupees(projectLaborer.daily_wage)}
            </AppText>
            {!completed && onEditWage ? <AppIcon name="forward" size={14} color="textSecondary" /> : null}
          </View>
          <AppText size="xs" color="textSecondary" numberOfLines={1}>
            {t('dailyWage')}
          </AppText>
        </Pressable>
        <View style={styles.colDivider} />
        <View style={styles.col}>
          <AppText
            size="sm"
            weight="bold"
            color={balance.balance > 0 ? 'danger' : 'textPrimary'}
            tabular
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatRupees(balance.balance)}
          </AppText>
          <AppText size="xs" color="textSecondary" numberOfLines={1}>
            {t('wageBalance')}
          </AppText>
        </View>
      </View>
    </AppCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { gap: theme.spacing.sm },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    title: { flex: 1, gap: 2 },
    attHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    segmentRow: { flexDirection: 'row', gap: theme.spacing.sm },
    segmentChip: {
      flex: 1,
      minHeight: 40,
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
    columns: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.sm,
    },
    col: { flex: 1, alignItems: 'center', gap: 2 },
    wageRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    colDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
    pressed: { opacity: 0.7 },
  });
