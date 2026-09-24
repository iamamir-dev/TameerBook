import React, { useState } from 'react';
import { Alert } from 'react-native';

import { AI_PROVIDERS, PROVIDERS, REPLY_LANGUAGE_SETTINGS, testConnection, type AiProviderId, type ReplyLanguageSetting } from '@/ai';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { SettingsGroup, SettingsRow } from '@/components/settings';
import { AppButton, AppIcon, AppSheet, AppToggle, SelectSheet, type IconKey, type SelectOption } from '@/components/ui';
import { useTranslation, type TranslationKey } from '@/i18n';
import { forgetMemory } from '@/modules/assistant/utils/memoryStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

type AiEdit = 'key' | 'model' | 'proxyUrl' | 'proxyToken' | 'gatewayUrl' | 'voiceKey';
const EDIT_LABEL: Record<AiEdit, TranslationKey> = {
  key: 'aiKeyLabel',
  model: 'aiModelLabel',
  proxyUrl: 'aiProxyUrlLabel',
  proxyToken: 'aiProxyTokenLabel',
  gatewayUrl: 'aiGatewayUrlLabel',
  voiceKey: 'aiVoiceKeyLabel',
};
const REPLY_LANG_KEY: Record<ReplyLanguageSetting, TranslationKey> = { auto: 'aiReplyLangAuto', ur: 'aiReplyLangUr', roman: 'aiReplyLangRoman', en: 'aiReplyLangEn' };

/** The assistant: engine (provider, key, model), voice and reply language, memory. */
export function AssistantSection(): React.JSX.Element {
  const { t } = useTranslation();
  const s = useSettingsStore();

  const providerInfo = PROVIDERS[s.aiProvider];
  const currentKey = s.aiKeys[s.aiProvider] ?? '';
  const currentModel = s.aiModel[s.aiProvider] || providerInfo.defaultModel;

  const [edit, setEdit] = useState<AiEdit | null>(null);
  const [draft, setDraft] = useState('');
  const [sheet, setSheet] = useState<'provider' | 'model' | 'replyLang' | null>(null);
  const [test, setTest] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');
  const [testDetail, setTestDetail] = useState('');
  const [forgot, setForgot] = useState(false);

  const openEdit = (which: AiEdit) => {
    const cur =
      which === 'key' ? currentKey
      : which === 'model' ? currentModel
      : which === 'proxyUrl' ? s.aiProxyUrl
      : which === 'proxyToken' ? s.aiProxyToken
      : which === 'gatewayUrl' ? s.aiCustomBaseUrl
      : s.aiKeys.openai;
    setDraft(cur ?? '');
    setEdit(which);
  };
  const saveEdit = () => {
    const v = draft.trim() || null;
    if (edit === 'key') s.setAiKey(s.aiProvider, v);
    else if (edit === 'model') s.setAiModel(s.aiProvider, v);
    else if (edit === 'proxyUrl') s.setAiProxyUrl(v);
    else if (edit === 'proxyToken') s.setAiProxyToken(v);
    else if (edit === 'gatewayUrl') s.setAiCustomBaseUrl(v);
    else if (edit === 'voiceKey') s.setAiKey('openai', v);
    setEdit(null);
    setTest('idle');
  };
  const runTest = () => {
    setTest('busy');
    testConnection()
      .then((r) => {
        setTest('ok');
        setTestDetail(r);
      })
      .catch((e: unknown) => {
        setTest('fail');
        setTestDetail(e instanceof Error ? e.message.slice(0, 80) : String(e));
      });
  };
  const onForget = () =>
    Alert.alert(t('aiForgetLabel'), t('aiForgetConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('aiForgetLabel'), style: 'destructive', onPress: () => void forgetMemory().then(() => setForgot(true)) },
    ]);

  const providerOptions: SelectOption[] = AI_PROVIDERS.map((id) => ({ id, label: PROVIDERS[id].label, subtitle: PROVIDERS[id].hint, icon: 'assistant' as IconKey }));
  const modelOptions: SelectOption[] = [...providerInfo.models.map((m) => ({ id: m.id, label: m.id, subtitle: m.note, icon: 'assistant' as IconKey })), { id: '__custom__', label: t('aiModelCustom'), icon: 'edit' as IconKey }];
  const replyLangOptions: SelectOption[] = REPLY_LANGUAGE_SETTINGS.map((id) => ({ id, label: t(REPLY_LANG_KEY[id]), icon: 'language' as IconKey }));
  const check = <AppIcon name="checkCircle" size={20} color="accent" />;

  const editHint =
    edit === 'key' ? `${t('aiKeyHint')}${providerInfo.consoleUrl ? ` ${providerInfo.consoleUrl}` : ''}`
    : edit === 'voiceKey' ? t('aiVoiceKeyHint')
    : edit === 'proxyUrl' ? t('aiProxyUrlHint')
    : edit === 'gatewayUrl' ? t('aiGatewayUrlHint')
    : undefined;

  return (
    <>
      <SettingsGroup footer={t('aiEnabledHint')}>
        <SettingsRow title={t('aiEnabledLabel')} subtitle={t('aiEnabledDesc')} trailing={<AppToggle value={s.aiEnabled} onValueChange={s.setAiEnabled} accessibilityLabel={t('aiEnabledLabel')} />} />
      </SettingsGroup>

      {s.aiEnabled ? (
        <>
          <SettingsGroup header={t('hdrEngine')}>
            <SettingsRow title={t('aiProviderLabel')} subtitle={providerInfo.hint} value={providerInfo.label} onPress={() => setSheet('provider')} />
            {providerInfo.needsKey ? <SettingsRow title={t('aiKeyLabel')} subtitle={t('aiKeyHint')} trailing={currentKey ? check : undefined} onPress={() => openEdit('key')} /> : null}
            {s.aiProvider === 'proxy' ? <SettingsRow title={t('aiProxyUrlLabel')} subtitle={s.aiProxyUrl ?? t('aiProxyUrlHint')} trailing={s.aiProxyUrl ? check : undefined} onPress={() => openEdit('proxyUrl')} /> : null}
            {s.aiProvider === 'proxy' ? <SettingsRow title={t('aiProxyTokenLabel')} trailing={s.aiProxyToken ? check : undefined} onPress={() => openEdit('proxyToken')} /> : null}
            {providerInfo.urlEditable ? <SettingsRow title={t('aiGatewayUrlLabel')} subtitle={s.aiCustomBaseUrl ?? 'api.mwapi.dev'} onPress={() => openEdit('gatewayUrl')} /> : null}
            <SettingsRow title={t('aiModelLabel')} value={currentModel} onPress={() => setSheet('model')} />
            <SettingsRow
              title={t('aiTestLabel')}
              subtitle={test === 'busy' ? '…' : test === 'ok' ? t('aiTestOk') : test === 'fail' ? testDetail : undefined}
              trailing={test === 'ok' ? check : test === 'fail' ? <AppIcon name="alert" size={20} color="danger" /> : undefined}
              onPress={test !== 'busy' ? runTest : undefined}
            />
          </SettingsGroup>

          <SettingsGroup header={t('hdrVoiceLang')} footer={!providerInfo.voice && !s.aiKeys.openai ? t('aiVoiceHint') : undefined}>
            {!providerInfo.voice ? <SettingsRow title={t('aiVoiceKeyLabel')} subtitle={t('aiVoiceKeyHint')} trailing={s.aiKeys.openai ? check : undefined} onPress={() => openEdit('voiceKey')} /> : null}
            <SettingsRow title={t('aiReplyLangLabel')} value={t(REPLY_LANG_KEY[s.aiReplyLanguage])} onPress={() => setSheet('replyLang')} />
            <SettingsRow title={t('aiSpeakLabel')} subtitle={t('aiSpeakDesc')} trailing={<AppToggle value={s.aiSpeak} onValueChange={s.setAiSpeak} accessibilityLabel={t('aiSpeakLabel')} />} />
          </SettingsGroup>

          <SettingsGroup header={t('hdrMemory')}>
            <SettingsRow title={t('aiForgetLabel')} subtitle={forgot ? t('aiForgotten') : t('aiForgetConfirm')} onPress={onForget} />
          </SettingsGroup>

        </>
      ) : null}

      <SelectSheet
        visible={sheet === 'provider'}
        onClose={() => setSheet(null)}
        options={providerOptions}
        selectedId={s.aiProvider}
        title={t('aiProviderLabel')}
        searchable={false}
        onSelect={(o) => {
          s.setAiProvider(o.id as AiProviderId);
          setTest('idle');
          setSheet(null);
        }}
      />
      <SelectSheet
        visible={sheet === 'model'}
        onClose={() => setSheet(null)}
        options={modelOptions}
        selectedId={currentModel}
        title={t('aiModelLabel')}
        searchable={false}
        onSelect={(o) => {
          setSheet(null);
          if (o.id === '__custom__') openEdit('model');
          else s.setAiModel(s.aiProvider, o.id);
          setTest('idle');
        }}
      />
      <SelectSheet
        visible={sheet === 'replyLang'}
        onClose={() => setSheet(null)}
        options={replyLangOptions}
        selectedId={s.aiReplyLanguage}
        title={t('aiReplyLangLabel')}
        searchable={false}
        onSelect={(o) => {
          s.setAiReplyLanguage(o.id as ReplyLanguageSetting);
          setSheet(null);
        }}
      />
      <AppSheet visible={edit !== null} onClose={() => setEdit(null)} title={edit ? t(EDIT_LABEL[edit]) : ''} footer={<AppButton label={t('save')} icon="check" onPress={saveEdit} />}>
        <FloatingLabelInput label={edit ? t(EDIT_LABEL[edit]) : ''} value={draft} onChangeText={setDraft} hint={editHint} />
      </AppSheet>
    </>
  );
}
