import React, { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { SettingsGroup, SettingsRow } from '@/components/settings';
import { AppToggle, SelectSheet, type IconKey, type SelectOption } from '@/components/ui';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { Language } from '@/i18n/types';
import { CHAT_WALLPAPERS, wallpaperSwatch, type ChatWallpaperId } from '@/modules/assistant/wallpapers';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { FONT_OPTIONS, FONT_SCALES, type FontKey, type FontScaleKey } from '@/theme/theme';
import { reloadApp, syncLayoutDirection } from '@/utils/rtl';

const FONT_SIZE_LABEL: Record<FontScaleKey, TranslationKey> = { small: 'fsSmall', normal: 'fsNormal', large: 'fsLarge', xl: 'fsXL' };
const WALLPAPER_LABEL: Record<ChatWallpaperId, TranslationKey> = { classic: 'wpClassic', white: 'wpWhite', sage: 'wpSage', night: 'wpNight' };

/** Language, theme, typography. */
export function PreferencesSection(): React.JSX.Element {
  const { t, language } = useTranslation();
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const darkMode = useSettingsStore((s) => s.darkMode);
  const setDarkMode = useSettingsStore((s) => s.setDarkMode);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const fontScale = useSettingsStore((s) => s.fontScale);
  const setFontScale = useSettingsStore((s) => s.setFontScale);
  const chatWallpaper = useSettingsStore((s) => s.chatWallpaper);
  const setChatWallpaper = useSettingsStore((s) => s.setChatWallpaper);

  const [sheet, setSheet] = useState<'lang' | 'font' | 'size' | 'wallpaper' | null>(null);

  const languageOptions = useMemo<SelectOption[]>(
    () => [
      { id: 'ur', label: t('urdu'), icon: 'language' },
      { id: 'en', label: t('english'), icon: 'language' },
    ],
    [t]
  );
  const fontOptions = useMemo<SelectOption[]>(() => (Object.keys(FONT_OPTIONS) as FontKey[]).map((key) => ({ id: key, label: FONT_OPTIONS[key].label, icon: 'font' as IconKey })), []);
  const wallpaperOptions = useMemo<SelectOption[]>(() => CHAT_WALLPAPERS.map((id) => ({ id, label: t(WALLPAPER_LABEL[id]), dotColor: wallpaperSwatch(id) })), [t]);
  const sizeOptions = useMemo<SelectOption[]>(() => (Object.keys(FONT_SCALES) as FontScaleKey[]).map((key) => ({ id: key, label: t(FONT_SIZE_LABEL[key]), icon: 'textSize' as IconKey })), [t]);

  /** Switch language and, when the layout direction changes (Urdu = RTL), reload so the whole app mirrors. */
  const onChangeLanguage = (lang: Language) => {
    setLanguage(lang);
    setSheet(null);
    if (syncLayoutDirection(lang)) {
      Alert.alert(t('language'), t('restartForRtl'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('done'), onPress: () => void reloadApp() },
      ]);
    }
  };

  return (
    <>
      <SettingsGroup header={t('hdrDisplay')}>
        <SettingsRow title={t('language')} value={language === 'ur' ? t('urdu') : t('english')} onPress={() => setSheet('lang')} />
        <SettingsRow title={t('darkMode')} subtitle={t('darkModeDesc')} trailing={<AppToggle value={darkMode} onValueChange={setDarkMode} accessibilityLabel={t('darkMode')} />} />
        <SettingsRow title={t('chatWallpaperLabel')} subtitle={t('chatWallpaperDesc')} value={t(WALLPAPER_LABEL[chatWallpaper])} onPress={() => setSheet('wallpaper')} />
      </SettingsGroup>
      <SettingsGroup header={t('hdrText')}>
        <SettingsRow title={t('fontFamilyLabel')} value={FONT_OPTIONS[fontFamily].label} onPress={() => setSheet('font')} />
        <SettingsRow title={t('fontSizeLabel')} value={t(FONT_SIZE_LABEL[fontScale])} onPress={() => setSheet('size')} />
      </SettingsGroup>

      <SelectSheet visible={sheet === 'lang'} onClose={() => setSheet(null)} options={languageOptions} selectedId={language} title={t('language')} searchable={false} onSelect={(o) => onChangeLanguage(o.id as Language)} />
      <SelectSheet
        visible={sheet === 'font'}
        onClose={() => setSheet(null)}
        options={fontOptions}
        selectedId={fontFamily}
        title={t('fontFamilyLabel')}
        searchable={false}
        onSelect={(o) => {
          setFontFamily(o.id as FontKey);
          setSheet(null);
        }}
      />
      <SelectSheet
        visible={sheet === 'wallpaper'}
        onClose={() => setSheet(null)}
        options={wallpaperOptions}
        selectedId={chatWallpaper}
        title={t('chatWallpaperLabel')}
        searchable={false}
        onSelect={(o) => {
          setChatWallpaper(o.id as ChatWallpaperId);
          setSheet(null);
        }}
      />
      <SelectSheet
        visible={sheet === 'size'}
        onClose={() => setSheet(null)}
        options={sizeOptions}
        selectedId={fontScale}
        title={t('fontSizeLabel')}
        searchable={false}
        onSelect={(o) => {
          setFontScale(o.id as FontScaleKey);
          setSheet(null);
        }}
      />
    </>
  );
}
