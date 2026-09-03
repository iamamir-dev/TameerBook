import React from 'react';
import { View } from 'react-native';

import type { AnswerCalendar } from '@/ai';
import { AppText } from '@/components/ui';
import { ATT_LABEL, ATT_SOFT, ATT_TONE } from '@/modules/labor';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/AttendanceGrid.styles';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * A small, display-only month grid for attendance answers: weekday initials,
 * one soft-filled circle per marked day (green full, gold half, red absent),
 * plain numerals for unmarked days, and a legend with counts. No navigation,
 * no taps: the card title already names the month.
 */
export function AttendanceGrid({ calendar }: { calendar: AnswerCalendar }): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const [y, m] = calendar.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = first.getDay(); // Sunday-first, like the app's calendar
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const iso = (d: number) => `${calendar.month}-${String(d).padStart(2, '0')}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {WEEKDAYS.map((d, i) => (
          <AppText key={`${d}-${i}`} size="xs" weight="bold" color="textSecondary" style={styles.weekday}>
            {d}
          </AppText>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((d, di) => {
            const status = d ? calendar.days[iso(d)] : undefined;
            return (
              <View key={di} style={styles.cell}>
                {d ? (
                  <View style={[styles.day, status && { backgroundColor: theme.colors[ATT_SOFT[status]] }]}>
                    <AppText size="xs" weight={status ? 'bold' : 'regular'} color={status ? ATT_TONE[status] : 'textSecondary'} tabular>
                      {d}
                    </AppText>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        {(['FULL', 'HALF', 'ABSENT'] as const).map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: theme.colors[ATT_SOFT[s]] }]} />
            <AppText size="xs" color="textSecondary">
              {`${t(ATT_LABEL[s])} ${s === 'FULL' ? calendar.full : s === 'HALF' ? calendar.half : calendar.absent}`}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
