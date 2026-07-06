import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import type { GlyphName, IconKey } from './icons';

export type EntryDirection = 'in' | 'out';

interface AppListRowProps {
  title: string;
  subtitle?: string;
  /** Leading icon describing the entry type. */
  icon?: IconKey | GlyphName;
  /** Formatted amount text, e.g. "25,000". The sign/color is set by direction. */
  amount?: string;
  /** "in" colors the amount green (aamdani), "out" red (kharcha). */
  direction?: EntryDirection;
  /** Optional receipt thumbnail (URI or required asset). */
  thumbnail?: ImageSourcePropType;
  onPress?: () => void;
}

/**
 * A single ledger/list row: leading icon chip, title + subtitle, and a
 * trailing amount tinted by money-in/out direction, with an optional receipt
 * thumbnail. Tall enough (>=56) to be an easy touch target.
 */
export function AppListRow({
  title,
  subtitle,
  icon,
  amount,
  direction,
  thumbnail,
  onPress,
}: AppListRowProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const amountColorKey =
    direction === 'in' ? 'success' : direction === 'out' ? 'danger' : 'textPrimary';
  const amountPrefix = direction === 'in' ? '+ ' : direction === 'out' ? '− ' : '';
  const iconTone =
    direction === 'in' ? 'success' : direction === 'out' ? 'danger' : 'primary';
  const chipBg =
    direction === 'in'
      ? theme.colors.successSoft
      : direction === 'out'
        ? theme.colors.dangerSoft
        : theme.colors.primarySoft;

  const Container = onPress ? Pressable : View;

  return (
    <Container
      {...(onPress
        ? {
            onPress,
            accessibilityRole: 'button' as const,
            style: ({ pressed }: { pressed: boolean }) => [
              styles.row,
              pressed && styles.pressed,
            ],
          }
        : { style: styles.row })}
    >
      {icon ? (
        <View style={[styles.iconChip, { backgroundColor: chipBg }]}>
          <AppIcon name={icon} size={22} color={iconTone} />
        </View>
      ) : null}

      <View style={styles.body}>
        <AppText size="md" weight="semibold" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText size="sm" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {thumbnail ? <Image source={thumbnail} style={styles.thumbnail} /> : null}

      {amount ? (
        <AppText size="md" weight="semibold" color={amountColorKey} style={styles.amount} tabular>
          {amountPrefix}
          {amount}
        </AppText>
      ) : null}
    </Container>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: theme.touch.minTarget,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
    },
    pressed: {
      opacity: 0.7,
    },
    iconChip: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      gap: 2,
    },
    thumbnail: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.track,
    },
    amount: {
      marginLeft: theme.spacing.sm,
    },
  });
