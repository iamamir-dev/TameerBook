import * as Clipboard from 'expo-clipboard';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppIcon, AppText, type IconKey } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { swallow } from '@/utils/log';

import { makeStyles } from '../styled/MessageActions.styles';

interface MessageActionsProps {
  /** Text to copy / read aloud (omit to hide those two). */
  text?: string;
  onCopied?: () => void;
  onSpeak?: (text: string) => void;
  /** Failed reply: offer a retry. */
  onRetry?: () => void;
  disabled?: boolean;
}

/**
 * The fixed row of small actions under an assistant message — the same place
 * every time (copy · read aloud · retry), like the action bar under a ChatGPT
 * or Claude reply. Never inside the bubble, so bubble width doesn't move it.
 */
export function MessageActions({ text, onCopied, onSpeak, onRetry, disabled }: MessageActionsProps): React.JSX.Element | null {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const items: { icon: IconKey; label: string; onPress: () => void; accent?: boolean }[] = [];
  if (text) {
    items.push({
      icon: 'copy',
      label: t('aiCopy'),
      onPress: () => {
        Clipboard.setStringAsync(text)
          .then(() => onCopied?.())
          .catch(swallow('assistant:copy'));
      },
    });
    if (onSpeak) items.push({ icon: 'speaker', label: t('aiSpeakThis'), onPress: () => onSpeak(text.split('\n\n')[0]) });
  }
  if (onRetry) items.push({ icon: 'retry', label: t('aiRetry'), onPress: onRetry, accent: true });
  if (items.length === 0) return null;

  return (
    <View style={styles.row}>
      {items.map((it) => (
        <Pressable
          key={it.icon}
          onPress={it.onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={it.label}
          hitSlop={theme.touch.hitSlop}
          style={({ pressed }) => [styles.action, it.accent && styles.actionAccent, pressed && styles.pressed]}
        >
          <AppIcon name={it.icon} size={14} color={it.accent ? 'accent' : 'textSecondary'} />
          {it.accent ? (
            <AppText size="xs" weight="bold" color="accent">
              {it.label}
            </AppText>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
