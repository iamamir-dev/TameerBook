import { useSettingsStore } from '@/stores/useSettingsStore';

import { en } from './en';
import type { Language, TranslationKeys } from './types';
import { ur } from './ur';

export type { Language, TranslationKeys } from './types';
export type TranslationKey = keyof TranslationKeys;

/** All dictionaries, keyed by language code. */
export const dictionaries: Record<Language, TranslationKeys> = { en, ur };

/**
 * Translate a key for a specific language. Pure — no React, no store. Useful
 * for one-off lookups (e.g. building a list of options).
 */
export const translate = (language: Language, key: TranslationKey): string =>
  dictionaries[language][key];

/**
 * Non-reactive translator that reads the CURRENT language from the store.
 * Use inside event handlers / utilities where hooks aren't available.
 * Inside components prefer `useTranslation()` so the UI re-renders on change.
 */
export const t = (key: TranslationKey): string =>
  translate(useSettingsStore.getState().language, key);

/**
 * Hook returning a reactive `t()` bound to the active language plus the
 * current language code. Components re-render automatically when the user
 * switches language in Settings.
 */
export const useTranslation = (): {
  t: (key: TranslationKey) => string;
  language: Language;
} => {
  const language = useSettingsStore((state) => state.language);
  return {
    language,
    t: (key: TranslationKey) => translate(language, key),
  };
};
