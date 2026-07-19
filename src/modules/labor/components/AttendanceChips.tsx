import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui';
import { type AttendanceStatus } from '@/db';
import { ATTENDANCE_STATUSES } from '@/db/schema';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { ATT_LABEL, ATT_SOFT, ATT_TONE } from '../utils/attendance';
import { makeStyles } from '../styled/AttendanceChips.styles';

interface AttendanceChipsProps {
  /** The currently-marked status for the day (null = not marked). */
  value: AttendanceStatus | null;
  onMark: (status: AttendanceStatus) => void;
  disabled?: boolean;
  /** When set, show the wage each choice logs under FULL/HALF (helps the user). */
  dailyWage?: number;
}

/** Wage this status accrues (mirrors repo `wageForStatus`; HALF rounds). */
function accrualFor(status: AttendanceStatus, wage: number): number | null {
  if (wage <= 0) return null;
  if (status === 'FULL') return wage;
  if (status === 'HALF') return Math.round(wage / 2);
  return null; // ABSENT earns nothing
}

/**
 * The ONE FULL / HALF / ABSENT segmented control. Selected chip wears its
 * status colour (FULL green / HALF gold / ABSENT red) — matching the calendar,
 * so "color = meaning" holds — and can show the wage each choice logs.
 */
export function AttendanceChips({ value, onMark, disabled, dailyWage }: AttendanceChipsProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  return (
    <View style={styles.row}>
      {ATTENDANCE_STATUSES.map((s) => {
        const selected = value === s;
        const tone = ATT_TONE[s];
        const amt = dailyWage !== undefined ? accrualFor(s, dailyWage) : null;
        return (
          <Pressable
            key={s}
            onPress={() => onMark(s)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: !!disabled }}
            style={[
              styles.chip,
              selected && { borderColor: theme.colors[tone], backgroundColor: theme.colors[ATT_SOFT[s]] },
            ]}
          >
            <AppText size="sm" weight="bold" color={selected ? tone : 'textSecondary'}>
              {t(ATT_LABEL[s])}
            </AppText>
            {amt !== null ? (
              <AppText size="xs" weight="semibold" tabular color={selected ? tone : 'textSecondary'}>
                {formatRupees(amt)}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
