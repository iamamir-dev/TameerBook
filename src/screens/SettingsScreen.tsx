import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppSheet,
  AppText,
  AppToggle,
  SelectSheet,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AI_PROVIDERS, PROVIDERS, REPLY_LANGUAGE_SETTINGS, testConnection, type AiProviderId, type ReplyLanguageSetting } from '@/ai';
import { forgetMemory } from '@/modules/assistant/utils/memoryStore';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { Language } from '@/i18n/types';
import type { RootStackParamList } from '@/navigation/types';
import { rescheduleReminders } from '@/notifications/reminders';
import { useCompanyStore } from '@/stores/useCompanyStore';
import {
  useSettingsStore,
  type HomeSectionKey,
  type ReminderKey,
} from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';
import { FONT_OPTIONS, FONT_SCALES, type FontKey, type FontScaleKey, type Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { reloadApp, syncLayoutDirection } from '@/utils/rtl';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const APP_VERSION: string = (require('../../app.json') as { expo: { version: string } }).expo
  .version;

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Settings screen.
 * Cleanly categorized into distinct cards:
 * 1. Active Company / Workspace
 * 2. Management Hubs (Accounts, Reports, Categories)
 * 3. Preferences (Language, Dark Mode, Typography)
 * 4. Financial & Sadaqah
 * 5. Documents & Signatures
 * 6. AI Assistant (collapsible when disabled)
 * 7. Reminders
 * 8. Home Screen customization
 * 9. About & DevTools
 */
export function SettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);

  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const darkMode = useSettingsStore((s) => s.darkMode);
  const setDarkMode = useSettingsStore((s) => s.setDarkMode);
  const reminders = useSettingsStore((s) => s.reminders);
  const setReminder = useSettingsStore((s) => s.setReminder);
  const donationPct = useSettingsStore((s) => s.donationPct);
  const setDonationPct = useSettingsStore((s) => s.setDonationPct);
  const signature = useSettingsStore((s) => s.signature);
  const setSignature = useSettingsStore((s) => s.setSignature);
  const removeBgKey = useSettingsStore((s) => s.removeBgKey);
  const setRemoveBgKey = useSettingsStore((s) => s.setRemoveBgKey);
  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  const setAiEnabled = useSettingsStore((s) => s.setAiEnabled);
  const aiSpeak = useSettingsStore((s) => s.aiSpeak);
  const setAiSpeak = useSettingsStore((s) => s.setAiSpeak);
  const aiProvider = useSettingsStore((s) => s.aiProvider);
  const setAiProvider = useSettingsStore((s) => s.setAiProvider);
  const aiKeys = useSettingsStore((s) => s.aiKeys);
  const setAiKey = useSettingsStore((s) => s.setAiKey);
  const aiModel = useSettingsStore((s) => s.aiModel);
  const setAiModel = useSettingsStore((s) => s.setAiModel);
  const aiProxyUrl = useSettingsStore((s) => s.aiProxyUrl);
  const setAiProxyUrl = useSettingsStore((s) => s.setAiProxyUrl);
  const aiProxyToken = useSettingsStore((s) => s.aiProxyToken);
  const setAiProxyToken = useSettingsStore((s) => s.setAiProxyToken);
  const aiCustomBaseUrl = useSettingsStore((s) => s.aiCustomBaseUrl);
  const setAiCustomBaseUrl = useSettingsStore((s) => s.setAiCustomBaseUrl);
  const providerInfo = PROVIDERS[aiProvider];
  const currentKey = aiKeys[aiProvider] ?? '';
  const currentModel = aiModel[aiProvider] || providerInfo.defaultModel;

  // Which assistant text setting the sheet is editing (null = closed).
  type AiEdit = 'key' | 'model' | 'proxyUrl' | 'proxyToken' | 'customUrl' | 'groqVoiceKey';
  const [aiEdit, setAiEdit] = useState<AiEdit | null>(null);
  const [aiDraft, setAiDraft] = useState('');
  const [providerSheet, setProviderSheet] = useState(false);
  const [replyLangSheet, setReplyLangSheet] = useState(false);
  const aiReplyLanguage = useSettingsStore((s) => s.aiReplyLanguage);
  const setAiReplyLanguage = useSettingsStore((s) => s.setAiReplyLanguage);
  const REPLY_LANG_KEY: Record<ReplyLanguageSetting, TranslationKey> = {
    auto: 'aiReplyLangAuto',
    ur: 'aiReplyLangUr',
    roman: 'aiReplyLangRoman',
    en: 'aiReplyLangEn',
  };
  const replyLangOptions: SelectOption[] = REPLY_LANGUAGE_SETTINGS.map((id) => ({
    id,
    label: t(REPLY_LANG_KEY[id]),
    icon: 'language' as IconKey,
  }));
  const [forgot, setForgot] = useState(false);
  const onForgetMemory = () =>
    Alert.alert(t('aiForgetLabel'), t('aiForgetConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('aiForgetLabel'),
        style: 'destructive',
        onPress: () => {
          forgetMemory()
            .then(() => setForgot(true))
            .catch(swallow('settings:forgetMemory'));
        },
      },
    ]);
  const [modelSheet, setModelSheet] = useState(false);
  const [aiTest, setAiTest] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');
  const [aiTestDetail, setAiTestDetail] = useState('');
  const AI_EDIT_LABEL: Record<AiEdit, TranslationKey> = {
    key: 'aiKeyLabel',
    model: 'aiModelLabel',
    proxyUrl: 'aiProxyUrlLabel',
    proxyToken: 'aiProxyTokenLabel',
    customUrl: 'aiCustomUrlLabel',
    groqVoiceKey: 'aiGroqKeyLabel',
  };
  const openAiEdit = (which: AiEdit) => {
    const cur =
      which === 'key' ? currentKey
      : which === 'model' ? currentModel
      : which === 'proxyUrl' ? aiProxyUrl
      : which === 'proxyToken' ? aiProxyToken
      : which === 'customUrl' ? aiCustomBaseUrl
      : aiKeys.groq;
    setAiDraft(cur ?? '');
    setAiEdit(which);
  };
  const saveAiEdit = () => {
    const v = aiDraft.trim() || null;
    if (aiEdit === 'key') setAiKey(aiProvider, v);
    else if (aiEdit === 'model') setAiModel(aiProvider, v);
    else if (aiEdit === 'proxyUrl') setAiProxyUrl(v);
    else if (aiEdit === 'proxyToken') setAiProxyToken(v);
    else if (aiEdit === 'customUrl') setAiCustomBaseUrl(v);
    else if (aiEdit === 'groqVoiceKey') setAiKey('groq', v);
    setAiEdit(null);
    setAiTest('idle');
  };
  const runAiTest = () => {
    setAiTest('busy');
    testConnection()
      .then((r) => {
        setAiTest('ok');
        setAiTestDetail(r);
      })
      .catch((e: unknown) => {
        setAiTest('fail');
        setAiTestDetail(e instanceof Error ? e.message.slice(0, 80) : String(e));
      });
  };
  const providerOptions: SelectOption[] = AI_PROVIDERS.map((id) => ({
    id,
    label: PROVIDERS[id].label,
    subtitle: PROVIDERS[id].hint,
    icon: 'assistant' as IconKey,
  }));
  const modelOptions: SelectOption[] = [
    ...providerInfo.models.map((m) => ({ id: m.id, label: m.id, subtitle: m.note, icon: 'assistant' as IconKey })),
    { id: '__custom__', label: t('aiModelCustom'), icon: 'edit' as IconKey },
  ];
  const [keyOpen, setKeyOpen] = useState(false);
  const [draftKey, setDraftKey] = useState('');

  const onToggleReminder = (key: ReminderKey, value: boolean) => {
    setReminder(key, value);
    rescheduleReminders({ ...reminders, [key]: value }).catch(swallow('settings:rescheduleReminders'));
  };

  /**
   * Switch language and, when the layout direction changes (Urdu = RTL,
   * English = LTR), reload so the whole app mirrors. The choice is already
   * persisted, so it survives the reload.
   */
  const onChangeLanguage = (lang: Language) => {
    setLanguage(lang);
    setLangSheetOpen(false);
    if (syncLayoutDirection(lang)) {
      Alert.alert(t('language'), t('restartForRtl'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('done'), onPress: () => void reloadApp() },
      ]);
    }
  };

  const REMINDER_ROWS: { key: ReminderKey; labelKey: TranslationKey }[] = [
    { key: 'daily', labelKey: 'remDaily' },
    { key: 'deadline', labelKey: 'remDeadline' },
    { key: 'udhaar', labelKey: 'remUdhaar' },
    { key: 'buyer', labelKey: 'remBuyer' },
  ];

  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const fontScale = useSettingsStore((s) => s.fontScale);
  const setFontScale = useSettingsStore((s) => s.setFontScale);
  const homeSections = useSettingsStore((s) => s.homeSections);
  const setHomeSection = useSettingsStore((s) => s.setHomeSection);

  /** Optional Home sections (the essentials always show) — labels reuse the
   *  app's own terms. */
  const HOME_ROWS: { key: HomeSectionKey; labelKey: TranslationKey }[] = [
    { key: 'plots', labelKey: 'plotsTitle' },
    { key: 'labor', labelKey: 'laborTitle' },
    { key: 'udhaar', labelKey: 'udhaar' },
  ];

  const FONT_SIZE_LABEL: Record<FontScaleKey, TranslationKey> = {
    small: 'fsSmall',
    normal: 'fsNormal',
    large: 'fsLarge',
    xl: 'fsXL',
  };

  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [companySheetOpen, setCompanySheetOpen] = useState(false);
  const [fontSheetOpen, setFontSheetOpen] = useState(false);
  const [sizeSheetOpen, setSizeSheetOpen] = useState(false);

  const fontOptions = useMemo<SelectOption[]>(
    () =>
      (Object.keys(FONT_OPTIONS) as FontKey[]).map((key) => ({
        id: key,
        label: FONT_OPTIONS[key].label,
        icon: 'language' as IconKey,
      })),
    []
  );

  const sizeOptions = useMemo<SelectOption[]>(
    () =>
      (Object.keys(FONT_SCALES) as FontScaleKey[]).map((key) => ({
        id: key,
        label: t(FONT_SIZE_LABEL[key]),
        icon: 'language' as IconKey,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  const companies = useCompanyStore((st) => st.companies);
  const activeCompanyId = useCompanyStore((st) => st.activeCompanyId);
  const switchTo = useCompanyStore((st) => st.switchTo);
  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null;

  const NEW_COMPANY_ID = '__new__';
  const companyOptions = useMemo<SelectOption[]>(
    () => [
      ...companies.map((c) => ({
        id: c.id,
        label: c.name,
        subtitle: c.owner_name ?? undefined,
        icon: 'projects' as IconKey,
      })),
      { id: NEW_COMPANY_ID, label: t('newCompany'), icon: 'add' as IconKey },
    ],
    [companies, t]
  );

  /** Language options for the bottom-sheet picker. */
  const languageOptions = useMemo<SelectOption[]>(
    () => [
      { id: 'ur', label: t('urdu'), icon: 'language' },
      { id: 'en', label: t('english'), icon: 'language' },
    ],
    [t]
  );

  const languageLabels: Record<Language, string> = {
    ur: t('urdu'),
    en: t('english'),
  };
  const currentLanguageLabel = languageLabels[language];
  const appVersion = APP_VERSION;

  return (
    <View style={styles.screen}>
      <AppHeader title={t('settings')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 1. Active Workspace / Company */}
        <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionTitle}>
          {t('companyTitle')}
        </AppText>
        <AppCard compact>
          <SettingRow
            icon="projects"
            label={activeCompany?.name ?? t('companyTitle')}
            subtitle={t('switchCompany')}
            value={activeCompany?.owner_name ?? undefined}
            onPress={() => setCompanySheetOpen(true)}
          />
          <Divider />
          <SettingRow
            icon="settings"
            label={t('companySetupTitle')}
            subtitle={t('companyNameHint')}
            onPress={() => navigation.navigate('CompanyDetail')}
          />
        </AppCard>

        {/* 2. Management Hubs */}
        <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionTitle}>
          {t('goToSection')}
        </AppText>
        <AppCard compact>
          <SettingRow
            icon="balance"
            label={t('accountsTitle')}
            onPress={() => navigation.navigate('Accounts')}
          />
          <Divider />
          <SettingRow
            icon="reports"
            label={t('reports')}
            onPress={() => navigation.navigate('Reports')}
          />
          <Divider />
          <SettingRow
            icon="ledger"
            label={t('manageCategories')}
            onPress={() => navigation.navigate('Categories')}
          />
        </AppCard>

        {/* 3. Preferences — language, theme, typography */}
        <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionTitle}>
          {t('preferencesSection')}
        </AppText>
        <AppCard compact>
          <SettingRow
            icon="language"
            label={t('language')}
            value={currentLanguageLabel}
            onPress={() => setLangSheetOpen(true)}
          />
          <Divider />
          <SettingRow
            icon="moon"
            label={t('darkMode')}
            trailing={
              <AppToggle value={darkMode} onValueChange={setDarkMode} accessibilityLabel={t('darkMode')} />
            }
          />
          <Divider />
          <SettingRow
            icon="font"
            label={t('fontFamilyLabel')}
            value={FONT_OPTIONS[fontFamily].label}
            onPress={() => setFontSheetOpen(true)}
          />
          <Divider />
          <SettingRow
            icon="textSize"
            label={t('fontSizeLabel')}
            value={t(FONT_SIZE_LABEL[fontScale])}
            onPress={() => setSizeSheetOpen(true)}
          />
        </AppCard>

        {/* 4. Financial & Sadaqah */}
        <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionTitle}>
          {t('donationPctLabel')}
        </AppText>
        <AppCard compact>
          <View style={styles.row}>
            <View style={styles.iconChip}>
              <AppIcon name="investor" size={22} color="primary" />
            </View>
            <View style={styles.rowLabelWrap}>
              <AppText size="md" weight="semibold">
                {t('donationPctLabel')}
              </AppText>
              <AppText size="xs" color="textSecondary">
                {donationPct > 0 ? `${donationPct}% ${t('plotProfit')}` : t('donationNote')}
              </AppText>
            </View>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setDonationPct(Math.max(0, donationPct - 1))}
                hitSlop={theme.touch.hitSlop}
                accessibilityRole="button"
                accessibilityLabel="-1%"
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <AppText size="lg" weight="bold" color="primary">
                  −
                </AppText>
              </Pressable>
              <AppText size="md" weight="bold" tabular style={styles.stepValue}>
                {donationPct}%
              </AppText>
              <Pressable
                onPress={() => setDonationPct(Math.min(100, donationPct + 1))}
                hitSlop={theme.touch.hitSlop}
                accessibilityRole="button"
                accessibilityLabel="+1%"
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <AppText size="lg" weight="bold" color="primary">
                  +
                </AppText>
              </Pressable>
            </View>
          </View>
          <AppText size="xs" color="textSecondary" style={styles.note}>
            {t('donationNote')}
          </AppText>
        </AppCard>

        {/* 5. Documents & Signatures */}
        <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionTitle}>
          {t('signaturesTitle')}
        </AppText>
        <AppCard compact>
          <SettingRow
            icon="agreement"
            label={t('signatureSetting')}
            value={signature ? undefined : t('addSignature')}
            trailing={signature ? <AppIcon name="checkCircle" size={20} color="accent" /> : undefined}
            onPress={() => navigation.navigate('Signature')}
            onLongPress={
              signature
                ? () =>
                    Alert.alert(t('signatureSetting'), t('deleteConfirm'), [
                      { text: t('cancel'), style: 'cancel' },
                      { text: t('delete'), style: 'destructive', onPress: () => setSignature(null) },
                    ])
                : undefined
            }
          />
          <Divider />
          <SettingRow
            icon="key"
            label={t('removeBgKeyLabel')}
            trailing={removeBgKey ? <AppIcon name="checkCircle" size={20} color="accent" /> : undefined}
            onPress={() => {
              setDraftKey(removeBgKey ?? '');
              setKeyOpen(true);
            }}
          />
        </AppCard>

        {/* 6. Assistant (AI) — Collapsible when disabled */}
        <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionTitle}>
          {t('aiSectionTitle')}
        </AppText>
        <AppCard compact>
          <SettingRow
            icon="assistant"
            label={t('aiEnabledLabel')}
            trailing={<AppToggle value={aiEnabled} onValueChange={setAiEnabled} accessibilityLabel={t('aiEnabledLabel')} />}
          />
          {aiEnabled ? (
            <>
              <Divider />
              <SettingRow icon="settings" label={t('aiProviderLabel')} value={providerInfo.label} onPress={() => setProviderSheet(true)} />
              <Divider />
              {providerInfo.needsKey ? (
                <>
                  <SettingRow
                    icon="key"
                    label={t('aiKeyLabel')}
                    trailing={currentKey ? <AppIcon name="checkCircle" size={20} color="accent" /> : undefined}
                    onPress={() => openAiEdit('key')}
                  />
                  <Divider />
                </>
              ) : null}
              {aiProvider === 'proxy' ? (
                <>
                  <SettingRow
                    icon="key"
                    label={t('aiProxyUrlLabel')}
                    trailing={aiProxyUrl ? <AppIcon name="checkCircle" size={20} color="accent" /> : undefined}
                    onPress={() => openAiEdit('proxyUrl')}
                  />
                  <Divider />
                  <SettingRow
                    icon="lock"
                    label={t('aiProxyTokenLabel')}
                    trailing={aiProxyToken ? <AppIcon name="checkCircle" size={20} color="accent" /> : undefined}
                    onPress={() => openAiEdit('proxyToken')}
                  />
                  <Divider />
                </>
              ) : null}
              {aiProvider === 'custom' ? (
                <>
                  <SettingRow
                    icon="key"
                    label={t('aiCustomUrlLabel')}
                    trailing={aiCustomBaseUrl ? <AppIcon name="checkCircle" size={20} color="accent" /> : undefined}
                    onPress={() => openAiEdit('customUrl')}
                  />
                  <Divider />
                </>
              ) : null}
              <SettingRow icon="edit" label={t('aiModelLabel')} value={currentModel} onPress={() => setModelSheet(true)} />
              <Divider />
              {!providerInfo.voice ? (
                <>
                  <SettingRow
                    icon="mic"
                    label={t('aiGroqKeyLabel')}
                    trailing={aiKeys.groq ? <AppIcon name="checkCircle" size={20} color="accent" /> : undefined}
                    onPress={() => openAiEdit('groqVoiceKey')}
                  />
                  <Divider />
                </>
              ) : null}
              <SettingRow icon="language" label={t('aiReplyLangLabel')} value={t(REPLY_LANG_KEY[aiReplyLanguage])} onPress={() => setReplyLangSheet(true)} />
              <Divider />
              <SettingRow
                icon="speaker"
                label={t('aiSpeakLabel')}
                trailing={<AppToggle value={aiSpeak} onValueChange={setAiSpeak} accessibilityLabel={t('aiSpeakLabel')} />}
              />
              <Divider />
              <SettingRow icon="trash" label={t('aiForgetLabel')} value={forgot ? t('aiForgotten') : undefined} onPress={onForgetMemory} />
              <Divider />
              <SettingRow
                icon={aiTest === 'ok' ? 'checkCircle' : aiTest === 'fail' ? 'alert' : 'activity'}
                label={t('aiTestLabel')}
                value={aiTest === 'busy' ? '…' : aiTest === 'ok' ? t('aiTestOk') : aiTest === 'fail' ? aiTestDetail : undefined}
                onPress={aiTest !== 'busy' ? runAiTest : undefined}
              />
            </>
          ) : null}
        </AppCard>
        <AppText size="xs" color="textSecondary" style={styles.sectionTitle}>
          {aiEnabled
            ? [t('aiEnabledHint'), !providerInfo.voice ? t('aiGroqVoiceHint') : null, providerInfo.trainsOnData ? t('aiTrainsNote') : null].filter(Boolean).join(' ')
            : t('aiEnabledHint')}
        </AppText>

        {/* 7. Reminders */}
        <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionTitle}>
          {t('reminders')}
        </AppText>
        <AppCard compact>
          {REMINDER_ROWS.map((r, i) => (
            <View key={r.key}>
              {i > 0 ? <Divider /> : null}
              <SettingRow
                icon="bell"
                label={t(r.labelKey)}
                trailing={
                  <AppToggle
                    value={reminders[r.key]}
                    onValueChange={(v) => onToggleReminder(r.key, v)}
                    accessibilityLabel={t(r.labelKey)}
                  />
                }
              />
            </View>
          ))}
        </AppCard>

        {/* 8. Home Customization */}
        <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionTitle}>
          {t('homeSettingsTitle')}
        </AppText>
        <AppCard compact>
          {HOME_ROWS.map((r, i) => (
            <View key={r.key}>
              {i > 0 ? <Divider /> : null}
              <SettingRow
                icon="home"
                label={t(r.labelKey)}
                trailing={
                  <AppToggle
                    value={homeSections[r.key]}
                    onValueChange={(v) => setHomeSection(r.key, v)}
                    accessibilityLabel={t(r.labelKey)}
                  />
                }
              />
            </View>
          ))}
        </AppCard>

        {/* 9. About & DevTools */}
        <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionTitle}>
          {t('appVersion')}
        </AppText>
        <AppCard compact>
          <SettingRow
            icon="info"
            label={t('appVersion')}
            value={`v${appVersion}`}
            onLongPress={() => navigation.navigate('DevTools')}
            accessibilityHint="Long press for DevTools"
          />
        </AppCard>
      </ScrollView>

      <SelectSheet
        visible={companySheetOpen}
        onClose={() => setCompanySheetOpen(false)}
        options={companyOptions}
        selectedId={activeCompanyId ?? undefined}
        title={t('switchCompany')}
        searchable={false}
        onSelect={(o) => {
          if (o.id === NEW_COMPANY_ID) navigation.navigate('NewCompany');
          else switchTo(o.id).catch(swallow('settings:switchCompany'));
        }}
      />

      <SelectSheet
        visible={langSheetOpen}
        onClose={() => setLangSheetOpen(false)}
        options={languageOptions}
        selectedId={language}
        title={t('language')}
        searchable={false}
        onSelect={(option) => onChangeLanguage(option.id as Language)}
      />

      <SelectSheet
        visible={fontSheetOpen}
        onClose={() => setFontSheetOpen(false)}
        options={fontOptions}
        selectedId={fontFamily}
        title={t('fontFamilyLabel')}
        searchable={false}
        onSelect={(option) => setFontFamily(option.id as FontKey)}
      />

      <SelectSheet
        visible={sizeSheetOpen}
        onClose={() => setSizeSheetOpen(false)}
        options={sizeOptions}
        selectedId={fontScale}
        title={t('fontSizeLabel')}
        searchable={false}
        onSelect={(option) => setFontScale(option.id as FontScaleKey)}
      />

      <AppSheet
        visible={keyOpen}
        onClose={() => setKeyOpen(false)}
        title={t('removeBgKeyLabel')}
        footer={
          <AppButton
            label={t('save')}
            icon="check"
            onPress={() => {
              setRemoveBgKey(draftKey.trim() || null);
              setKeyOpen(false);
            }}
          />
        }
      >
        <FloatingLabelInput label={t('removeBgKeyLabel')} value={draftKey} onChangeText={setDraftKey} hint={t('removeBgKeyHint')} />
      </AppSheet>

      <SelectSheet
        visible={replyLangSheet}
        onClose={() => setReplyLangSheet(false)}
        options={replyLangOptions}
        selectedId={aiReplyLanguage}
        title={t('aiReplyLangLabel')}
        searchable={false}
        onSelect={(o) => {
          setAiReplyLanguage(o.id as ReplyLanguageSetting);
          setReplyLangSheet(false);
        }}
      />

      <SelectSheet
        visible={providerSheet}
        onClose={() => setProviderSheet(false)}
        options={providerOptions}
        selectedId={aiProvider}
        title={t('aiProviderLabel')}
        searchable={false}
        onSelect={(o) => {
          setAiProvider(o.id as AiProviderId);
          setAiTest('idle');
        }}
      />

      <SelectSheet
        visible={modelSheet}
        onClose={() => setModelSheet(false)}
        options={modelOptions}
        selectedId={currentModel}
        title={t('aiModelLabel')}
        searchable={false}
        onSelect={(o) => {
          if (o.id === '__custom__') openAiEdit('model');
          else setAiModel(aiProvider, o.id);
          setAiTest('idle');
        }}
      />

      <AppSheet
        visible={aiEdit !== null}
        onClose={() => setAiEdit(null)}
        title={aiEdit ? t(AI_EDIT_LABEL[aiEdit]) : ''}
        footer={<AppButton label={t('save')} icon="check" onPress={saveAiEdit} />}
      >
        <FloatingLabelInput
          label={aiEdit ? t(AI_EDIT_LABEL[aiEdit]) : ''}
          value={aiDraft}
          onChangeText={setAiDraft}
          hint={
            aiEdit === 'key' || aiEdit === 'groqVoiceKey'
              ? `${t('aiKeyHint')}${providerInfo.consoleUrl && aiEdit === 'key' ? ` ${providerInfo.consoleUrl}` : aiEdit === 'groqVoiceKey' ? ' console.groq.com' : ''}`
              : aiEdit === 'proxyUrl'
                ? t('aiProxyUrlHint')
                : aiEdit === 'customUrl'
                  ? t('aiCustomUrlHint')
                  : undefined
          }
        />
      </AppSheet>
    </View>
  );
}

/* ------------------------------ helpers --------------------------------- */

interface SettingRowProps {
  icon: IconKey;
  label: string;
  subtitle?: string;
  /** Read-only value shown on the right (mutually exclusive with `trailing`). */
  value?: string;
  /** Custom trailing control (e.g. a Switch). */
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Hidden affordance (e.g. long-press app version to open Dev Tools). */
  onLongPress?: () => void;
  accessibilityHint?: string;
}

/** One settings line: leading icon chip + label with optional subtitle, optional value / control. */
function SettingRow({
  icon,
  label,
  subtitle,
  value,
  trailing,
  onPress,
  onLongPress,
  accessibilityHint,
}: SettingRowProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const body = (
    <View style={styles.row}>
      <View style={styles.iconChip}>
        <AppIcon name={icon} size={22} color="primary" />
      </View>
      <View style={styles.rowLabelWrap}>
        <AppText size="md" weight="semibold">
          {label}
        </AppText>
        {subtitle ? (
          <AppText size="xs" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ? (
        trailing
      ) : (
        <View style={styles.valueWrap}>
          {value ? (
            <AppText size="md" color="textSecondary">
              {value}
            </AppText>
          ) : null}
          {onPress ? <AppIcon name="forward" size={20} color="textSecondary" /> : null}
        </View>
      )}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}${value ? `, ${value}` : ''}${subtitle ? `, ${subtitle}` : ''}`}
        accessibilityHint={accessibilityHint}
        hitSlop={theme.touch.hitSlop}
        style={({ pressed }) => (pressed ? styles.pressed : undefined)}
      >
        {body}
      </Pressable>
    );
  }
  return body;
}

function Divider(): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return <View style={styles.divider} />;
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl + 40,
      gap: theme.spacing.md,
    },
    sectionTitle: {
      marginTop: theme.spacing.sm,
    },
    row: {
      minHeight: theme.touch.minTarget,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    iconChip: {
      width: 38,
      height: 38,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabelWrap: {
      flex: 1,
      gap: 2,
    },
    valueWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
    },
    pressed: {
      opacity: 0.6,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepValue: {
      minWidth: 48,
      textAlign: 'center',
    },
    note: {
      marginTop: theme.spacing.sm,
      marginLeft: 50,
    },
  });
