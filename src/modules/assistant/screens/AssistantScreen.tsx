import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, AppHeader, AppIcon, AppText, Toast } from '@/components/ui';
import { useToast } from '@/hooks';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';

import { AnswerCard } from '../components/AnswerCard';
import { Composer } from '../components/Composer';
import { DraftCard } from '../components/DraftCard';
import { InsightsCard } from '../components/InsightsCard';
import { AssistantBubble, AssistantRow, ErrorBubble, OpenBubble, UserBubble } from '../components/MessageBubble';
import { useAssistant } from '../hooks/useAssistant';
import { useInsights } from '../hooks/useInsights';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { AI_ERROR_KEY } from '../utils/aiErrors';
import { navigateToTarget } from '../utils/navigateTarget';
import { openScreen } from '../utils/openScreen';
import { speak, stopSpeaking } from '../utils/speech';
import { makeStyles } from '../styled/AssistantScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Assistant'>;

const CHIP_KEYS: TranslationKey[] = ['aiChip1', 'aiChip2', 'aiChip3', 'aiChip4'];

/**
 * The assistant: ask about the ledger or dictate an entry. Every turn is one
 * model call; answers come from the repositories, drafts land on confirm
 * screens. Shows a setup card until AI helpers are switched on in Settings.
 */
export function AssistantScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  const aiSpeak = useSettingsStore((s) => s.aiSpeak);
  const language = useSettingsStore((s) => s.language);
  const hasProvider = useSettingsStore((s) => !!s.aiProxyUrl || !!s.aiGroqKey);
  const ready = aiEnabled && hasProvider;

  const { turns, busy, ask, onSpeak, onOpen, onOpenTarget } = useAssistant();
  const { toast, showToast } = useToast();
  const { data: insightsData, loaded: insightsLoaded } = useInsights();
  const [input, setInput] = useState(params?.seed ?? '');
  const scroll = useRef<ScrollView>(null);

  // Read answers aloud when enabled; stop talking when the screen closes.
  useEffect(() => {
    onSpeak.current = aiSpeak ? (text) => void speak(text, language) : null;
    return () => {
      onSpeak.current = null;
      stopSpeaking();
    };
  }, [aiSpeak, language, onSpeak]);

  // "Add a new project" → open that screen right away (navigation only).
  useEffect(() => {
    onOpen.current = (screen) => openScreen(navigation, screen);
    onOpenTarget.current = (target) => navigateToTarget(navigation, target);
    return () => {
      onOpen.current = null;
      onOpenTarget.current = null;
    };
  }, [navigation, onOpen, onOpenTarget]);

  // Android (edge-to-edge) does not resize the window for the keyboard and
  // KeyboardAvoidingView leaves a stale gap after it closes — so pad by the
  // keyboard's own height and drop it to zero the moment the keyboard hides.
  const [kb, setKb] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKb(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Hold-to-talk: the transcript goes straight through the router.
  const voice = useVoiceInput((text) => void ask(text));
  useEffect(() => {
    if (!voice.error) return;
    const msg =
      voice.error === 'mic'
        ? t('aiMicDenied')
        : voice.error === 'tooShort'
          ? t('aiTooShort')
          : voice.error === 'silence'
            ? t('aiNoSpeech')
            : t(AI_ERROR_KEY[voice.error]);
    // Dev builds append the raw reason so a provider rejection is diagnosable on-device.
    showToast(__DEV__ && voice.errorDetail ? `${msg} (${voice.errorDetail.slice(0, 80)})` : msg);
  }, [voice.error, voice.errorDetail, showToast, t]);

  // Keep the newest turn in view.
  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [turns.length, busy]);

  const send = () => {
    const text = input;
    setInput('');
    void ask(text);
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('assistantTitle')}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'settings', onPress: () => navigation.navigate('Settings'), accessibilityLabel: t('settings') }}
      />
      <KeyboardAvoidingView style={[styles.flex, kb > 0 && { paddingBottom: kb }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {turns.length === 0 ? (
            <View style={styles.intro}>
              <View style={styles.introHead}>
                <View style={styles.introIcon}>
                  <AppIcon name="assistant" size={22} color="accent" />
                </View>
                <AppText size="xs" color="textSecondary" style={styles.flex}>
                  {t('assistantHint')}
                </AppText>
              </View>
              {ready ? (
                <View style={styles.chips}>
                  {CHIP_KEYS.map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => void ask(t(k))}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                    >
                      <AppText size="xs" weight="semibold">
                        {t(k)}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* What needs attention today — offline ledger rules, shown until the chat starts. */}
          {turns.length === 0 && (!insightsLoaded || insightsData.insights.length > 0) ? (
            <>
              <AppText size="xs" weight="bold" color="textSecondary" uppercase style={styles.sectionLabel}>
                {t('suggestionsTitle')}
              </AppText>
              <InsightsCard insights={insightsData.insights} loaded={insightsLoaded} limit={4} />
            </>
          ) : null}

          {turns.map((turn) => {
            if (turn.role === 'user') return <UserBubble key={turn.id} text={turn.text} />;
            let body: React.ReactNode;
            switch (turn.kind) {
              case 'text':
                body = <AssistantBubble text={turn.text} />;
                break;
              case 'answer':
                body = <AnswerCard answer={turn.answer} />;
                break;
              case 'draft':
                body = <DraftCard resolved={turn.resolved} onDone={showToast} />;
                break;
              case 'open':
                body = <OpenBubble screen={turn.screen} />;
                break;
              case 'error':
                body = <ErrorBubble code={turn.code} />;
                break;
            }
            return <AssistantRow key={turn.id}>{body}</AssistantRow>;
          })}

          {busy ? (
            <AssistantRow>
              <View style={styles.thinking}>
                <ActivityIndicator color={theme.colors.accent} />
                <AppText size="sm" color="textSecondary">
                  {t('aiThinking')}
                </AppText>
              </View>
            </AssistantRow>
          ) : null}
        </ScrollView>

        {ready ? (
          <Composer
            value={input}
            onChange={setInput}
            onSend={send}
            disabled={busy}
            voiceStatus={voice.status}
            onMicPressIn={() => void voice.start()}
            onMicPressOut={() => void voice.stop()}
            bottomInset={kb > 0 ? 0 : insets.bottom}
          />
        ) : (
          <View style={[styles.setup, { marginBottom: insets.bottom + theme.spacing.sm }]}>
            <AppText size="md" weight="bold">
              {t('aiSetupTitle')}
            </AppText>
            <AppText size="sm" color="textSecondary">
              {t('aiSetupBody')}
            </AppText>
            <AppButton label={t('settings')} icon="settings" onPress={() => navigation.navigate('Settings')} />
          </View>
        )}
      </KeyboardAvoidingView>
      <Toast message={toast} />
    </View>
  );
}
