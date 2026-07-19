import React from 'react';
import { Pressable, View } from 'react-native';

import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppIcon, AppText } from '@/components/ui';
import type { AttendanceStatus, LaborerProjectParticipation } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { AttendanceChips } from './AttendanceChips';
import { makeStyles } from '../styled/ParticipationCard.styles';

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
 * One project on the worker's khata: name (badge once completed), today's
 * attendance via the shared `AttendanceChips`, and the dihari (tap to change)
 * next to the balance owed there. Completed projects render read-only.
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
        <StageBadge tone={completed ? 'success' : 'accent'} label={completed ? t('statusDone') : t('statusCurrent')} />
      </View>

      {/* Today's attendance — mark it for THIS project here; the calendar icon
          opens the month grid (view + mark any past date). */}
      {canMark ? (
        <>
          <View style={styles.attHeader}>
            <AppText size="overline" weight="bold" color="textSecondary" uppercase>
              {`${t('attendanceTitle')} · ${t('today')}`}
            </AppText>
            {onOpenCalendar ? (
              <Pressable onPress={onOpenCalendar} hitSlop={theme.touch.hitSlop} accessibilityRole="button" accessibilityLabel={t('attendanceTitle')}>
                <AppIcon name="today" size={18} color="accent" />
              </Pressable>
            ) : null}
          </View>
          <AttendanceChips value={todayStatus} onMark={onMarkAttendance!} disabled={saving} />
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
          <AppText size="sm" weight="bold" color={balance.balance > 0 ? 'danger' : 'textPrimary'} tabular numberOfLines={1} adjustsFontSizeToFit>
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
