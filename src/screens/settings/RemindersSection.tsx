import React from 'react';

import { SettingsGroup, SettingsRow } from '@/components/settings';
import { AppToggle } from '@/components/ui';
import { useTranslation, type TranslationKey } from '@/i18n';
import { rescheduleReminders } from '@/notifications/reminders';
import { useSettingsStore, type ReminderKey } from '@/stores/useSettingsStore';
import { swallow } from '@/utils/log';

const ROWS: { key: ReminderKey; labelKey: TranslationKey; descKey: TranslationKey }[] = [
  { key: 'daily', labelKey: 'remDaily', descKey: 'remDailyDesc' },
  { key: 'deadline', labelKey: 'remDeadline', descKey: 'remDeadlineDesc' },
  { key: 'udhaar', labelKey: 'remUdhaar', descKey: 'remUdhaarDesc' },
  { key: 'buyer', labelKey: 'remBuyer', descKey: 'remBuyerDesc' },
];

/** Local notification reminders, each with a line saying when it fires. */
export function RemindersSection(): React.JSX.Element {
  const { t } = useTranslation();
  const reminders = useSettingsStore((s) => s.reminders);
  const setReminder = useSettingsStore((s) => s.setReminder);
  const onToggle = (key: ReminderKey, value: boolean) => {
    setReminder(key, value);
    rescheduleReminders({ ...reminders, [key]: value }).catch(swallow('settings:rescheduleReminders'));
  };
  return (
    <SettingsGroup header={t('hdrAlerts')}>
      {ROWS.map((r) => (
        <SettingsRow key={r.key} title={t(r.labelKey)} subtitle={t(r.descKey)} trailing={<AppToggle value={reminders[r.key]} onValueChange={(v) => onToggle(r.key, v)} accessibilityLabel={t(r.labelKey)} />} />
      ))}
    </SettingsGroup>
  );
}
