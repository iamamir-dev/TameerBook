import React from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { AppIcon } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/MicButton.styles';
import type { VoiceStatus } from '../hooks/useVoiceInput';

interface MicButtonProps {
  status: VoiceStatus;
  onPressIn: () => void;
  onPressOut: () => void;
  disabled?: boolean;
}

/** Hold to talk. Red while recording, spinner while Whisper listens back. */
export function MicButton({ status, onPressIn, onPressOut, disabled }: MicButtonProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const busy = status === 'transcribing';
  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={t('aiHoldToTalk')}
      style={({ pressed }) => [styles.round, status === 'recording' && styles.recording, busy && styles.busy, pressed && styles.pressed]}
    >
      {busy ? (
        <ActivityIndicator color={theme.colors.textSecondary} />
      ) : (
        <AppIcon name="mic" size={24} color={status === 'recording' ? 'onAccent' : 'primary'} />
      )}
    </Pressable>
  );
}
