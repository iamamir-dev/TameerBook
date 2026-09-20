import type { Language } from '@/i18n/types';

/**
 * REPLY LANGUAGE — decided in code, not by the model. A Pakistani builder
 * writes Urdu script, Roman Urdu (Urdu in Latin letters) or English, often
 * mixed in one sentence. Leaving the choice to the model made it flip between
 * turns; here the app detects the user's language, applies the user's setting
 * and what it learned, and hands the model ONE directive. Pure + unit-tested.
 */

export type ReplyLanguage = 'ur' | 'roman' | 'en';
/** The Settings choice: `auto` = follow the user's words. */
export const REPLY_LANGUAGE_SETTINGS = ['auto', 'ur', 'roman', 'en'] as const;
export type ReplyLanguageSetting = (typeof REPLY_LANGUAGE_SETTINGS)[number];

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿ]/g;
const DEVANAGARI = /[ऀ-ॿ]/;

/**
 * High-frequency Roman Urdu words. Only words that are NOT also common English
 * words (so "is", "do", "to", "main", "us", "the" are deliberately absent).
 */
const ROMAN_URDU = new Set(
  (
    'hai hain ka ki ke ko se mein mai kitna kitni kitne kya kyun kyon kaise kab kahan kaun kon konsa konse kis kisko kisne ' +
    'karo karna karein karen kar kiya kiye karwao karega karegi karenge karta karti karte ' +
    'diya diye dedo dena denge dunga doonga do liya liye lena lunga lo le ' +
    'aaj kal parso nahi nahin haan ji batao bata batana dikhao dikha dikhana ' +
    'wala wale wali aur ya pe par tha thi hua hui hue gaya gayi gaye raha rahi rahe ' +
    'mera meri mere tum aap hum humara humari hamara woh yeh ye wo unko usko inko iska uska unka jo jab agar magar lekin ' +
    'sab kuch bhi sirf abhi phir bas chalo dekho dekhna chahiye chahye chahta chahti chahte zaroorat zarurat ' +
    'paise paisa rupay rupaye rupey lakh laakh hazar hazaar crore karod ' +
    'banao bana banana likho likh hazri haazri dihari dehari mazdoor kharcha kharch aamdani udhaar udhar baqaya baki baqi ' +
    'kaam ghar saman samaan aaya aayi aaye mila mile mili bech becha bechna khareed kharida kharidna tak sath saath wapas ' +
    'pichle pichla pichli agla agli mahine mahina mahiney hafte hafta din saal subah sham raat ' +
    'theek thik acha accha achha bilkul zyada ziada kam poora pura aadha adha chutti hazir ghaib ' +
    'mujhe mujh humein hona hoga hogi honge samajh pata maloom malum shukriya shukria salam assalam walaikum kaisa kaisi kaisay ' +
    'abhi tak kitnay kitnay itna itni itne wahan yahan idhar udhar jaldi der pehle baad andar bahar upar neeche'
  ).split(/\s+/)
);

/**
 * Strong English signal: function words and verbs a Roman Urdu speaker would
 * NOT reach for. Ledger nouns are deliberately absent — "cash balance kitna
 * hai" and "pending order hai" are Roman Urdu sentences with English nouns in
 * them, and counting those nouns as English made the detector call them
 * English.
 */
const ENGLISH = new Set(
  (
    'the a an is are was were be been am how much many what which who whom whose show tell give get see find ' +
    'me my mine we our you your they their he she it this that these those there here ' +
    'did do does done need want wish please can could would should must may might will shall ' +
    'about for from with without and or but so then than because if when where why while during until ' +
    'have has had of in on at by to into over under again very just only also more most less least ' +
    'today yesterday tomorrow month months week weeks day days year years ' +
    'spent spend spending paid pay pays owe owes owed bought buy sold sell make made take took keep kept ' +
    'add new create open close mark check list still left last next each every some any none ' +
    'yes no not ok okay thanks thank hello hi hey good great sure sorry'
  ).split(/\s+/)
);

export interface LanguageGuess {
  language: ReplyLanguage | null;
  /** True when the evidence is unambiguous (script, or 2+ vocabulary hits on the winning side). */
  strong: boolean;
}

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

/** What language the user wrote in. `null` = no evidence (numbers, names only). */
export function detectLanguage(text: string): LanguageGuess {
  const t = text ?? '';
  const arabic = (t.match(ARABIC_SCRIPT) ?? []).length;
  if (arabic >= 2 || (arabic >= 1 && t.trim().length <= 3)) return { language: 'ur', strong: true };
  if (DEVANAGARI.test(t)) return { language: 'ur', strong: true };
  const ws = words(t);
  if (ws.length === 0) return { language: null, strong: false };
  let roman = 0;
  let en = 0;
  for (const w of ws) {
    if (ROMAN_URDU.has(w)) roman++;
    else if (ENGLISH.has(w)) en++;
  }
  // Roman Urdu wins ties: mixed sentences ("cash balance kitna hai") are Roman Urdu with English nouns.
  if (roman > 0 && roman >= en) return { language: 'roman', strong: roman >= 2 || (roman === 1 && en === 0 && ws.length <= 3) };
  if (en > 0) return { language: 'en', strong: en >= 2 };
  return { language: null, strong: false };
}

export interface ReplyLanguageInput {
  text: string;
  /** Settings → Assistant → Reply language. */
  setting: ReplyLanguageSetting;
  /** The app's UI language: the fallback when nothing else decides. */
  appLanguage: Language;
  /** Language the user has been writing in recently (newest last), from memory. */
  recent?: readonly ReplyLanguage[];
}

/** The mode of the recent languages, or null when there is too little data. */
export function dominantLanguage(recent: readonly ReplyLanguage[] | undefined, min = 2): ReplyLanguage | null {
  if (!recent || recent.length < min) return null;
  const counts = new Map<ReplyLanguage, number>();
  for (const l of recent) counts.set(l, (counts.get(l) ?? 0) + 1);
  let best: ReplyLanguage | null = null;
  let n = 0;
  for (const [l, c] of counts) {
    if (c > n) {
      best = l;
      n = c;
    }
  }
  return best;
}

/**
 * Which language THIS reply should be in:
 *   1. an explicit Settings choice always wins;
 *   2. strong evidence in the message (script, 2+ words) decides;
 *   3. weak evidence defers to what the user usually writes;
 *   4. otherwise the app's UI language (Urdu UI → Urdu script).
 */
export function decideReplyLanguage(input: ReplyLanguageInput): ReplyLanguage {
  if (input.setting !== 'auto') return input.setting;
  const guess = detectLanguage(input.text);
  if (guess.language && guess.strong) return guess.language;
  const usual = dominantLanguage(input.recent);
  if (usual) return usual;
  if (guess.language) return guess.language;
  return input.appLanguage === 'ur' ? 'ur' : 'en';
}

/**
 * The language rules for one reply. These ride only with the language they
 * apply to, so an English turn never pays for the Urdu spelling list.
 *
 * Register: Microsoft's Urdu style guide marks the -iye / -ijiye endings
 * (bataiye, kijiye) as the over-formal "classic" form and -ein (batayein,
 * karein) as the modern respectful one; batao / karo / do are tum forms, which
 * address a business owner like an employee. So: aap + -ein.
 *
 * Roman Urdu has no standard spelling at all, so one convention is pinned
 * here: users read every variant fine, but an assistant that writes "nahi" and
 * "nahin" in one breath looks careless.
 */
export function languageDirective(lang: ReplyLanguage): string {
  switch (lang) {
    case 'ur':
      return [
        'Reply in simple spoken Urdu, Urdu script (اردو).',
        'Address the user as آپ and use the modern -ein verb endings (بتائیں، کریں، دیں); never تم/تو forms (بتاؤ، کرو) and never the stiff -ijiye forms (بتائیے، فرمائیے).',
        'Offer to do something yourself with کیا میں ... دوں؟',
        'Urdu puts the verb last and the question word (کون سا، کتنا، کس) immediately BEFORE the verb: "یہ خرچہ کس پروجیکٹ کا ہے؟", never English word order.',
        'Everyday English words Pakistanis already use stay English in the Urdu sentence: project, site, plot, cash, rate, bill, total, supplier, account, balance.',
        'Amounts and names stay as they are ("Rs 5,000"). Never Hindi or Devanagari, never Roman Urdu.',
      ].join(' ');
    case 'roman':
      return [
        'Reply in Roman Urdu: Urdu in Latin letters, the way it is spoken.',
        'Address the user as aap and use -ein endings (batayein, karein, dein); never batao / karo / do, which sound like talking to an employee.',
        'Offer to do something yourself with "Kya main ... kar doon?".',
        'Keep the question word just before the verb: "Yeh kharcha kis project ka hai?".',
        'Spell these one way, always: aap, hai, hain, tha, thi, nahi, kya, kaun sa, kitna, kis, kahan, karein, batayein, dein, doon, main, abhi, raqam, kharcha, theek hai.',
        'No final -n on nasals (nahi, mein, hoon), "ai" not "ay" (hai, kaise), "kya" for what and "kiya" only for did, and English words keep their English spelling (project, site, cash, rate, supplier).',
        'Never Urdu script, never Devanagari.',
      ].join(' ');
    default:
      return 'Reply in simple, plain English, the way a good bookkeeper speaks. Keep the user\'s own words for things (dihari, hazri, udhaar, bori) when they used them.';
  }
}

/**
 * How much of a reply is written in Arabic script, 0..1, counting letters.
 * Share rather than majority, because a correct Urdu reply still carries
 * Latin proper nouns ("Bilal", "Cash in Hand", "PO-0016", "Rs 2,000") and a
 * correct Roman Urdu reply may quote an Urdu word or two.
 */
export function arabicShare(text: string): number {
  const arabic = (text.match(/[\u0600-\u06FF\u0750-\u077F]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const total = arabic + latin;
  return total === 0 ? 0 : arabic / total;
}

/** Text written mostly in Arabic script (Urdu), in Latin letters, or neither. */
export function dominantScript(text: string): 'arabic' | 'latin' | null {
  const arabic = (text.match(/[\u0600-\u06FF\u0750-\u077F]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (arabic === 0 && latin === 0) return null;
  return arabicShare(text) >= 0.3 ? 'arabic' : 'latin';
}

/** Marker chips (OPTIONS / SUGGEST) must be in the reply language too; this is the phrase for the prompt. */
export function languageName(lang: ReplyLanguage): string {
  return lang === 'ur' ? 'Urdu script' : lang === 'roman' ? 'Roman Urdu' : 'English';
}
