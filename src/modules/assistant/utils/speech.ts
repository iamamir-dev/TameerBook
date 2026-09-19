import * as Speech from 'expo-speech';

import { dominantScript } from '@/ai';
import type { Language } from '@/i18n/types';
import { swallow } from '@/utils/log';

/**
 * Read a sentence aloud with the phone's own text-to-speech (offline, free,
 * works in Expo Go).
 *
 * The voice is chosen from the SCRIPT OF THE SENTENCE, not the app's language
 * setting: the assistant answers in Urdu script, Roman Urdu or English
 * depending on how the user wrote, and reading Urdu script with an English
 * voice (or Roman Urdu with an Urdu one) is what made this sound broken.
 *
 * Android phones in Pakistan often ship without an Urdu voice. Hindi is the
 * closest widely-installed alternative — it shares the phonology, so Urdu
 * script read by a Hindi voice is understandable, where an English voice is
 * not. Roman Urdu is Latin text, so an English voice reads it best.
 */

let voiceCache: Promise<Speech.Voice[]> | null = null;

/** Voices whose language tag starts with one of `prefixes`, best match first. */
async function pickVoice(prefixes: readonly string[]): Promise<Speech.Voice | undefined> {
  voiceCache ??= Speech.getAvailableVoicesAsync().catch(() => [] as Speech.Voice[]);
  const voices = await voiceCache;
  for (const prefix of prefixes) {
    const hit = voices.find((v) => v.language?.toLowerCase().replace('_', '-').startsWith(prefix));
    if (hit) return hit;
  }
  return undefined;
}

/** What to speak this sentence with: the ladder of voices and the fallback tag. */
export function voicePlanFor(text: string, appLanguage: Language): { prefixes: string[]; language: string; rate: number } {
  const script = dominantScript(text);
  // Urdu script (or an Urdu UI with nothing to go on) wants an Urdu voice.
  if (script === 'arabic' || (script === null && appLanguage === 'ur')) {
    return { prefixes: ['ur-pk', 'ur-in', 'ur', 'hi-in', 'hi'], language: 'ur-PK', rate: 0.92 };
  }
  return { prefixes: ['en-pk', 'en-in', 'en-gb', 'en'], language: 'en-US', rate: 0.98 };
}

/** Speak `text`, interrupting anything still being read. */
export async function speak(text: string, appLanguage: Language): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  await Speech.stop().catch(swallow('speech:stop'));
  const plan = voicePlanFor(clean, appLanguage);
  const voice = await pickVoice(plan.prefixes);
  Speech.speak(clean, {
    // An explicit voice wins; the language tag is the fallback for engines
    // that expose no voice list.
    language: voice?.language ?? plan.language,
    voice: voice?.identifier,
    rate: plan.rate,
  });
}

export function stopSpeaking(): void {
  void Speech.stop().catch(swallow('speech:stop'));
}
