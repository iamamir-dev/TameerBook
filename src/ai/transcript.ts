import { normalizeName } from './match';

/**
 * Whisper hallucinates stock phrases on silence or very short clips ("I don't
 * know.", "Thank you.", "Subtitles by…"). Treat those as no speech, so a tap
 * on the mic never turns into a bogus question. Pure + unit-tested.
 */
const NOISE = new Set(
  [
    'i dont know',
    'i do not know',
    'thank you',
    'thanks',
    'thank you for watching',
    'thanks for watching',
    'you',
    'bye',
    'okay',
    'ok',
    'hmm',
    'mm',
    'uh',
    'um',
    'so',
    'the',
    'please subscribe',
    'subtitles by the amara org community',
    'شکریہ',
    'ٹھیک ہے',
  ].map(normalizeName)
);

/** Shortest clip we send: below this a mic tap was almost certainly accidental. */
export const MIN_RECORDING_MS = 600;

/** True when a transcript is empty or one of Whisper's silence fillers. */
export function isWhisperNoise(text: string): boolean {
  const n = normalizeName(text.replace(/['’]/g, '')).replace(/^(subtitles by).*$/, 'subtitles by the amara org community');
  if (!n) return true;
  if (NOISE.has(n)) return true;
  // Very short single-token output on a short clip is noise too.
  return n.length <= 2;
}
