import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, AppHeader, AppIcon, AppText, Toast } from '@/components/ui';
import { PROVIDERS } from '@/ai';
import { useToast } from '@/hooks';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';

import { AnswerCard } from '../components/AnswerCard';
import { Composer } from '../components/Composer';
import { DraftCard } from '../components/DraftCard';
import { InsightsCard } from '../components/InsightsCard';
import { ChoiceList } from '../components/ChoiceList';
import { MessageActions } from '../components/MessageActions';
import { ThinkingBubble } from '../components/ThinkingBubble';
import { AssistantBubble, AssistantRow, ErrorBubble, OpenBubble, UserBubble } from '../components/MessageBubble';
import { useAssistant } from '../hooks/useAssistant';
import { useInsights } from '../hooks/useInsights';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { AI_ERROR_KEY } from '../utils/aiErrors';
import { navigateToTarget } from '../utils/navigateTarget';
import { openScreen } from '../utils/openScreen';
import { turnToText } from '../utils/turnText';
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
  // Re-evaluates when any AI setting changes (provider, key, URL).
  const configured = useSettingsStore((s) => {
    const info = PROVIDERS[s.aiProvider];
    const key = s.aiKeys[s.aiProvider] ?? '';
    const url = s.aiProvider === 'proxy' ? s.aiProxyUrl : s.aiProvider === 'custom' ? s.aiCustomBaseUrl : info.baseUrl;
    return (!info.needsKey || !!key) && (!info.needsUrl || !!url);
  });
  const ready = aiEnabled && configured;

  const { turns, busy, working, ask, clear, settle, retry, pick, onSpeak, onOpen, onOpenTarget } = useAssistant();
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

  // Follow-up chips show only on the newest assistant turn.
  const lastAssistantId = [...turns].reverse().find((x) => x.role === 'assistant')?.id;

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

          {/* The conversation persists across restarts; this is the one way to wipe it. */}
          {turns.length > 0 ? (
            <Pressable
              onPress={() =>
                Alert.alert(t('aiClearChat'), t('aiClearChatConfirm'), [
                  { text: t('cancel'), style: 'cancel' },
                  { text: t('aiClearChat'), style: 'destructive', onPress: clear },
                ])
              }
              accessibilityRole="button"
              style={({ pressed }) => [styles.clearRow, pressed && styles.chipPressed]}
            >
              <AppIcon name="trash" size={14} color="textSecondary" />
              <AppText size="xs" weight="semibold" color="textSecondary">
                {t('aiClearChat')}
              </AppText>
            </Pressable>
          ) : null}

          {turns.map((turn) => {
            if (turn.role === 'user') return <UserBubble key={turn.id} text={turn.text} />;
            if ('error' in turn) {
              return (
                <AssistantRow key={turn.id}>
                  <View style={styles.turnStack}>
                    <ErrorBubble code={turn.error} detail={turn.detail} />
                    <MessageActions onRetry={() => void retry(turn.id)} disabled={busy} />
                  </View>
                </AssistantRow>
              );
            }
            // A pending question makes list rows tappable answers ("which plot?").
            const isLast = turn.id === lastAssistantId;
            const asksChoice = isLast && !turn.picked && (turn.options.length > 0 || /[?؟]\s*$/.test(turn.text));
            return (
              <AssistantRow key={turn.id}>
                <View style={styles.turnStack}>
                  {turn.text ? <AssistantBubble text={turn.text} /> : null}
                  {turn.cards.map((card, i) => (
                    <AnswerCard key={`${turn.id}-c${i}`} answer={card} onPick={asksChoice && card.list && !busy ? (title) => void pick(turn.id, title) : undefined} />
                  ))}
                  {turn.options.length > 0 ? (
                    <ChoiceList options={turn.options} picked={turn.picked ?? null} disabled={busy || !isLast} onPick={(o) => void pick(turn.id, o)} />
                  ) : null}
                  {turn.draft ? (
                    <DraftCard resolved={turn.draft} settled={turn.settled} onSettled={(status, message) => settle(turn.id, status, message)} onDone={showToast} />
                  ) : null}
                  {turn.open ? <OpenBubble screen={turn.open} /> : null}
                  {/* Same action row under EVERY reply — copy takes the text plus the cards. */}
                  <MessageActions
                    text={turnToText(turn.text, turn.cards) || undefined}
                    onCopied={() => showToast(t('aiCopied'))}
                    onSpeak={turn.text ? (x) => void speak(x, language) : undefined}
                    disabled={busy}
                  />
                  {turn.suggestions.length > 0 && turn.id === lastAssistantId ? (
                    <View style={styles.chips}>
                      {turn.suggestions.map((sug) => (
                        <Pressable
                          key={sug}
                          onPress={() => void ask(sug)}
                          disabled={busy}
                          accessibilityRole="button"
                          style={({ pressed }) => [styles.chip, styles.chipFollow, pressed && styles.chipPressed]}
                        >
                          <AppText size="xs" weight="semibold" color="accent">
                            {sug}
                          </AppText>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </AssistantRow>
            );
          })}

          {busy ? (
            <AssistantRow>
              <ThinkingBubble
                status={
                  working.phase === 'tools'
                    ? `${t('aiChecking')} · ${working.tools.map((w) => w.replace(/^(get_|list_|open_|explain_)/, '').replace(/_/g, ' ')).join(', ')}`
                    : working.phase === 'writing'
                      ? t('aiWriting')
                      : t('aiThinking')
                }
              />
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
