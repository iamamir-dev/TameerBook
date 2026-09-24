import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';

import { SettingsPage } from '@/components/settings';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList, SettingsSectionId } from '@/navigation/types';

import { AboutSection } from './AboutSection';
import { AssistantSection } from './AssistantSection';
import { CompanySection } from './CompanySection';
import { DocumentsSection } from './DocumentsSection';
import { HomeSection } from './HomeSection';
import { MoneySection } from './MoneySection';
import { PreferencesSection } from './PreferencesSection';
import { RemindersSection } from './RemindersSection';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'SettingsSection'>;

export const SECTION_TITLE: Record<SettingsSectionId, TranslationKey> = {
  company: 'companyTitle',
  preferences: 'preferencesSection',
  assistant: 'aiSectionTitle',
  reminders: 'reminders',
  home: 'homeSettingsTitle',
  money: 'donationPctLabel',
  documents: 'signaturesTitle',
  about: 'appVersion',
};

const SECTION: Record<SettingsSectionId, () => React.JSX.Element> = {
  company: CompanySection,
  preferences: PreferencesSection,
  assistant: AssistantSection,
  reminders: RemindersSection,
  home: HomeSection,
  money: MoneySection,
  documents: DocumentsSection,
  about: AboutSection,
};

/** One settings area on its own page, reached from the Settings hub. */
export function SettingsSectionScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const Body = SECTION[params.section];
  return (
    <SettingsPage title={t(SECTION_TITLE[params.section])} onBack={() => navigation.goBack()}>
      <Body />
    </SettingsPage>
  );
}
