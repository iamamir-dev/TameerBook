import React, { useEffect } from 'react';
import { ActivityIndicator, Image, Pressable, TextInput, View } from 'react-native';
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
  /** Photos waiting to be sent with the next message. */
  attachments: { uri: string }[];
  onAttach: () => void;
  onRemoveAttachment: (uri: string) => void;
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
 * The composer: one pill holding attach, the text field and one action button
 * on the right: a mic while the field is empty, Send once there is text.
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
  attachments,
  onAttach,
  onRemoveAttachment,
}: ComposerProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const recording = voiceStatus === 'recording';
  const transcribing = voiceStatus === 'transcribing';
  const canSend = !disabled && !recording && !transcribing && (value.trim().length > 0 || attachments.length > 0);

  return (
    // A little air under the pill, on top of the safe area (the screen lifts the
    // whole bar above the keyboard, so the gap is the same with it up or down).
    <View style={[styles.bar, { paddingBottom: bottomInset + theme.spacing.sm }]}>
      {attachments.length > 0 ? (
        <View style={styles.previews}>
          {attachments.map((a) => (
            <View key={a.uri} style={styles.preview}>
              <Image source={{ uri: a.uri }} style={styles.previewImg} />
              <Pressable onPress={() => onRemoveAttachment(a.uri)} accessibilityRole="button" accessibilityLabel={t('delete')} hitSlop={theme.touch.hitSlop} style={styles.previewRemove}>
                <AppIcon name="close" size={12} color="onPrimary" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {/* WhatsApp layout: the field is one pill, the action is its own circle
          beside it, so a growing message never moves or squeezes the button. */}
      <View style={styles.row}>
        <View style={[styles.pill, recording && styles.pillRecording, transcribing && styles.pillBusy]}>
          <Pressable
            onPress={onAttach}
            disabled={disabled || recording || transcribing}
            accessibilityRole="button"
            accessibilityLabel={t('aiAttach')}
            hitSlop={theme.touch.hitSlop}
            style={({ pressed }) => [styles.round, styles.lead, styles.mic, pressed && styles.pressed]}
          >
            <AppIcon name="image" size={20} color="textSecondary" />
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
              placeholder={attachments.length > 0 ? t('aiPhotoPlaceholder') : t('assistantPlaceholder')}
              placeholderTextColor={theme.colors.textSecondary}
              style={styles.input}
              multiline
              scrollEnabled
              returnKeyType="send"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={() => canSend && onSend()}
              accessibilityLabel={t('assistantPlaceholder')}
            />
          )}
        </View>

        {canSend || transcribing ? (
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('askAssistant')}
            style={({ pressed }) => [styles.action, canSend ? styles.send : styles.sendDisabled, pressed && styles.pressed]}
          >
            <AppIcon name="send" size={22} color={canSend ? 'onAccent' : 'textSecondary'} style={styles.sendIcon} />
          </Pressable>
        ) : (
          /* Empty field: hold-to-talk sits where Send appears once there is text. */
          <Pressable
            onPressIn={onMicPressIn}
            onPressOut={onMicPressOut}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t('aiHoldToTalk')}
            style={({ pressed }) => [styles.action, recording ? styles.micRecording : styles.send, pressed && styles.pressed]}
          >
            <AppIcon name="mic" size={22} color="onAccent" />
          </Pressable>
        )}
      </View>
    </View>
  );
}
