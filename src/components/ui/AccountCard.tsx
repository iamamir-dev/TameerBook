import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AccountType } from '@/db/schema';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import type { IconKey } from './icons';

const TYPE_ICON: Record<AccountType, IconKey> = {
  BANK: 'bank',
  CASH: 'rupee',
  WALLET: 'balance',
};

interface AccountCardProps {
  name: string;
  type: AccountType;
  balance: number;
  /** Short label for the account type ("Bank" / "Cash in hand" / "Wallet"). */
  typeLabel: string;
  onPress?: () => void;
  /** Compact horizontal-rail variant (fixed width) vs full-width row card. */
  compact?: boolean;
}

/**
 * A place money lives: bank / cash-in-hand / wallet, with its live balance.
 * Used on the dashboard rail (compact) and the Accounts screen (full width).
 */
export function AccountCard({
  name,
  type,
  balance,
  typeLabel,
  onPress,
  compact,
}: AccountCardProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const tone = type === 'BANK' ? 'primary' : type === 'CASH' ? 'success' : 'gold';
  const chipBg =
    type === 'BANK'
      ? theme.colors.primarySoft
      : type === 'CASH'
        ? theme.colors.successSoft
        : theme.colors.goldSoft;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.card,
        compact ? styles.compact : styles.full,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.head}>
        <View style={[styles.iconChip, { backgroundColor: chipBg }]}>
          <AppIcon name={TYPE_ICON[type]} size={20} color={tone} />
        </View>
        <View style={styles.flex}>
          <AppText size="sm" weight="bold" numberOfLines={1}>
            {name}
          </AppText>
          {typeLabel.trim().toLowerCase() !== name.trim().toLowerCase() ? (
            <AppText size="xs" color="textSecondary" numberOfLines={1}>
              {typeLabel}
            </AppText>
          ) : null}
        </View>
      </View>
      <AppText size={compact ? 'lg' : 'xl'} weight="bold" tabular numberOfLines={1}>
        {formatRupees(balance)}
      </AppText>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      ...theme.shadows.card,
    },
    compact: { width: 190 },
    full: {},
    pressed: { opacity: 0.85 },
    head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    iconChip: {
      width: 38,
      height: 38,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flex: { flex: 1 },
  });
