import React from 'react';
import { Pressable, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import type { LaborerKhataEntry } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/money';

import { ATT_LABEL } from '../utils/attendance';
import { makeStyles } from '../styled/KhataHistoryList.styles';

interface KhataHistoryListProps {
  /** Hide the internal "History" heading (host renders its own header row). */
  hideTitle?: boolean;
  /** Unified attendance + payment history across projects, newest first. */
  history: LaborerKhataEntry[];
  /** Tap a row to open it (payment → detail/edit, attendance → re-mark). */
  onSelect?: (entry: LaborerKhataEntry) => void;
}

/**
 * The worker's unified history: attendance accruals (FULL/HALF/ABSENT with the
 * wage earned) and wage payments, mixed by date across projects. Accruals read
 * as + (green), payments as − (red) — the two directions of a khata.
 */
export function KhataHistoryList({ history, hideTitle, onSelect }: KhataHistoryListProps): React.JSX.Element {
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
            const chipLabel = payment ? t('takenLabel') : t(ATT_LABEL[e.attendanceStatus ?? 'FULL']);
            const chipBg = payment ? theme.colors.dangerSoft : absent ? theme.colors.track : theme.colors.successSoft;
            const tone = payment ? 'danger' : absent ? 'textSecondary' : 'success';
            return (
              <View key={`${e.kind}-${e.date}-${i}`}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  onPress={onSelect ? () => onSelect(e) : undefined}
                  disabled={!onSelect}
                  accessibilityRole={onSelect ? 'button' : undefined}
                  style={({ pressed }) => [styles.row, pressed && onSelect ? styles.pressed : null]}
                >
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
                </Pressable>
              </View>
            );
          })
        )}
      </AppCard>
    </>
  );
}
