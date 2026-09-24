import React from 'react';

import { SettingsGroup, SettingsRow } from '@/components/settings';
import { AppToggle } from '@/components/ui';
import { useTranslation, type TranslationKey } from '@/i18n';
import { useSettingsStore, type HomeSectionKey } from '@/stores/useSettingsStore';

/** Optional Home sections (the essentials always show); labels reuse the app's own terms. */
const ROWS: { key: HomeSectionKey; labelKey: TranslationKey }[] = [
  { key: 'plots', labelKey: 'plotsTitle' },
  { key: 'labor', labelKey: 'laborTitle' },
  { key: 'udhaar', labelKey: 'udhaar' },
];

export function HomeSection(): React.JSX.Element {
  const { t } = useTranslation();
  const homeSections = useSettingsStore((s) => s.homeSections);
  const setHomeSection = useSettingsStore((s) => s.setHomeSection);
  return (
    <SettingsGroup header={t('hdrSections')} footer={t('homeSectionDesc')}>
      {ROWS.map((r) => (
        <SettingsRow key={r.key} title={t(r.labelKey)} trailing={<AppToggle value={homeSections[r.key]} onValueChange={(v) => setHomeSection(r.key, v)} accessibilityLabel={t(r.labelKey)} />} />
      ))}
    </SettingsGroup>
  );
}
