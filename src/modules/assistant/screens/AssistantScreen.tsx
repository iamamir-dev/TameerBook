import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
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
import { AssistantBubble, ErrorBubble, UserBubble } from '../components/MessageBubble';
import { useAssistant } from '../hooks/useAssistant';
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
  const hasProvider = useSettingsStore((s) => !!s.aiProxyUrl || !!s.aiGroqKey);
  const ready = aiEnabled && hasProvider;

  const { turns, busy, ask } = useAssistant();
  const { toast, showToast } = useToast();
  const [input, setInput] = useState(params?.seed ?? '');
  const scroll = useRef<ScrollView>(null);

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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
                  <AppIcon name="activity" size={22} color="accent" />
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
                      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                    >
                      <AppIcon name="search" size={14} color="textSecondary" />
                      <AppText size="sm" weight="semibold">
                        {t(k)}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {turns.map((turn) => {
            if (turn.role === 'user') return <UserBubble key={turn.id} text={turn.text} />;
            switch (turn.kind) {
              case 'text':
                return <AssistantBubble key={turn.id} text={turn.text} />;
              case 'answer':
                return <AnswerCard key={turn.id} answer={turn.answer} />;
              case 'draft':
                return <DraftCard key={turn.id} resolved={turn.resolved} onDone={showToast} />;
              case 'error':
                return <ErrorBubble key={turn.id} code={turn.code} />;
            }
          })}

          {busy ? (
            <View style={styles.thinking}>
              <ActivityIndicator color={theme.colors.accent} />
              <AppText size="sm" color="textSecondary">
                {t('aiThinking')}
              </AppText>
            </View>
          ) : null}
        </ScrollView>

        {ready ? (
          <Composer value={input} onChange={setInput} onSend={send} disabled={busy} bottomInset={insets.bottom} />
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
