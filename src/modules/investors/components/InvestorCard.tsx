import React from 'react';
import { View } from 'react-native';

import { AppCard, AppIcon, AppText, Avatar, PhoneChip } from '@/components/ui';
import type { InvestorWithCapital } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/InvestorCard.styles';

interface InvestorCardProps {
  investor: InvestorWithCapital;
  onPress: () => void;
  onLongPress: () => void;
}

/** One investor row on the Investors list: avatar + name/phone + total standing. */
export function InvestorCard({ investor, onPress, onLongPress }: InvestorCardProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  return (
    <AppCard style={styles.card} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.row}>
        <Avatar uri={investor.photo_uri} name={investor.name} />
        <View style={styles.info}>
          <AppText size="md" weight="bold" numberOfLines={1}>
            {investor.name}
          </AppText>
          {investor.phone ? <PhoneChip phone={investor.phone} compact /> : null}
        </View>
        <AppIcon name="forward" size={20} color="textSecondary" />
      </View>

      {/* Total standing — folds realized profit into the headline. */}
      <View style={styles.mathBlock}>
        <View style={styles.mathRow}>
          <AppText size="sm" weight="bold">
            {t('totalLabel')}
          </AppText>
          <AppText size="md" weight="bold" color="success" tabular>
            {formatRupees(investor.total)}
          </AppText>
        </View>
        {investor.profit !== 0 ? (
          <View style={styles.mathRow}>
            <AppText size="sm" color="textSecondary">
              {t('profitEarned')}
            </AppText>
            <AppText size="sm" weight="bold" color={investor.profit >= 0 ? 'success' : 'danger'} tabular>
              {`${investor.profit >= 0 ? '+ ' : '− '}${formatRupees(Math.abs(investor.profit))}`}
            </AppText>
          </View>
        ) : null}
      </View>
    </AppCard>
  );
}
