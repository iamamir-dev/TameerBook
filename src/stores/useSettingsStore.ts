import { create } from 'zustand';

import { loadSettings, saveSetting } from '@/db/repositories/settings';
import type { Language } from '@/i18n/types';
import { FONT_OPTIONS, FONT_SCALES, type FontKey, type FontScaleKey } from '@/theme/theme';
import { swallow } from '@/utils/log';

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

/** Default charity/donation % of each party's profit (shariah, agreed upfront). */
export const DEFAULT_DONATION_PCT = 0;

/**
 * The OPTIONAL Home sections a user can show/hide (Settings → Home screen).
 * The essentials — total assets, accounts, shortcuts, projects — are the
 * dashboard and always show; only the extras are configurable. Defaults
 * mirror today's Home: activity on, the rest off until switched on.
 */
export interface HomeSectionPrefs {
  activity: boolean;
  plots: boolean;
  labor: boolean;
  udhaar: boolean;
}

export type HomeSectionKey = keyof HomeSectionPrefs;

export const DEFAULT_HOME_SECTIONS: HomeSectionPrefs = {
  activity: true,
  plots: false,
  labor: false,
  udhaar: false,
};

/**
 * The order of the Quick Entry tiles, as an array of their labelKeys. The
 * user can reorder them; a saved order is merged with the current tile set so
 * newly-added tiles still appear (appended) and removed ones are dropped.
 */
export const DEFAULT_QUICK_ORDER = [
  'kharcha',
  'aamdani',
  'material',
  'booking',
  'transferTitleV2',
  'udhaar',
  'investor',
  'dehari',
  'gharKharcha',
] as const;

interface SettingsState {
  language: Language;
  darkMode: boolean;
  /** App-wide font family (theme recomposes on change). */
  fontFamily: FontKey;
  /** App-wide text-size step (multiplies every size token). */
  fontScale: FontScaleKey;
  /** Which Home sections are visible. */
  homeSections: HomeSectionPrefs;
  /** User's Quick Entry tile order (labelKeys). */
  quickOrder: string[];
  reminders: ReminderPrefs;
  /** Default % of profit given to investors (loss is always by capital ratio). */
  investorProfitPct: number;
  /** % of each party's profit donated to charity at settlement. */
  donationPct: number;
  hydrate: () => Promise<void>;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  setDarkMode: (darkMode: boolean) => void;
  toggleDarkMode: () => void;
  setFontFamily: (fontFamily: FontKey) => void;
  setFontScale: (fontScale: FontScaleKey) => void;
  setHomeSection: (key: HomeSectionKey, value: boolean) => void;
  setQuickOrder: (order: string[]) => void;
  setReminder: (key: ReminderKey, value: boolean) => void;
  setInvestorProfitPct: (pct: number) => void;
  setDonationPct: (pct: number) => void;
}

const clampPct = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/** Mirror a preference to the DB; a failed write is logged, never unhandled. */
const persist = (key: string, value: string): void => {
  void saveSetting(key, value).catch(swallow('settings:persist'));
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'en', // English is the default; users can switch to Roman Urdu in Settings.
  darkMode: false, // Light mode is the default per the design spec.
  fontFamily: 'rounded',
  fontScale: 'normal',
  homeSections: DEFAULT_HOME_SECTIONS,
  quickOrder: [...DEFAULT_QUICK_ORDER],
  reminders: { daily: true, deadline: true, udhaar: true, buyer: true },
  investorProfitPct: DEFAULT_INVESTOR_PROFIT_PCT,
  donationPct: DEFAULT_DONATION_PCT,

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
      if (s.donationPct != null) patch.donationPct = clampPct(Number(s.donationPct));
      if (s.fontFamily && s.fontFamily in FONT_OPTIONS) patch.fontFamily = s.fontFamily as FontKey;
      if (s.fontScale && s.fontScale in FONT_SCALES) patch.fontScale = s.fontScale as FontScaleKey;
      if (s.homeSections) {
        try {
          patch.homeSections = { ...DEFAULT_HOME_SECTIONS, ...JSON.parse(s.homeSections) };
        } catch {
          /* ignore malformed */
        }
      }
      if (s.quickOrder) {
        try {
          const saved = JSON.parse(s.quickOrder) as string[];
          // Keep only still-valid tiles, then append any new tiles not saved.
          const valid = saved.filter((k) => (DEFAULT_QUICK_ORDER as readonly string[]).includes(k));
          const merged = [...valid, ...DEFAULT_QUICK_ORDER.filter((k) => !valid.includes(k))];
          patch.quickOrder = merged;
        } catch {
          /* ignore malformed */
        }
      }
      if (Object.keys(patch).length) set(patch);
    } catch {
      /* first launch / table missing  keep defaults */
    }
  },

  setLanguage: (language) => {
    set({ language });
    persist('language', language);
  },
  toggleLanguage: () => {
    const language = get().language === 'ur' ? 'en' : 'ur';
    set({ language });
    persist('language', language);
  },
  setDarkMode: (darkMode) => {
    set({ darkMode });
    persist('darkMode', darkMode ? '1' : '0');
  },
  toggleDarkMode: () => {
    const darkMode = !get().darkMode;
    set({ darkMode });
    persist('darkMode', darkMode ? '1' : '0');
  },
  setFontFamily: (fontFamily) => {
    set({ fontFamily });
    persist('fontFamily', fontFamily);
  },
  setFontScale: (fontScale) => {
    set({ fontScale });
    persist('fontScale', fontScale);
  },
  setHomeSection: (key, value) => {
    const homeSections = { ...get().homeSections, [key]: value };
    set({ homeSections });
    persist('homeSections', JSON.stringify(homeSections));
  },
  setQuickOrder: (order) => {
    set({ quickOrder: order });
    persist('quickOrder', JSON.stringify(order));
  },
  setReminder: (key, value) => {
    const reminders = { ...get().reminders, [key]: value };
    set({ reminders });
    persist('reminders', JSON.stringify(reminders));
  },
  setInvestorProfitPct: (pct) => {
    const investorProfitPct = clampPct(pct);
    set({ investorProfitPct });
    persist('investorProfitPct', String(investorProfitPct));
  },
  setDonationPct: (pct) => {
    const donationPct = clampPct(pct);
    set({ donationPct });
    persist('donationPct', String(donationPct));
  },
}));
