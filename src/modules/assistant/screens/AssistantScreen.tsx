import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as FileSystem from 'expo-file-system/legacy';

import { AppButton, AppHeader, AppIcon, AppText, SelectSheet, Toast, type IconKey } from '@/components/ui';
import { aiConfigured } from '@/ai';
import { useToast } from '@/hooks';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { swallow } from '@/utils/log';
import { captureReceipt, pickDocumentImage } from '@/utils/photo';
import { useTheme } from '@/theme';

import { AnswerCard } from '../components/AnswerCard';
import { ChatWallpaper } from '../components/ChatWallpaper';
import { Composer } from '../components/Composer';
import { DraftActions } from '../components/DraftActions';
import { DraftSheet } from '../components/DraftSheet';
import { InsightsCard } from '../components/InsightsCard';
import { ChoiceList } from '../components/ChoiceList';
import { MessageActions } from '../components/MessageActions';
import { ThinkingBubble } from '../components/ThinkingBubble';
import { AssistantBubble, AssistantRow, BubbleTail, ErrorBubble, OpenBubble, UserBubble } from '../components/MessageBubble';
import { useAssistant } from '../hooks/useAssistant';
import { useInsights } from '../hooks/useInsights';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { AI_ERROR_KEY } from '../utils/aiErrors';
import { navigateToTarget } from '../utils/navigateTarget';
import { isNo, isYes, pendingDraft } from '../utils/confirmWords';
import { OPEN_SCREEN_LABEL, openScreen } from '../utils/openScreen';
import { turnToText } from '../utils/turnText';
import { TurnPiece } from '../components/TurnPiece';
import { speak, stopSpeaking } from '../utils/speech';
import { makeStyles } from '../styled/AssistantScreen.styles';
import { MotionContext } from '../utils/motion';
import type { Turn } from '../hooks/useAssistant';

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
  const configured = useSettingsStore((s) => aiConfigured(s));
  const ready = aiEnabled && configured;

  const { turns, restoredIds, busy, working, ask, clear, settle, retry, pick, echo, onSpeak, onOpen, onOpenTarget } = useAssistant();
  const { toast, showToast } = useToast();
  const { data: insightsData, loaded: insightsLoaded } = useInsights();
  const [input, setInput] = useState(params?.seed ?? '');
  // Replies that fetched several cards show one; the rest unfold on request.
  const [moreCards, setMoreCards] = useState<ReadonlySet<string>>(new Set());
  // The write whose confirmation popup is open (Save button or a typed "haan").
  const [confirm, setConfirm] = useState<{ turnId: string; index: number } | null>(null);
  const confirmTurn = confirm ? turns.find((x) => x.id === confirm.turnId) : undefined;
  const confirmDraft = confirmTurn && confirmTurn.role === 'assistant' && 'drafts' in confirmTurn ? confirmTurn.drafts[confirm!.index] : undefined;
  const confirmLinkedPo = confirmTurn && confirmTurn.role === 'assistant' && 'drafts' in confirmTurn ? confirmTurn.drafts.slice(0, confirm!.index).map((_, k) => confirmTurn.settled?.[k]?.poId).filter(Boolean).pop() ?? null : null;
  const scroll = useRef<ScrollView>(null);

  // Photos queued for the next message (compressed by the shared photo utils).
  const [attachments, setAttachments] = useState<{ uri: string }[]>([]);
  const [attachSheet, setAttachSheet] = useState(false);
  const addPhoto = (source: 'camera' | 'gallery') => {
    (source === 'camera' ? captureReceipt() : pickDocumentImage())
      .then((uri) => {
        if (uri) setAttachments((cur) => (cur.length >= 3 ? cur : [...cur, { uri }]));
      })
      .catch(swallow('assistant:attach'));
  };

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

  // The composer rides the keyboard frame by frame: Reanimated reads the
  // system's own keyboard animation, so the bar never jumps up after the
  // keyboard has landed or leaves a stale gap once it has gone. Edge-to-edge
  // Android reports the height from the screen's bottom edge, so the safe-area
  // inset the bar already pads is taken back out of the lift.
  const keyboard = useAnimatedKeyboard();
  const bottomInset = insets.bottom;
  const liftStyle = useAnimatedStyle(() => ({ paddingBottom: Math.max(keyboard.height.value - bottomInset, 0) }));
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => scroll.current?.scrollToEnd({ animated: true }));
    return () => show.remove();
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
    // Close the keyboard now, on its own curve, instead of when the busy state
    // lands and yanks focus away.
    Keyboard.dismiss();
    const text = input;
    const photos = attachments;
    setInput('');
    setAttachments([]);
    // "haan" / "nahi" while a write waits for confirmation answers that write, no model call.
    const pending = photos.length === 0 ? pendingDraft(turns) : null;
    if (pending && isYes(text)) {
      echo(text.trim());
      setConfirm(pending);
      return;
    }
    if (pending && isNo(text)) {
      echo(text.trim());
      settle(pending.turnId, pending.index, 'rejected');
      return;
    }
    if (photos.length === 0) {
      void ask(text);
      return;
    }
    // Read the compressed JPEGs as base64 for the model; keep the URIs for the bubble.
    Promise.all(photos.map(async (p) => ({ uri: p.uri, base64: await FileSystem.readAsStringAsync(p.uri, { encoding: 'base64' }) })))
      .then((images) => ask(text, images))
      .catch(swallow('assistant:attachRead'));
  };

  /** One turn of the conversation (user bubble, error bubble, or a full reply with its pieces). */
  function renderTurn(turn: Turn): React.JSX.Element {
            if (turn.role === 'user') return <UserBubble key={turn.id} text={turn.text} imageUris={turn.imageUris} onCopied={() => showToast(t('aiCopied'))} />;
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
            // On the newest reply, name-list rows are tappable answers ("which plot?")
            // and the list is fully expanded so any item can be chosen.
            const isLast = turn.id === lastAssistantId;
            const asksChoice = isLast && !turn.picked;
            // A written report (2+ section headings) or a list of 3+ items already shows the detail in the
            // text; the card under it shrinks to a header + Open link instead of repeating the rows.
            const writtenReport = (turn.text.match(/(^|\n)\s*(#{1,3}\s+[^\n]+|[^\n|]{1,40}[:：])\s*(?=\n|$)/g) ?? []).length >= 2;
            const listedInText = (turn.text.match(/(^|\n)\s*(\d+[.)]|[-•])\s+\S/g) ?? []).length >= 3;
            // One reply = one bubble: the sentence, its card, its choices and its
            // confirmation share a single surface, like a message in any chat app.
            const showAllCards = moreCards.has(turn.id);
            const visibleCards = showAllCards ? turn.cards : turn.cards.slice(0, 1);
            const hiddenCards = turn.cards.length - visibleCards.length;
            // A plain sentence hugs its words; anything with a card, a list or a confirmation takes the full width.
            const textOnly = turn.cards.length === 0 && turn.drafts.length === 0 && turn.options.length === 0 && !turn.open;
            return (
              <AssistantRow key={turn.id}>
                <View style={styles.turnStack}>
                  <TurnPiece step={0}>
                  <View style={[styles.replyWrap, textOnly && styles.replyWrapHug]}>
                  <View style={styles.replyBubble}>
                  {turn.text ? <AssistantBubble text={turn.text} /> : turn.drafts.length > 0 && !turn.settled ? <AssistantBubble text={t('aiConfirmHint')} /> : null}
                  {visibleCards.map((card, i) => (
                    <View key={`${turn.id}-cw${i}`} style={styles.replyPiece}>
                    <AnswerCard
                      key={`${turn.id}-c${i}`}
                      answer={card}
                      expandAll={asksChoice && !!card.list}
                      compact={(writtenReport && !!card.sections?.length) || (listedInText && !card.calendar && !card.chart)}
                      onPick={asksChoice && card.list && !busy ? (title) => void pick(turn.id, title) : undefined}
                    />
                    </View>
                  ))}
                  {hiddenCards > 0 ? (
                    <Pressable onPress={() => setMoreCards((cur) => new Set([...cur, turn.id]))} accessibilityRole="button" style={styles.moreCards}>
                      <AppText size="sm" weight="bold" color="accent">
                        {`+${hiddenCards} ${t('aiMore')}`}
                      </AppText>
                    </Pressable>
                  ) : null}
                  {turn.options.length > 0 ? (
                    <View style={styles.replyPiece}>
                      <ChoiceList options={turn.options} picked={turn.picked ?? null} disabled={busy || !isLast} onPick={(o) => void pick(turn.id, o)} />
                    </View>
                  ) : null}
                  {/* Several actions from one message (a bill: order → delivery → payment) run one step at a time: the next card
                      appears only after the previous is accepted or rejected, because later steps depend on the earlier ones. */}
                  {/* The message carries the details; only the question sits under it. A settled write leaves nothing behind:
                      its outcome is a message of its own. */}
                  {turn.drafts.map((_, di) => {
                    const previousSettled = turn.drafts.slice(0, di).every((_, k) => !!turn.settled?.[k]);
                    if (!previousSettled || turn.settled?.[di]) return null;
                    return (
                      <View key={`${turn.id}-dw${di}`} style={styles.replyPiece}>
                        <DraftActions
                          step={turn.drafts.length > 1 ? { index: di + 1, total: turn.drafts.length } : undefined}
                          disabled={busy}
                          onSave={() => setConfirm({ turnId: turn.id, index: di })}
                          onReject={() => settle(turn.id, di, 'rejected')}
                        />
                      </View>
                    );
                  })}
                  {turn.links?.length ? (
                    <View style={styles.replyPiece}>
                      {turn.links.map((screen) => (
                        <Pressable key={screen} onPress={() => openScreen(navigation, screen)} accessibilityRole="button" style={({ pressed }) => [styles.linkRow, pressed && styles.chipPressed]}>
                          <AppIcon name="add" size={16} color="accent" />
                          <AppText size="sm" weight="bold" color="accent">
                            {t(OPEN_SCREEN_LABEL[screen])}
                          </AppText>
                          <AppIcon name="forward" size={14} color="accent" />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {turn.open ? <OpenBubble screen={turn.open} /> : null}
                  </View>
                  <BubbleTail side="left" color={theme.colors.card} />
                  </View>
                  </TurnPiece>
                  {/* Same action row under EVERY reply — copy takes the text plus the cards. */}
                  <MessageActions
                    text={turnToText(turn.text, turn.cards) || undefined}
                    onCopied={() => showToast(t('aiCopied'))}
                    onSpeak={turn.text ? (x) => void speak(x, language) : undefined}
                    disabled={busy}
                    usage={turn.usage}
                  />
                  {turn.suggestions.length > 0 && turn.options.length === 0 && turn.id === lastAssistantId ? (
                    <TurnPiece step={1}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.followRow}>
                      {turn.suggestions.map((sug) => (
                        <Pressable
                          key={sug}
                          onPress={() => void ask(sug)}
                          disabled={busy}
                          accessibilityRole="button"
                          hitSlop={theme.touch.hitSlop}
                          style={({ pressed }) => [styles.followChip, pressed && styles.chipPressed]}
                        >
                          <AppText size="xs" weight="semibold" color="accent" numberOfLines={1}>
                            {sug}
                          </AppText>
                        </Pressable>
                      ))}
                    </ScrollView>
                    </TurnPiece>
                  ) : null}
                </View>
              </AssistantRow>
            );
  }

  return (
    <View style={styles.screen}>
      <ChatWallpaper />
      <AppHeader
        title={t('assistantTitle')}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'settings', onPress: () => navigation.navigate('Settings'), accessibilityLabel: t('settings') }}
        secondaryAction={
          turns.length > 0
            ? {
                icon: 'trash',
                accessibilityLabel: t('aiClearChat'),
                onPress: () =>
                  Alert.alert(t('aiClearChat'), t('aiClearChatConfirm'), [
                    { text: t('cancel'), style: 'cancel' },
                    { text: t('aiClearChat'), style: 'destructive', onPress: clear },
                  ]),
              }
            : undefined
        }
      />
      <Animated.View style={[styles.flex, liftStyle]}>
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
                <AppText size="sm" color="textSecondary" style={styles.flex}>
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
                      hitSlop={theme.touch.hitSlop}
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

          {turns.map((turn) => (
            // Restored turns were already on screen when the user arrived: no entrance for them.
            <MotionContext.Provider key={turn.id} value={!restoredIds.has(turn.id)}>
              {renderTurn(turn)}
            </MotionContext.Provider>
          ))}

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
            bottomInset={insets.bottom}
            attachments={attachments}
            onAttach={() => setAttachSheet(true)}
            onRemoveAttachment={(uri) => setAttachments((cur) => cur.filter((a) => a.uri !== uri))}
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
      </Animated.View>
      <SelectSheet
        visible={attachSheet}
        onClose={() => setAttachSheet(false)}
        title={t('aiAttach')}
        searchable={false}
        options={[
          { id: 'camera', label: t('aiFromCamera'), icon: 'camera' as IconKey },
          { id: 'gallery', label: t('aiFromGallery'), icon: 'image' as IconKey },
        ]}
        onSelect={(o) => {
          setAttachSheet(false);
          addPhoto(o.id as 'camera' | 'gallery');
        }}
      />
      <DraftSheet
        visible={confirm !== null && !!confirmDraft}
        onClose={() => setConfirm(null)}
        resolved={confirmDraft ?? null}
        step={confirmTurn && confirmTurn.role === 'assistant' && 'drafts' in confirmTurn && confirmTurn.drafts.length > 1 ? { index: confirm!.index + 1, total: confirmTurn.drafts.length } : undefined}
        poId={confirmLinkedPo}
        onSettled={(status, message, poId, used, receipt) => {
          if (confirm) settle(confirm.turnId, confirm.index, status, message, poId, used, receipt);
          setConfirm(null);
        }}
        onDone={showToast}
      />
      <Toast message={toast} />
    </View>
  );
}
