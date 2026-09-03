import * as Speech from 'expo-speech';

import type { Language } from '@/i18n/types';
import { swallow } from '@/utils/log';

/**
 * Read a sentence aloud with the phone's own text-to-speech (offline, free,
 * works in Expo Go). Picks an Urdu voice when the app is in Urdu and the
 * device has one installed; otherwise falls back to the system default.
 */

let voiceCache: Promise<Speech.Voice[]> | null = null;

async function voiceFor(language: Language): Promise<string | undefined> {
  voiceCache ??= Speech.getAvailableVoicesAsync().catch(() => [] as Speech.Voice[]);
  const voices = await voiceCache;
  const prefix = language === 'ur' ? 'ur' : 'en';
  // Prefer Pakistan-locale voices (ur-PK / en-PK), then any voice in the language.
  const exact = voices.find((v) => v.language?.toLowerCase().startsWith(`${prefix}-pk`));
  const any = voices.find((v) => v.language?.toLowerCase().startsWith(prefix));
  return (exact ?? any)?.identifier;
}

/** Speak `text`, interrupting anything still being read. */
export async function speak(text: string, language: Language): Promise<void> {
  if (!text.trim()) return;
  await Speech.stop().catch(swallow('speech:stop'));
  const voice = await voiceFor(language);
  Speech.speak(text, {
    language: language === 'ur' ? 'ur-PK' : 'en-US',
    voice,
    rate: 0.95,
  });
}

export function stopSpeaking(): void {
  void Speech.stop().catch(swallow('speech:stop'));
}
