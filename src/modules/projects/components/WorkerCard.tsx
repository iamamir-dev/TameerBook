import React from 'react';
import { View } from 'react-native';

import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppText } from '@/components/ui';
import type { ProjectLaborerSummary } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/WorkerCard.styles';

interface Props {
  worker: ProjectLaborerSummary;
  /** Informational only on a completed project (no pay/attendance sheet). */
  onPress?: () => void;
}

/** One worker on this project: name + wage + today's attendance, and the
 *  stretched earned | taken | balance math line. */
export function WorkerCard({ worker: w, onPress }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  return (
    <AppCard compact onPress={onPress}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <AppText size="md" weight="bold" numberOfLines={1}>
            {w.laborer.name}
          </AppText>
          <AppText size="xs" color="textSecondary">
            {`${t('dailyWage')}: ${formatRupees(w.projectLaborer.daily_wage)} · ${w.balance.daysFull + w.balance.daysHalf} ${t('daysLabel')}`}
          </AppText>
        </View>
        {w.todayStatus ? (
          <StageBadge
            tone={w.todayStatus === 'FULL' ? 'success' : w.todayStatus === 'HALF' ? 'gold' : 'danger'}
            label={t(w.todayStatus === 'FULL' ? 'attFull' : w.todayStatus === 'HALF' ? 'attHalf' : 'attAbsent')}
          />
        ) : (
          <AppText size="xs" weight="semibold" color="textSecondary">
            {t('notMarkedToday')}
          </AppText>
        )}
      </View>

      <View style={styles.columns}>
        <View style={styles.col}>
          <AppText size="sm" weight="semibold" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(w.balance.accrued)}
          </AppText>
          <AppText size="xs" color="textSecondary" numberOfLines={1}>
            {t('earnedLabel')}
          </AppText>
        </View>
        <View style={styles.colDivider} />
        <View style={styles.col}>
          <AppText size="sm" weight="semibold" color="danger" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(w.balance.paid)}
          </AppText>
          <AppText size="xs" color="textSecondary" numberOfLines={1}>
            {t('takenLabel')}
          </AppText>
        </View>
        <View style={styles.colDivider} />
        <View style={styles.col}>
          <AppText
            size="sm"
            weight="bold"
            color={w.balance.balance > 0 ? 'danger' : 'success'}
            tabular
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatRupees(w.balance.balance)}
          </AppText>
          <AppText size="xs" color="textSecondary" numberOfLines={1}>
            {t('wageBalance')}
          </AppText>
        </View>
      </View>
    </AppCard>
  );
}
