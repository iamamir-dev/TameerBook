import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import type { IconKey } from './icons';

type Hub = 'Cash' | 'Labor' | 'Bookings';
type Nav = NativeStackNavigationProp<RootStackParamList>;

const HUBS: { key: Hub; icon: IconKey; labelKey: 'tabCash' | 'laborTitle' | 'bookingsTitle' }[] = [
  { key: 'Cash', icon: 'balance', labelKey: 'tabCash' },
  { key: 'Labor', icon: 'dehari', labelKey: 'laborTitle' },
  { key: 'Bookings', icon: 'material', labelKey: 'bookingsTitle' },
];

/**
 * Lateral shortcuts between the money hubs (Cash / Labor / Bookings): shows
 * pills for the OTHER two hubs so moving between them is one tap instead of
 * backing out to Home first. `replace` keeps the back stack shallow.
 */
export function HubShortcuts({ current }: { current: Hub }): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);

  return (
    <View style={styles.row}>
      {HUBS.filter((h) => h.key !== current).map((h) => (
        <Pressable
          key={h.key}
          onPress={() => navigation.replace(h.key)}
          accessibilityRole="button"
          accessibilityLabel={t(h.labelKey)}
          style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        >
          <AppIcon name={h.icon} size={16} color="primary" />
          <AppText size="xs" weight="bold" color="primary">
            {t(h.labelKey)}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
    },
    pressed: { opacity: 0.6 },
  });
