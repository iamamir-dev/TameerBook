import dayjs from 'dayjs';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
 * that opens a bottom-sheet calendar. The calendar (`MonthCalendar`) lets the
 * user jump month AND year, so any past date is a few taps away. Replaces the
 * old "last 14 days" list so entries can be back-dated freely.
 */
export function DateField({ value, onChange, maxDate }: DateFieldProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const [open, setOpen] = useState(false);

  const isToday = value === todayISO().slice(0, 10);
  const label = isToday ? t('today') : dayjs(value).format('DD MMM YYYY');

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.chip}
        accessibilityRole="button"
        accessibilityLabel={t('date')}
      >
        <AppIcon name="today" size={18} color="primary" />
        <AppText size="sm" weight="semibold" style={styles.flex}>
          {label}
        </AppText>
        <AppIcon name="forward" size={18} color="textSecondary" />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={styles.root}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={t('cancel')} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.md }]}>
            <View style={styles.grabber} />
            <AppText size="lg" weight="bold" style={styles.title}>
              {t('date')}
            </AppText>
            <MonthCalendar
              selected={value}
              maxDate={maxDate}
              initialMonth={value}
              onSelectDate={(d) => {
                onChange(d);
                setOpen(false);
              }}
            />
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
    root: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay },
    backdrop: { ...StyleSheet.absoluteFillObject },
    sheet: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      paddingHorizontal: theme.spacing.lg,
      ...theme.shadows.raised,
    },
    grabber: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
      marginVertical: theme.spacing.md,
    },
    title: { marginBottom: theme.spacing.md },
  });
