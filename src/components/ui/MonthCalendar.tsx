import dayjs, { type Dayjs } from 'dayjs';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import type { ColorKey } from '@/utils/tones';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

/** How one date renders: a soft fill + the day number's tone. */
export interface DayVisual {
  bg?: string;
  tone?: ColorKey;
}

export interface MonthCalendarProps {
  /** ISO date currently selected (ring highlight), or null. */
  selected?: string | null;
  /** Tap handler for an enabled day. */
  onSelectDate: (date: string) => void;
  /**
   * Per-date visual (e.g. attendance status colors). Return null/undefined
   * for a plain day. Keyed lookups should be O(1) — this runs per cell.
   */
  dayVisual?: (date: string) => DayVisual | null | undefined;
  /** Latest selectable date (default: today). Later days render disabled. */
  maxDate?: string;
  /** Month shown first (default: the current month). */
  initialMonth?: string;
  /** Notified when the visible month changes (YYYY-MM), e.g. to load data. */
  onMonthChange?: (monthPrefix: string) => void;
}

/**
 * The app's reusable month grid ("date picker"): a month switcher, a
 * Sunday-first weekday header, and one rounded cell per day. Callers color
 * days via `dayVisual` (attendance, activity, deadlines …) and receive taps
 * via `onSelectDate`. Pure theme tokens — drop it in any card or sheet.
 */
export function MonthCalendar({
  selected,
  onSelectDate,
  dayVisual,
  maxDate,
  initialMonth,
  onMonthChange,
}: MonthCalendarProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const [month, setMonth] = useState<Dayjs>(() =>
    (initialMonth ? dayjs(initialMonth) : dayjs()).startOf('month')
  );

  const limit = maxDate ?? dayjs().format('YYYY-MM-DD');
  const canGoNext = month.add(1, 'month').startOf('month').format('YYYY-MM-DD') <= limit;

  const changeMonth = (next: Dayjs) => {
    setMonth(next);
    onMonthChange?.(next.format('YYYY-MM'));
  };

  /* Leading blanks (Sunday-first) + one cell per day of the month. */
  const cells: (string | null)[] = [
    ...Array.from({ length: month.day() }, () => null),
    ...Array.from({ length: month.daysInMonth() }, (_, i) => month.date(i + 1).format('YYYY-MM-DD')),
  ];

  return (
    <View style={styles.wrap}>
      {/* Month switcher */}
      <View style={styles.monthRow}>
        <Pressable
          onPress={() => changeMonth(month.subtract(1, 'month'))}
          hitSlop={theme.touch.hitSlop}
          accessibilityRole="button"
          style={styles.monthBtn}
        >
          <AppIcon name="back" size={18} color="textPrimary" />
        </Pressable>
        <AppText size="md" weight="bold" center style={styles.monthLabel}>
          {month.format('MMM YYYY')}
        </AppText>
        <Pressable
          onPress={() => canGoNext && changeMonth(month.add(1, 'month'))}
          hitSlop={theme.touch.hitSlop}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGoNext }}
          style={[styles.monthBtn, !canGoNext && styles.monthBtnDisabled]}
        >
          <AppIcon name="forward" size={18} color={canGoNext ? 'textPrimary' : 'textSecondary'} />
        </Pressable>
      </View>

      {/* Weekday header (Sunday-first) */}
      <View style={styles.week}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <AppText key={`${d}-${i}`} size="xs" weight="semibold" color="textSecondary" center style={styles.weekDay}>
            {d}
          </AppText>
        ))}
      </View>

      {/* Day grid */}
      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={`blank-${i}`} style={styles.cell} />;
          const disabled = date > limit;
          const isSelected = date === selected;
          const visual = (!disabled && dayVisual?.(date)) || {};
          return (
            <Pressable
              key={date}
              onPress={() => !disabled && onSelectDate(date)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={date}
              accessibilityState={{ selected: isSelected, disabled }}
              style={styles.cell}
            >
              <View
                style={[
                  styles.day,
                  { backgroundColor: visual.bg ?? 'transparent' },
                  isSelected && styles.daySelected,
                  disabled && styles.dayDisabled,
                ]}
              >
                <AppText
                  size="sm"
                  weight={visual.tone || isSelected ? 'bold' : 'regular'}
                  color={disabled ? 'textSecondary' : visual.tone ?? 'textPrimary'}
                  tabular
                >
                  {String(dayjs(date).date())}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: theme.spacing.sm },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    monthBtn: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthBtnDisabled: { opacity: 0.4 },
    monthLabel: { flex: 1 },
    week: { flexDirection: 'row' },
    weekDay: { flex: 1 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 2,
    },
    day: {
      width: '100%',
      height: '100%',
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    daySelected: {
      borderWidth: 1.5,
      borderColor: theme.colors.primary,
    },
    dayDisabled: { opacity: 0.35 },
  });
