import React from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/Composer.styles';

interface ComposerProps {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
  /** Optional control before the field (the microphone). */
  leading?: React.ReactNode;
  /** Extra bottom padding (safe area). */
  bottomInset?: number;
}

/** Text field + send button pinned above the keyboard. */
export function Composer({ value, onChange, onSend, disabled, leading, bottomInset = 0 }: ComposerProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const canSend = !disabled && value.trim().length > 0;

  return (
    <View style={[styles.bar, { paddingBottom: bottomInset + theme.spacing.sm }]}>
      {leading}
      <View style={styles.field}>
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
      </View>
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel={t('askAssistant')}
        style={({ pressed }) => [styles.round, !canSend && styles.roundDisabled, pressed && styles.roundPressed]}
      >
        <AppIcon name="forward" size={24} color={canSend ? 'onAccent' : 'textSecondary'} />
      </Pressable>
    </View>
  );
}
