import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { AppIcon, AppText } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';

import type { VoiceStatus } from '../hooks/useVoiceInput';
import { makeStyles } from '../styled/Composer.styles';

interface ComposerProps {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
  /** Hold-to-talk state; the field turns into a live status while active. */
  voiceStatus: VoiceStatus;
  onMicPressIn: () => void;
  onMicPressOut: () => void;
  /** Extra bottom padding (safe area). */
  bottomInset?: number;
}

/** A soft pulsing dot — the "I'm listening" signal while the mic is held. */
function PulseDot(): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.35, { duration: 600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value, transform: [{ scale: 0.8 + pulse.value * 0.4 }] }));
  return <Animated.View style={[styles.dot, style]} />;
}

/**
 * The composer: one pill holding the mic, the text field and a send button.
 * While the mic is held the field shows a live "Listening…" state; while
 * Whisper works it shows a spinner; then the transcript is sent as a turn.
 */
export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  voiceStatus,
  onMicPressIn,
  onMicPressOut,
  bottomInset = 0,
}: ComposerProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const recording = voiceStatus === 'recording';
  const transcribing = voiceStatus === 'transcribing';
  const canSend = !disabled && !recording && !transcribing && value.trim().length > 0;

  return (
    <View style={[styles.bar, { paddingBottom: bottomInset + theme.spacing.sm }]}>
      <View style={[styles.pill, recording && styles.pillRecording, transcribing && styles.pillBusy]}>
        <Pressable
          onPressIn={onMicPressIn}
          onPressOut={onMicPressOut}
          disabled={disabled || transcribing}
          accessibilityRole="button"
          accessibilityLabel={t('aiHoldToTalk')}
          hitSlop={theme.touch.hitSlop}
          style={({ pressed }) => [styles.round, styles.mic, recording && styles.micRecording, pressed && styles.pressed]}
        >
          <AppIcon name="mic" size={22} color={recording ? 'onAccent' : 'primary'} />
        </Pressable>

        {recording ? (
          <View style={styles.status}>
            <PulseDot />
            <AppText size="md" weight="semibold" color="danger">
              {t('aiListening')}
            </AppText>
          </View>
        ) : transcribing ? (
          <View style={styles.status}>
            <ActivityIndicator color={theme.colors.accent} />
            <AppText size="md" color="textSecondary">
              {t('aiThinking')}
            </AppText>
          </View>
        ) : (
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={t('assistantPlaceholder')}
            placeholderTextColor={theme.colors.textSecondary}
            style={styles.input}
            multiline
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={() => canSend && onSend()}
            editable={!disabled}
            accessibilityLabel={t('assistantPlaceholder')}
          />
        )}

        <Pressable
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={t('askAssistant')}
          style={({ pressed }) => [styles.round, canSend ? styles.send : styles.sendDisabled, pressed && styles.pressed]}
        >
          <AppIcon name="send" size={20} color={canSend ? 'onAccent' : 'textSecondary'} style={styles.sendIcon} />
        </Pressable>
      </View>
    </View>
  );
}
