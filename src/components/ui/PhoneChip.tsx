import React, { useCallback } from 'react';
import { Alert, Linking, Pressable, StyleSheet } from 'react-native';

import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { formatPhone } from '@/utils/mask';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

interface PhoneChipProps {
  phone: string;
  /** Smaller inline variant (list rows); default is a full contact row. */
  compact?: boolean;
}

/**
 * A tappable phone number: tap opens the dialer (`tel:`), long-press offers to
 * dial too (a discoverable confirm). Dialing uses core `Linking` — no extra
 * dependency. Rendered wherever a saved phone number is shown so the builder
 * can actually call the worker / investor / seller instead of just reading it.
 */
export function PhoneChip({ phone, compact = false }: PhoneChipProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const phoneText = formatPhone(phone);
  const tel = `tel:${phone.replace(/[^\d+]/g, '')}`;
  const dial = useCallback(() => {
    Linking.openURL(tel).catch(swallow('PhoneChip:dial'));
  }, [tel]);

  const confirmDial = useCallback(() => {
    Alert.alert(phoneText, undefined, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('call'), onPress: dial },
    ]);
  }, [phoneText, dial, t]);

  return (
    <Pressable
      onPress={dial}
      onLongPress={confirmDial}
      hitSlop={theme.touch.hitSlop}
      accessibilityRole="button"
      accessibilityLabel={`${t('call')} ${phoneText}`}
      style={({ pressed }) => [
        compact ? styles.compact : styles.row,
        pressed && styles.pressed,
      ]}
    >
      <AppIcon name="phone" size={compact ? 14 : 18} color="primary" />
      <AppText size={compact ? 'xs' : 'sm'} weight="semibold" color="primary" numberOfLines={1}>
        {phoneText}
      </AppText>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      alignSelf: 'flex-start',
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
    },
    compact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
    },
    pressed: { opacity: 0.6 },
  });
