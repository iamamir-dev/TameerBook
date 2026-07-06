import { create } from 'zustand';

import { loadSettings, saveSetting } from '@/db/repositories/settings';
import type { Language } from '@/i18n/types';

/**
 * App-wide user preferences. Both the theme (light/dark), language, and the
 * default investor profit-share % read from here, so a single change re-themes
 * / re-translates / re-prices the whole app.
 *
 * Persistence: values are mirrored into the `app_settings` table. Call
 * `hydrate()` once on launch (after the DB is ready) to load saved values;
 * every setter writes back so preferences survive relaunches.
 */
/** Which local reminders are enabled (all on by default). */
export interface ReminderPrefs {
  daily: boolean;
  deadline: boolean;
  udhaar: boolean;
  buyer: boolean;
}

export type ReminderKey = keyof ReminderPrefs;

/** Default investor profit share when none is set (Musharakah split). */
export const DEFAULT_INVESTOR_PROFIT_PCT = 50;

interface SettingsState {
  language: Language;
  darkMode: boolean;
  reminders: ReminderPrefs;
  /** Default % of profit given to investors (loss is always by capital ratio). */
  investorProfitPct: number;
  hydrate: () => Promise<void>;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  setDarkMode: (darkMode: boolean) => void;
  toggleDarkMode: () => void;
  setReminder: (key: ReminderKey, value: boolean) => void;
  setInvestorProfitPct: (pct: number) => void;
}

const clampPct = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'en', // English is the default; users can switch to Roman Urdu in Settings.
  darkMode: false, // Light mode is the default per the design spec.
  reminders: { daily: true, deadline: true, udhaar: true, buyer: true },
  investorProfitPct: DEFAULT_INVESTOR_PROFIT_PCT,

  hydrate: async () => {
    try {
      const s = await loadSettings();
      const patch: Partial<SettingsState> = {};
      if (s.language === 'en' || s.language === 'ur') patch.language = s.language;
      if (s.darkMode != null) patch.darkMode = s.darkMode === '1';
      if (s.reminders) {
        try {
          patch.reminders = { ...get().reminders, ...JSON.parse(s.reminders) };
        } catch {
          /* ignore malformed */
        }
      }
      if (s.investorProfitPct != null) patch.investorProfitPct = clampPct(Number(s.investorProfitPct));
      if (Object.keys(patch).length) set(patch);
    } catch {
      /* first launch / table missing — keep defaults */
    }
  },

  setLanguage: (language) => {
    set({ language });
    void saveSetting('language', language);
  },
  toggleLanguage: () => {
    const language = get().language === 'ur' ? 'en' : 'ur';
    set({ language });
    void saveSetting('language', language);
  },
  setDarkMode: (darkMode) => {
    set({ darkMode });
    void saveSetting('darkMode', darkMode ? '1' : '0');
  },
  toggleDarkMode: () => {
    const darkMode = !get().darkMode;
    set({ darkMode });
    void saveSetting('darkMode', darkMode ? '1' : '0');
  },
  setReminder: (key, value) => {
    const reminders = { ...get().reminders, [key]: value };
    set({ reminders });
    void saveSetting('reminders', JSON.stringify(reminders));
  },
  setInvestorProfitPct: (pct) => {
    const investorProfitPct = clampPct(pct);
    set({ investorProfitPct });
    void saveSetting('investorProfitPct', String(investorProfitPct));
  },
}));
