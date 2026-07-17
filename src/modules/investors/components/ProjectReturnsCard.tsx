import React from 'react';
import { Pressable, View } from 'react-native';

import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppIcon, AppText } from '@/components/ui';
import type { InvestorProjectReturn } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/ProjectReturnsCard.styles';

interface ProjectReturnsCardProps {
  returns: InvestorProjectReturn[];
  onOpenProject: (projectId: string) => void;
}

/** Per-project invested + realized profit/loss for one investor. */
export function ProjectReturnsCard({ returns, onOpenProject }: ProjectReturnsCardProps): React.JSX.Element | null {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  if (returns.length === 0) return null;

  return (
    <>
      <AppText size="lg" weight="bold">
        {t('perProjectBreakdown')}
      </AppText>
      <AppCard compact>
        {returns.map((r, i) => (
          <View key={r.projectId}>
            {i > 0 ? <View style={styles.divider} /> : null}
            <Pressable
              onPress={() => onOpenProject(r.projectId)}
              accessibilityRole="button"
              accessibilityLabel={r.projectName}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.flex}>
                <AppText size="sm" weight="bold" numberOfLines={1}>
                  {r.projectName}
                </AppText>
                <View style={styles.subRow}>
                  <AppText size="xs" color="textSecondary" numberOfLines={1}>
                    {`${t('invested')}: ${formatRupees(r.invested)}`}
                  </AppText>
                  <StageBadge
                    tone={r.settled ? 'success' : 'accent'}
                    label={r.settled ? t('statusDone') : t('statusCurrent')}
                  />
                </View>
              </View>
              {r.settled ? (
                <AppText size="sm" weight="bold" color={r.profitOrLoss >= 0 ? 'success' : 'danger'} tabular>
                  {`${r.profitOrLoss >= 0 ? '+' : '−'}${formatRupees(Math.abs(r.profitOrLoss))}`}
                </AppText>
              ) : (
                <AppText size="sm" weight="bold" color="gold" tabular>
                  {formatRupees(r.invested)}
                </AppText>
              )}
              <AppIcon name="forward" size={18} color="textSecondary" />
            </Pressable>
          </View>
        ))}
      </AppCard>
    </>
  );
}
