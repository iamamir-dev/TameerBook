import dayjs from 'dayjs';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { MonthCalendar } from './MonthCalendar';

interface DateFieldProps {
  /** Selected date, ISO 'YYYY-MM-DD'. */
  value: string;
  onChange: (date: string) => void;
  /** Latest selectable date (default: today). */
  maxDate?: string;
}

/**
 * A drop-in date field: a chip showing the chosen date ("Today" when it is)
 * that opens a CENTERED calendar dialog — a green (accent) header with the
 * picked date written out, the month grid below, and Today / Cancel actions.
 * The calendar (`MonthCalendar`) jumps month AND year, so any past date is a
 * few taps away.
 */
export function DateField({ value, onChange, maxDate }: DateFieldProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const [open, setOpen] = useState(false);

  const today = todayISO().slice(0, 10);
  const isToday = value === today;
  const label = isToday ? t('today') : dayjs(value).format('DD MMM YYYY');

  const pick = (d: string) => {
    onChange(d);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.chip}
        accessibilityRole="button"
        accessibilityLabel={t('date')}
      >
        <AppIcon name="today" size={18} color="accent" />
        <AppText size="sm" weight="semibold" style={styles.flex}>
          {label}
        </AppText>
        <AppIcon name="forward" size={18} color="textSecondary" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={styles.root}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={t('cancel')} />

          <View style={styles.dialog}>
            {/* Green hero header: the chosen date, written out */}
            <View style={styles.hero}>
              <AppText size="sm" weight="semibold" color="onAccent" style={styles.heroDay}>
                {dayjs(value).format('dddd')}
              </AppText>
              <AppText size="xxl" weight="bold" color="onAccent">
                {dayjs(value).format('DD MMM YYYY')}
              </AppText>
            </View>

            <View style={styles.body}>
              <MonthCalendar
                selected={value}
                maxDate={maxDate}
                initialMonth={value}
                onSelectDate={pick}
              />
            </View>

            {/* Footer actions */}
            <View style={styles.footer}>
              <Pressable
                onPress={() => pick(today)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.footerBtn, pressed && styles.pressed]}
              >
                <AppIcon name="today" size={16} color="accent" />
                <AppText size="sm" weight="bold" color="accent">
                  {t('today')}
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.footerBtn, pressed && styles.pressed]}
              >
                <AppText size="sm" weight="bold" color="textSecondary">
                  {t('cancel')}
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      minHeight: theme.touch.minTarget,
    },
    root: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.overlay,
      padding: theme.spacing.xl,
    },
    backdrop: { ...StyleSheet.absoluteFillObject },
    dialog: {
      width: '100%',
      maxWidth: 380,
      borderRadius: theme.radius.hero,
      backgroundColor: theme.colors.card,
      overflow: 'hidden',
      ...theme.shadows.raised,
    },
    hero: {
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
      gap: 2,
    },
    heroDay: { opacity: 0.85 },
    body: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    footerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
    },
    pressed: { opacity: 0.6 },
  });
