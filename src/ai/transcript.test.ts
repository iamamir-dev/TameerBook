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
