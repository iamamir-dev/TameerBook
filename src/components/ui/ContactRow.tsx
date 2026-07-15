import React, { useCallback } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { formatCnic, formatPhone } from '@/utils/mask';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

interface ContactRowProps {
  phone?: string | null;
  cnic?: string | null;
}

/**
 * A full-width contact row: phone number + CNIC on one line, with a "Call"
 * action on the right. Tapping the number (or Call) opens the dialer via core
 * `Linking` — no extra dependency. Renders nothing when there's neither a
 * phone nor a CNIC. Used on the detail screens (investor / worker / plot
 * seller) so a saved number is actually callable, not just readable.
 */
export function ContactRow({ phone, cnic }: ContactRowProps): React.JSX.Element | null {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  // Show the number/CNIC in their canonical formats even if stored unformatted.
  const phoneText = phone ? formatPhone(phone) : null;
  const cnicText = cnic ? formatCnic(cnic) : null;

  const tel = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null;
  const dial = useCallback(() => {
    if (tel) Linking.openURL(tel).catch(swallow('ContactRow:dial'));
  }, [tel]);
  const confirmDial = useCallback(() => {
    if (!phone) return;
    Alert.alert(phoneText ?? phone, undefined, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('call'), onPress: dial },
    ]);
  }, [phone, dial, t]);

  if (!phone && !cnic) return null;

  return (
    <View style={styles.row}>
      <AppIcon name={phone ? 'phone' : 'investor'} size={18} color="primary" />
      <View style={styles.info}>
        {phone ? (
          <Pressable onPress={dial} onLongPress={confirmDial} accessibilityRole="button" accessibilityLabel={`${t('call')} ${phoneText}`}>
            <AppText size="sm" weight="bold" color="primary" numberOfLines={1}>
              {phoneText}
            </AppText>
          </Pressable>
        ) : null}
        {cnicText ? (
          <AppText size="xs" color="textSecondary" numberOfLines={1}>
            {`${t('cnic')}: ${cnicText}`}
          </AppText>
        ) : null}
      </View>
      {phone ? (
        <Pressable
          onPress={dial}
          hitSlop={theme.touch.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={t('call')}
          style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
        >
          <AppText size="xs" weight="bold" color="onAccent">
            {t('call')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    info: { flex: 1, gap: 1 },
    callBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
    },
    pressed: { opacity: 0.6 },
  });
