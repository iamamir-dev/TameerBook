import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import type { InvestorCapacity, InvestorProjectReturn } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

interface Props {
  investor: InvestorCapacity;
  returns: InvestorProjectReturn[];
}

/**
 * One investor's footprint for the "By investor" section: their total staked
 * capital and what's still free to commit, plus a compact per-project
 * breakdown (amount invested in each project they participate in).
 */
export function InvestorAllocationCard({ investor, returns }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const active = returns.filter((r) => r.invested > 0);

  return (
    <AppCard style={styles.card}>
      <View style={styles.head}>
        <AppText size="md" weight="bold" numberOfLines={1} style={styles.name}>
          {investor.name}
        </AppText>
        <View style={styles.headRight}>
          <AppText size="md" weight="bold" color="gold" tabular>
            {formatRupees(investor.staked)}
          </AppText>
          <AppText size="xs" color="textSecondary" tabular>
            {formatRupees(investor.remaining)} {t('remainingToInvest')}
          </AppText>
        </View>
      </View>

      {active.length > 0 ? (
        <View style={styles.rows}>
          {active.map((r) => (
            <View key={r.projectId} style={styles.row}>
              <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.rowName}>
                {r.projectName}
              </AppText>
              <AppText size="sm" weight="bold" tabular>
                {formatRupees(r.invested)}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </AppCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { gap: theme.spacing.sm },
    head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.md },
    name: { flex: 1 },
    headRight: { alignItems: 'flex-end', gap: 2 },
    rows: { gap: theme.spacing.sm, marginTop: theme.spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
    rowName: { flex: 1 },
  });
