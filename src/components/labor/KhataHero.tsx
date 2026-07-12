import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

interface KhataHeroProps {
  /** Cross-project totals: what the worker earned / took / is still owed. */
  earned: number;
  taken: number;
  balance: number;
}

/**
 * The worker khata's headline: the balance still owed across ALL projects,
 * with the earned/taken math underneath — the same hero treatment as the
 * investor profile.
 */
export function KhataHero({ earned, taken, balance }: KhataHeroProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  return (
    <View style={styles.hero}>
      <AppText size="overline" weight="semibold" color="onPrimaryMuted" uppercase>
        {t('wageBalance')}
      </AppText>
      <AppText
        size="display"
        weight="bold"
        color="onHero"
        tabular
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatRupees(balance)}
      </AppText>
      <AppText size="sm" color="onPrimaryMuted">
        {`${t('earnedLabel')} ${formatRupees(earned)} · ${t('takenLabel')} ${formatRupees(taken)}`}
      </AppText>
      <AppText size="xs" color="onPrimaryMuted">
        {t('acrossProjects')}
      </AppText>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    hero: {
      backgroundColor: theme.colors.heroBg,
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
  });
