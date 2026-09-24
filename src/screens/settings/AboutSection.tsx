import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';

import { SettingsGroup, SettingsRow } from '@/components/settings';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const APP_VERSION: string = (require('../../../app.json') as { expo: { version: string } }).expo.version;

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Version; a long press on it opens the developer tools. */
export function AboutSection(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  return (
    <SettingsGroup>
      <SettingsRow title={t('appVersion')} subtitle={t('devToolsHint')} value={`v${APP_VERSION}`} onLongPress={() => navigation.navigate('DevTools')} accessibilityHint={t('devToolsHint')} />
    </SettingsGroup>
  );
}
