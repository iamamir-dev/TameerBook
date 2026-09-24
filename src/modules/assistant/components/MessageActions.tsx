import * as Clipboard from 'expo-clipboard';
import React from 'react';
import { Pressable, View } from 'react-native';

import type { AiUsage } from '@/ai';
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
  /** Tokens the reply cost, shown quietly at the end of the row when the provider reports them. */
  usage?: AiUsage;
}

/** 8214 → "8.2K", 96 → "96". */
export const formatTokens = (n: number): string => (n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

/**
 * The fixed row of small actions under an assistant message — the same place
 * every time (copy · read aloud · retry), like the action bar under a ChatGPT
 * or Claude reply. Never inside the bubble, so bubble width doesn't move it.
 */
export function MessageActions({ text, onCopied, onSpeak, onRetry, disabled, usage }: MessageActionsProps): React.JSX.Element | null {
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
  if (items.length === 0 && !usage) return null;
  const usageLine = usage
    ? [`${formatTokens(usage.inputTokens)} ${t('aiUsageIn')}`, `${formatTokens(usage.outputTokens)} ${t('aiUsageOut')}`, usage.cacheReadTokens ? `${formatTokens(usage.cacheReadTokens)} ${t('aiUsageCached')}` : null].filter(Boolean).join(' · ')
    : null;

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
          {/* Rule 3: icon AND text — a slow reader needs the icon, a low-literacy
              user needs neither to be alone. "Read aloud" especially. */}
          <AppIcon name={it.icon} size={16} color={it.accent ? 'accent' : 'textSecondary'} />
          <AppText size="sm" weight={it.accent ? 'bold' : 'semibold'} color={it.accent ? 'accent' : 'textSecondary'}>
            {it.label}
          </AppText>
        </Pressable>
      ))}
      {usageLine ? (
        <AppText size="xs" color="textSecondary" style={styles.usage} accessibilityLabel={`${usageLine} ${t('aiUsageTokens')}`}>
          {usageLine}
        </AppText>
      ) : null}
    </View>
  );
}
