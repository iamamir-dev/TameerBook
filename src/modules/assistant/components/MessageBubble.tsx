import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';

import type { AiErrorCode } from '@/ai';
import { AppButton, AppIcon, AppText } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/MessageBubble.styles';
import { AI_ERROR_KEY, SETTINGS_FIXABLE } from '../utils/aiErrors';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** What the user said — right-aligned, on the brand color. */
export function UserBubble({ text }: { text: string }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.user}>
      <AppText size="md" color="onPrimary">
        {text}
      </AppText>
    </View>
  );
}

/** A short spoken-style reply from the assistant. */
export function AssistantBubble({ text }: { text: string }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.assistant}>
      <AppText size="md">{text}</AppText>
    </View>
  );
}

/** A failure, in one sentence, with a Settings shortcut when that is the fix. */
export function ErrorBubble({ code }: { code: AiErrorCode }): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);
  return (
    <View style={styles.assistant}>
      <View style={styles.errorRow}>
        <AppIcon name="alert" size={20} color="danger" />
        <AppText size="sm" weight="semibold" style={styles.errorText}>
          {t(AI_ERROR_KEY[code])}
        </AppText>
      </View>
      {SETTINGS_FIXABLE.has(code) ? (
        <AppButton label={t('settings')} icon="settings" variant="secondary" fullWidth={false} onPress={() => navigation.navigate('Settings')} />
      ) : null}
    </View>
  );
}
