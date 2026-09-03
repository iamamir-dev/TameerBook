import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import React from 'react';
import { Image, Pressable, View } from 'react-native';

import type { AiErrorCode, OpenScreen } from '@/ai';
import { AppIcon, AppText } from '@/components/ui';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { swallow } from '@/utils/log';

import { makeStyles } from '../styled/MessageBubble.styles';
import { AI_ERROR_KEY, SETTINGS_FIXABLE } from '../utils/aiErrors';
import { RichText } from './RichText';
import { OPEN_SCREEN_LABEL, openScreen } from '../utils/openScreen';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** What the user said — right-aligned, on the brand color, with its own copy action. */
export function UserBubble({ text, imageUris, onCopied }: { text: string; imageUris?: string[]; onCopied?: () => void }): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  return (
    <View style={styles.userWrap}>
      {imageUris?.length ? (
        <View style={styles.userImages}>
          {imageUris.map((u) => (
            <Image key={u} source={{ uri: u }} style={styles.userImage} />
          ))}
        </View>
      ) : null}
      {text ? (
        <View style={styles.user}>
          <AppText size="sm" color="onPrimary" selectable>
            {text}
          </AppText>
        </View>
      ) : null}
      {text ? (
        <Pressable
          onPress={() => {
            Clipboard.setStringAsync(text)
              .then(() => onCopied?.())
              .catch(swallow('assistant:copy'));
          }}
          accessibilityRole="button"
          accessibilityLabel={t('aiCopy')}
          hitSlop={theme.touch.hitSlop}
          style={({ pressed }) => [styles.userCopy, pressed && styles.pressed]}
        >
          <AppIcon name="copy" size={12} color="textSecondary" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Any assistant turn: a small sparkle avatar beside the content. */
export function AssistantRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.assistantRow}>
      <View style={styles.avatar}>
        <AppIcon name="assistant" size={12} color="accent" />
      </View>
      <View style={styles.assistantBody}>{children}</View>
    </View>
  );
}

/** A reply from the assistant. Actions (copy / speak) live in MessageActions below it. */
export function AssistantBubble({ text }: { text: string }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.assistant}>
      <RichText text={text} />
    </View>
  );
}

/** "Opening New Project" — a quiet receipt with a re-open link. */
export function OpenBubble({ screen }: { screen: OpenScreen }): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);
  const label: TranslationKey = OPEN_SCREEN_LABEL[screen];
  return (
    <View style={styles.notice}>
      <AppIcon name="forward" size={16} color="accent" />
      <AppText size="sm" style={styles.noticeText} numberOfLines={1}>
        {`${t('aiOpening')} · ${t(label)}`}
      </AppText>
      <Pressable onPress={() => openScreen(navigation, screen)} accessibilityRole="button" style={styles.link}>
        <AppText size="sm" weight="bold" color="accent">
          {t('aiOpen')}
        </AppText>
      </Pressable>
    </View>
  );
}

/** A failure, in one sentence, with a Settings link when that is the fix. */
export function ErrorBubble({ code, detail }: { code: AiErrorCode; detail?: string }): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);
  return (
    <View style={styles.notice}>
      <AppIcon name="alert" size={16} color="danger" />
      <AppText size="sm" style={styles.noticeText}>
        {t(AI_ERROR_KEY[code])}
        {__DEV__ && detail ? `\n${detail}` : ''}
      </AppText>
      {SETTINGS_FIXABLE.has(code) ? (
        <Pressable onPress={() => navigation.navigate('Settings')} accessibilityRole="button" style={styles.link}>
          <AppText size="sm" weight="bold" color="accent">
            {t('settings')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
