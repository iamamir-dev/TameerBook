import { describe, expect, it } from 'vitest';

import { arabicShare, decideReplyLanguage, detectLanguage, dominantLanguage, dominantScript, languageDirective } from './language';

describe('detectLanguage', () => {
  it('sees Urdu script', () => {
    expect(detectLanguage('اس مہینے کتنا خرچ ہوا؟')).toEqual({ language: 'ur', strong: true });
  });
  it('treats Devanagari as Urdu (never answered in Hindi script)', () => {
    expect(detectLanguage('कितना खर्चा हुआ').language).toBe('ur');
  });
  it('sees Roman Urdu, including mixed sentences with English nouns', () => {
    expect(detectLanguage('is mahine kitna kharcha hua')).toEqual({ language: 'roman', strong: true });
    expect(detectLanguage('cash balance kitna hai')).toEqual({ language: 'roman', strong: true });
    expect(detectLanguage('Bilal ko 2000 diye')).toMatchObject({ language: 'roman' });
  });
  it('sees English', () => {
    expect(detectLanguage('How much cash do I have?')).toEqual({ language: 'en', strong: true });
    expect(detectLanguage('Which workers still need to be paid?')).toMatchObject({ language: 'en', strong: true });
  });
  it('has no opinion on names and numbers', () => {
    expect(detectLanguage('Akram Traders 50000')).toEqual({ language: null, strong: false });
    expect(detectLanguage('')).toEqual({ language: null, strong: false });
  });
  it('is only weakly sure about a single English word', () => {
    expect(detectLanguage('show balance')).toEqual({ language: 'en', strong: false });
  });
  it('reads Roman Urdu built around English ledger nouns', () => {
    // These sentences are Roman Urdu; the nouns just happen to be English.
    expect(detectLanguage('kon se orders abhi tak deliver nahi hue').language).toBe('roman');
    expect(detectLanguage('Abhi 1 pending order hai, sab pending delivery').language).toBe('roman');
    expect(detectLanguage('cash balance kitna hai').language).toBe('roman');
  });
});

describe('decideReplyLanguage', () => {
  it('honours the explicit setting first', () => {
    expect(decideReplyLanguage({ text: 'how much cash', setting: 'ur', appLanguage: 'en' })).toBe('ur');
  });
  it('follows strong evidence in the message', () => {
    expect(decideReplyLanguage({ text: 'is mahine kitna kharcha hua', setting: 'auto', appLanguage: 'en' })).toBe('roman');
    expect(decideReplyLanguage({ text: 'How much did I spend this month?', setting: 'auto', appLanguage: 'ur' })).toBe('en');
  });
  it('defers weak evidence to what the user usually writes', () => {
    expect(decideReplyLanguage({ text: 'Bilal balance', setting: 'auto', appLanguage: 'en', recent: ['roman', 'roman', 'en'] })).toBe('roman');
  });
  it('falls back to the app language, Urdu UI → Urdu script', () => {
    expect(decideReplyLanguage({ text: 'Akram 5000', setting: 'auto', appLanguage: 'ur' })).toBe('ur');
    expect(decideReplyLanguage({ text: 'Akram 5000', setting: 'auto', appLanguage: 'en' })).toBe('en');
  });
});

describe('script grading of replies', () => {
  it('counts an Urdu reply as Urdu even when it carries Latin names and amounts', () => {
    expect(dominantScript('Bilal کو **Rs 2,000** Cash in Hand سے دیے جا رہے ہیں۔')).toBe('arabic');
  });
  it('counts a Roman Urdu reply that quotes one Urdu word as Latin', () => {
    expect(dominantScript('Bilal ko Rs 2,000 cash de rahe hain, note: بلال')).toBe('latin');
  });
  it('is empty-safe', () => {
    expect(dominantScript('2,000 · 50')).toBeNull();
    expect(arabicShare('')).toBe(0);
  });
});

describe('dominantLanguage / directive', () => {
  it('needs at least two samples', () => {
    expect(dominantLanguage(['ur'])).toBeNull();
    expect(dominantLanguage(['ur', 'roman', 'ur'])).toBe('ur');
  });
  it('bans Devanagari in every directive', () => {
    for (const l of ['ur', 'roman', 'en'] as const) expect(languageDirective(l).length).toBeGreaterThan(20);
    expect(languageDirective('ur')).toContain('Devanagari');
  });
});
