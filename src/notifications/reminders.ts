import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getDatabase, listSupplierPayables, listTransferDeadlines } from '@/db';
import { t } from '@/i18n';
import type { ReminderPrefs } from '@/stores/useSettingsStore';

const DAY_MS = 86_400_000;
let handlerSet = false;

/** Show banners while the app is foregrounded (set once). */
export function initNotificationHandler(): void {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/**
 * Cancel and re-schedule all local reminders from the user's prefs + current
 * data. All notifications are LOCAL (Expo Go compatible). Safe to call on
 * launch and whenever a toggle changes.
 *
 * Note: the daily reminder fires every evening; the "only if no entry today"
 * nuance can't be enforced by a static local schedule without a background
 * task (unavailable in Expo Go), so it's a plain daily nudge.
 */
export async function rescheduleReminders(prefs: ReminderPrefs): Promise<void> {
  initNotificationHandler();
  const granted = await ensurePermission();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!granted) return;

  if (prefs.daily) {
    await Notifications.scheduleNotificationAsync({
      content: { title: t('notifDailyTitle'), body: t('notifDailyBody') },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 20, minute: 0 },
    });
  }

  if (prefs.deadline) {
    const deadlines = await listTransferDeadlines();
    for (const d of deadlines) {
      for (const lead of [7, 2]) {
        const when = new Date(new Date(d.deadline).getTime() - lead * DAY_MS);
        when.setHours(9, 0, 0, 0);
        if (when.getTime() > Date.now()) {
          await Notifications.scheduleNotificationAsync({
            content: { title: t('notifDeadlineTitle'), body: `${d.projectName} — ${t('notifDeadlineBody')}` },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
          });
        }
      }
    }
  }

  if (prefs.udhaar) {
    const payables = await listSupplierPayables();
    if (payables.some((p) => p.payable > 0)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: t('notifUdhaarTitle'), body: t('notifUdhaarBody') },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 6, hour: 20, minute: 0 },
      });
    }
  }

  if (prefs.buyer) {
    const db = await getDatabase();
    const sales = await db.getAllAsync<{ outstanding: number }>(
      `SELECT (s.agreed_price - COALESCE((SELECT SUM(amount) FROM sale_receipts sr WHERE sr.sale_id = s.id), 0)) AS outstanding FROM sales s`
    );
    if (sales.some((s) => s.outstanding > 0)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: t('notifBuyerTitle'), body: t('notifBuyerBody') },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour: 20, minute: 0 },
      });
    }
  }
}
