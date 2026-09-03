import { describe, expect, it } from 'vitest';

import { isWhisperNoise } from './transcript';

describe('isWhisperNoise', () => {
  it('drops Whisper silence fillers', () => {
    for (const s of ["I don't know.", 'Thank you.', 'Thanks for watching!', 'you', 'Subtitles by the Amara.org community', '', '  ', 'ok']) {
      expect(isWhisperNoise(s)).toBe(true);
    }
  });
  it('keeps real speech', () => {
    for (const s of ['aaj 50 bori cement liya', 'کتنا خرچ ہوا', 'Cash balance?', 'Bilal ko 2000 diye']) {
      expect(isWhisperNoise(s)).toBe(false);
    }
  });
});

describe('isWhisperNoise prompt echo', () => {
  const prompt = 'TameerBook, kharcha, aamdani, dihari, udhaar, bori, cement, sariya, bajri, lakh, hazar. Akram Traders, Ustad Bilal';
  it('rejects a transcript that is the vocabulary hint read back', () => {
    expect(isWhisperNoise('TameerBook, kharcha, aamdani, dihari, udhaar, bori, cement, sariya', prompt)).toBe(true);
    expect(isWhisperNoise('Akram Traders Ustad Bilal cement bori', prompt)).toBe(true);
  });
  it('keeps real speech that merely uses a few hint words', () => {
    expect(isWhisperNoise('Akram Traders ko 5000 diye cement ke liye Meezan se aaj', prompt)).toBe(false);
  });
});
