import { describe, expect, it } from 'vitest';

import { editDistance, findNamesIn, matchName, normalizeName } from './match';

const parties = [
  { id: 'p1', name: 'Akram Traders' },
  { id: 'p2', name: 'Bilal Cement Depot' },
  { id: 'p3', name: 'Ahmed', alt: ['احمد'] },
];

describe('normalizeName', () => {
  it('lowercases, strips punctuation and collapses spaces', () => {
    expect(normalizeName('  Akram,  Traders! ')).toBe('akram traders');
  });
  it('removes Arabic diacritics', () => {
    expect(normalizeName('اَحمَد')).toBe('احمد');
  });
});

describe('editDistance', () => {
  it('counts edits', () => {
    expect(editDistance('cement', 'cemant')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
  });
});

describe('matchName', () => {
  it('prefers exact, then prefix, then substring', () => {
    expect(matchName('ahmed', parties)?.item.id).toBe('p3');
    expect(matchName('akram', parties)?.item.id).toBe('p1');
    expect(matchName('cement depot', parties)?.item.id).toBe('p2');
  });
  it('matches alternate (Urdu) spellings', () => {
    expect(matchName('احمد', parties)?.item.id).toBe('p3');
  });
  it('tolerates a small typo', () => {
    expect(matchName('ahmad', parties)?.item.id).toBe('p3');
  });
  it('rejects unrelated names', () => {
    expect(matchName('zubair', parties)).toBeNull();
    expect(matchName('', parties)).toBeNull();
  });
});

describe('findNamesIn', () => {
  const cats = [
    { id: 'c1', name: 'Cement', alt: ['سیمنٹ'] },
    { id: 'c2', name: 'Plot Payment' },
    { id: 'c3', name: 'Plot' },
  ];
  it('finds names inside a sentence, longest first, in order', () => {
    const hits = findNamesIn('50 bag cement liya, plot payment bhi', cats);
    expect(hits.map((h) => h.item.id)).toEqual(['c1', 'c2']);
  });
  it('does not match partial words', () => {
    expect(findNamesIn('cements are here', cats)).toHaveLength(0);
  });
  it('matches Urdu alternates', () => {
    expect(findNamesIn('آج سیمنٹ لیا', cats)[0]?.item.id).toBe('c1');
  });
});
