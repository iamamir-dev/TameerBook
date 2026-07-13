import { I18nManager } from 'react-native';

import type { Language } from '@/i18n/types';

import { reportError } from './log';

/** Urdu is right-to-left; English is left-to-right. */
export function isRTLLanguage(lang: Language): boolean {
  return lang === 'ur';
}

/**
 * Align the native layout direction with the language. RTL is a NATIVE flag
 * (`I18nManager`) that only takes visual effect after a reload, and it PERSISTS
 * across launches — so this returns whether a reload is needed to apply a
 * change the user just made.
 */
export function syncLayoutDirection(lang: Language): boolean {
  const wantRTL = isRTLLanguage(lang);
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== wantRTL) {
    I18nManager.forceRTL(wantRTL);
    return true;
  }
  return false;
}

/**
 * Reload the JS bundle so a just-applied RTL/LTR flip renders. Uses
 * expo-updates (works in Expo Go and standalone); falls back to the dev
 * reloader. If neither is available the change still applies on next launch.
 */
export async function reloadApp(): Promise<void> {
  try {
    const Updates = await import('expo-updates');
    await Updates.reloadAsync();
    return;
  } catch (e) {
    reportError('rtl:reload', e);
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DevSettings } = require('react-native') as { DevSettings?: { reload?: () => void } };
    DevSettings?.reload?.();
  } catch {
    /* last resort: the flag is set; it applies on the next app launch */
  }
}
