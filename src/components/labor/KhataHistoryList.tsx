import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import type { AttendanceStatus, LaborerKhataEntry } from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/money';

const ATT_LABEL: Record<AttendanceStatus, TranslationKey> = {
  FULL: 'attFull',
  HALF: 'attHalf',
  ABSENT: 'attAbsent',
};

interface KhataHistoryListProps {
  /** Hide the internal "History" heading (host renders its own header row). */
  hideTitle?: boolean;
  /** Unified attendance + payment history across projects, newest first. */
  history: LaborerKhataEntry[];
}

/**
 * The worker's unified history: attendance accruals (FULL/HALF/ABSENT with the
 * wage earned that day) and wage payments, mixed by date across every project.
 * Accruals read as + (green), payments as − (red) — the two directions of a
 * khata.
 */
export function KhataHistoryList({ history, hideTitle }: KhataHistoryListProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  return (
    <>
{hideTitle ? null : (
      <AppText size="lg" weight="bold">
        {t('historyTitle')}
      </AppText>
)}
      <AppCard compact>
        {history.length === 0 ? (
          <AppText size="sm" color="textSecondary" center style={styles.empty}>
            {t('emptyLedger')}
          </AppText>
        ) : (
          history.map((e, i) => {
            const payment = e.kind === 'PAYMENT';
            const absent = e.attendanceStatus === 'ABSENT';
            const chipLabel = payment
              ? t('takenLabel')
              : t(ATT_LABEL[e.attendanceStatus ?? 'FULL']);
            const chipBg = payment
              ? theme.colors.dangerSoft
              : absent
                ? theme.colors.track
                : theme.colors.successSoft;
            const tone = payment ? 'danger' : absent ? 'textSecondary' : 'success';
            return (
              <View key={`${e.kind}-${e.date}-${i}`}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.row}>
                  <View style={[styles.chip, { backgroundColor: chipBg }]}>
                    <AppText size="xs" weight="bold" color={tone}>
                      {chipLabel}
                    </AppText>
                  </View>
                  <View style={styles.flex}>
                    <AppText size="sm" weight="semibold" numberOfLines={1}>
                      {e.projectName}
                    </AppText>
                    <AppText size="xs" color="textSecondary">
                      {formatDisplayDate(e.date)}
                    </AppText>
                  </View>
                  <AppText size="sm" weight="bold" color={absent ? 'textSecondary' : tone} tabular>
                    {absent ? '—' : `${payment ? '− ' : '+ '}${formatRupees(e.amount)}`}
                  </AppText>
                </View>
              </View>
            );
          })
        )}
      </AppCard>
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    empty: { paddingVertical: theme.spacing.lg },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
    // Dense notebook rows, matching the Home activity ledger.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      minHeight: 40,
    },
    chip: {
      minWidth: 56,
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: theme.radius.pill,
    },
  });
