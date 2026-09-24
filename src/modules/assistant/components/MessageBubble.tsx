import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import React from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import type { AiErrorCode, OpenScreen } from '@/ai';
import { AppIcon, AppText } from '@/components/ui';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';
import { swallow } from '@/utils/log';

import { useEnter } from '../utils/motion';
import { resolveWallpaper } from '../wallpapers';
import { makeStyles } from '../styled/MessageBubble.styles';
import { AI_ERROR_KEY, SETTINGS_FIXABLE } from '../utils/aiErrors';
import { RichText } from './RichText';
import { OPEN_SCREEN_LABEL, openScreen } from '../utils/openScreen';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The little pointer at a bubble's TOP corner, the way WhatsApp draws it: a
 * curved triangle in the bubble's own colour, sweeping out of the side that
 * faces the sender. Absolutely positioned; the bubble keeps that corner square.
 */
export function BubbleTail({ side, color }: { side: 'left' | 'right'; color: string }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View pointerEvents="none" style={[styles.tail, side === 'left' ? styles.tailLeft : styles.tailRight]}>
      <Svg width={18} height={22} viewBox="0 0 18 22">
        {/* The bubble's top edge sweeps out into a point. */}
        <Path d={side === 'left' ? 'M18 22 L18 0 L0 0 C8 2 14 8 18 22 Z' : 'M0 22 L0 0 L18 0 C10 2 4 8 0 22 Z'} fill={color} />
      </Svg>
    </View>
  );
}

/** What the user said — right-aligned, on the brand color, with its own copy action. */
export function UserBubble({ text, imageUris, onCopied }: { text: string; imageUris?: string[]; onCopied?: () => void }): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const wp = resolveWallpaper(
    useSettingsStore((s) => s.chatWallpaper),
    theme
  );
  return (
    <Animated.View entering={useEnter()} style={styles.userWrap}>
      {imageUris?.length ? (
        <View style={styles.userImages}>
          {imageUris.map((u) => (
            <Image key={u} source={{ uri: u }} style={styles.userImage} />
          ))}
        </View>
      ) : null}
      {text ? (
        <View style={styles.userWithTail}>
          <View style={[styles.user, { backgroundColor: wp.outgoing }]}>
            <AppText size="sm" style={{ color: wp.outgoingText }} selectable>
              {text}
            </AppText>
          </View>
          <BubbleTail side="right" color={wp.outgoing} />
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
    </Animated.View>
  );
}

/** Any assistant turn: content on the left, kept clear of the right edge. No avatar (it added noise). */
export function AssistantRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  // The reply rises like the question did, instead of dropping in from above.
  return (
    <Animated.View entering={useEnter()} style={styles.assistantRow}>
      <View style={styles.assistantBody}>{children}</View>
    </Animated.View>
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
