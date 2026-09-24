import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SettingsGroup, SettingsPage, SettingsRow } from '@/components/settings';
import { AppText, Avatar, type IconKey } from '@/components/ui';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList, SettingsSectionId } from '@/navigation/types';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface HubRow {
  section: SettingsSectionId;
  icon: IconKey;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
}

const ROWS: HubRow[] = [
  { section: 'company', icon: 'projects', titleKey: 'companyTitle', subtitleKey: 'settingsCompanySub' },
  { section: 'preferences', icon: 'language', titleKey: 'preferencesSection', subtitleKey: 'settingsPrefsSub' },
  { section: 'assistant', icon: 'assistant', titleKey: 'aiSectionTitle', subtitleKey: 'settingsAiSub' },
  { section: 'reminders', icon: 'bell', titleKey: 'reminders', subtitleKey: 'settingsRemindersSub' },
  { section: 'home', icon: 'home', titleKey: 'homeSettingsTitle', subtitleKey: 'settingsHomeSub' },
  { section: 'money', icon: 'investor', titleKey: 'donationPctLabel', subtitleKey: 'settingsMoneySub' },
  { section: 'documents', icon: 'agreement', titleKey: 'signaturesTitle', subtitleKey: 'settingsDocsSub' },
  { section: 'about', icon: 'info', titleKey: 'appVersion', subtitleKey: 'settingsAboutSub' },
];

/**
 * The Settings hub, laid out like a messaging app's settings page: the
 * company at the top (tap to edit), then one row per area with a one-line
 * description, each opening its own page.
 */
export function SettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);
  const companies = useCompanyStore((st) => st.companies);
  const activeCompanyId = useCompanyStore((st) => st.activeCompanyId);
  const company = companies.find((c) => c.id === activeCompanyId) ?? null;

  const go = (section: SettingsSectionId) => () => navigation.navigate('SettingsSection', { section });

  return (
    <SettingsPage title={t('settings')} onBack={() => navigation.goBack()}>
      <Pressable onPress={() => navigation.navigate('CompanyDetail')} accessibilityRole="button" style={({ pressed }) => [styles.profile, pressed && styles.pressed]}>
        <Avatar uri={company?.logo_uri ?? null} name={company?.name ?? 'T'} size={88} />
        <AppText size="xl" weight="bold" center>
          {company?.name ?? t('companyTitle')}
        </AppText>
        <AppText size="sm" color="textSecondary" center>
          {company?.owner_name ?? t('companyNameHint')}
        </AppText>
      </Pressable>

      <SettingsGroup>
        {ROWS.map((r) => (
          <SettingsRow key={r.section} icon={r.icon} title={t(r.titleKey)} subtitle={t(r.subtitleKey)} onPress={go(r.section)} />
        ))}
      </SettingsGroup>
      <View style={styles.spacer} />
    </SettingsPage>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    profile: { alignItems: 'center', gap: theme.spacing.xs, paddingVertical: theme.spacing.lg },
    pressed: { opacity: 0.7 },
    spacer: { height: theme.spacing.lg },
  });
