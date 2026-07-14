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

const MONTHS = Array.from({ length: 12 }, (_, i) => dayjs().month(i).format('MMM'));

/**
 * The app's reusable month grid ("date picker"): a header you can TAP to jump
 * to any month or year (◀ year ▶ + a month grid), a Sunday-first weekday row,
 * and one rounded cell per day. Callers color days via `dayVisual` and receive
 * taps via `onSelectDate`. Pure theme tokens — drop it in any card or sheet.
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
  // 'days' = the day grid; 'pick' = the month + year chooser.
  const [mode, setMode] = useState<'days' | 'pick'>('days');
  // Year being browsed in 'pick' mode (independent of `month` until confirmed).
  const [pickYear, setPickYear] = useState(month.year());

  const limit = maxDate ?? dayjs().format('YYYY-MM-DD');
  const limitMonth = dayjs(limit).startOf('month');
  const canGoNext = !month.add(1, 'month').startOf('month').isAfter(limitMonth, 'month');

  const changeMonth = (next: Dayjs) => {
    setMonth(next);
    onMonthChange?.(next.format('YYYY-MM'));
  };

  const openPicker = () => {
    setPickYear(month.year());
    setMode('pick');
  };

  const chooseMonth = (m: number) => {
    changeMonth(month.year(pickYear).month(m).startOf('month'));
    setMode('days');
  };

  /* Leading blanks (Sunday-first) + one cell per day of the month. */
  const cells: (string | null)[] = [
    ...Array.from({ length: month.day() }, () => null),
    ...Array.from({ length: month.daysInMonth() }, (_, i) => month.date(i + 1).format('YYYY-MM-DD')),
  ];

  return (
    <View style={styles.wrap}>
      {/* Header: prev / tappable Month YYYY / next */}
      <View style={styles.monthRow}>
        <Pressable
          onPress={() => changeMonth(month.subtract(1, 'month'))}
          hitSlop={theme.touch.hitSlop}
          accessibilityRole="button"
          style={styles.monthBtn}
        >
          <AppIcon name="back" size={18} color="accent" />
        </Pressable>
        <Pressable
          onPress={mode === 'pick' ? () => setMode('days') : openPicker}
          hitSlop={theme.touch.hitSlop}
          accessibilityRole="button"
          style={styles.monthLabelBtn}
        >
          <AppText size="md" weight="bold" center>
            {month.format('MMMM YYYY')}
          </AppText>
          <AppIcon name={mode === 'pick' ? 'collapse' : 'expand'} size={16} color="textSecondary" />
        </Pressable>
        <Pressable
          onPress={() => canGoNext && changeMonth(month.add(1, 'month'))}
          hitSlop={theme.touch.hitSlop}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGoNext }}
          style={[styles.monthBtn, !canGoNext && styles.monthBtnDisabled]}
        >
          <AppIcon name="forward" size={18} color={canGoNext ? 'accent' : 'textSecondary'} />
        </Pressable>
      </View>

      {mode === 'pick' ? (
        <View style={styles.picker}>
          {/* Year stepper */}
          <View style={styles.yearRow}>
            <Pressable
              onPress={() => setPickYear((y) => y - 1)}
              hitSlop={theme.touch.hitSlop}
              accessibilityRole="button"
              style={styles.monthBtn}
            >
              <AppIcon name="back" size={18} color="accent" />
            </Pressable>
            <AppText size="lg" weight="bold" center style={styles.yearLabel} tabular>
              {String(pickYear)}
            </AppText>
            <Pressable
              onPress={() => pickYear < limitMonth.year() && setPickYear((y) => y + 1)}
              hitSlop={theme.touch.hitSlop}
              accessibilityRole="button"
              accessibilityState={{ disabled: pickYear >= limitMonth.year() }}
              style={[styles.monthBtn, pickYear >= limitMonth.year() && styles.monthBtnDisabled]}
            >
              <AppIcon
                name="forward"
                size={18}
                color={pickYear >= limitMonth.year() ? 'textSecondary' : 'accent'}
              />
            </Pressable>
          </View>

          {/* Month grid (3 per row) */}
          <View style={styles.monthGrid}>
            {MONTHS.map((label, m) => {
              const isFuture = dayjs().year(pickYear).month(m).startOf('month').isAfter(limitMonth, 'month');
              const isCurrent = month.year() === pickYear && month.month() === m;
              return (
                <Pressable
                  key={label}
                  onPress={() => !isFuture && chooseMonth(m)}
                  disabled={isFuture}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isCurrent, disabled: isFuture }}
                  style={[
                    styles.monthCell,
                    isCurrent && styles.monthCellActive,
                    isFuture && styles.dayDisabled,
                  ]}
                >
                  <AppText
                    size="sm"
                    weight={isCurrent ? 'bold' : 'semibold'}
                    color={isCurrent ? 'onAccent' : isFuture ? 'textSecondary' : 'accent'}
                  >
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <>
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
              const isToday = date === dayjs().format('YYYY-MM-DD');
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
                      isToday && !isSelected && styles.dayToday,
                      isSelected && styles.daySelected,
                      disabled && styles.dayDisabled,
                    ]}
                  >
                    <AppText
                      size="sm"
                      weight={visual.tone || isSelected || isToday ? 'bold' : 'regular'}
                      color={
                        isSelected
                          ? 'onAccent'
                          : disabled
                            ? 'textSecondary'
                            : visual.tone ?? (isToday ? 'accent' : 'textPrimary')
                      }
                      tabular
                    >
                      {String(dayjs(date).date())}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: theme.spacing.sm },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    monthBtn: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthBtnDisabled: { opacity: 0.4 },
    monthLabelBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      minHeight: 36,
    },
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
      backgroundColor: theme.colors.accent,
    },
    dayToday: {
      borderWidth: 1.5,
      borderColor: theme.colors.accent,
    },
    dayDisabled: { opacity: 0.35 },
    /* month + year picker */
    picker: { gap: theme.spacing.md, paddingVertical: theme.spacing.xs },
    yearRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    yearLabel: { flex: 1 },
    monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    monthCell: {
      width: '31%',
      flexGrow: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.accentSoft,
    },
    monthCellActive: { backgroundColor: theme.colors.accent },
  });
