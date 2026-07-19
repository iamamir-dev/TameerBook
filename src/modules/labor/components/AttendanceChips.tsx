import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui';
import { type AttendanceStatus } from '@/db';
import { ATTENDANCE_STATUSES } from '@/db/schema';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';

import { ATT_LABEL } from '../utils/attendance';
import { makeStyles } from '../styled/AttendanceChips.styles';

interface AttendanceChipsProps {
  /** The currently-marked status for the day (null = not marked). */
  value: AttendanceStatus | null;
  onMark: (status: AttendanceStatus) => void;
  disabled?: boolean;
}

/**
 * The ONE FULL / HALF / ABSENT segmented control. Replaces the identical
 * segment-row block that ParticipationCard, AttendanceCalendarSheet and the
 * in-project WorkerSheet each reimplemented (plus their private `ATT_LABEL`).
 */
export function AttendanceChips({ value, onMark, disabled }: AttendanceChipsProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  return (
    <View style={styles.row}>
      {ATTENDANCE_STATUSES.map((s) => {
        const selected = value === s;
        return (
          <Pressable
            key={s}
            onPress={() => onMark(s)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: !!disabled }}
            style={[styles.chip, selected && styles.chipActive]}
          >
            <AppText size="sm" weight="bold" color={selected ? 'accent' : 'textSecondary'}>
              {t(ATT_LABEL[s])}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
