import { create } from 'zustand';

import { loadSettings, saveSetting } from '@/db/repositories/settings';
import { uuid } from '@/db/uuid';
import { REPLY_LANGUAGE_SETTINGS, type ReplyLanguageSetting } from '@/ai/language';
import { AI_PROVIDERS, type AiProviderId } from '@/ai/providers';
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


/** Default charity/donation % of each party's profit (shariah, agreed upfront). */
export const DEFAULT_DONATION_PCT = 0;

/**
 * The OPTIONAL Home sections a user can show/hide (Settings → Home screen).
 * The essentials — total assets, accounts, shortcuts, projects — are the
 * dashboard and always show; only the extras are configurable. All extras
 * default off until switched on.
 */
export interface HomeSectionPrefs {
  plots: boolean;
  labor: boolean;
  udhaar: boolean;
}

export type HomeSectionKey = keyof HomeSectionPrefs;

export const DEFAULT_HOME_SECTIONS: HomeSectionPrefs = {
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
  'assistant',
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
  /** % of each party's profit donated to charity at settlement. */
  donationPct: number;
  /** Company signature (PNG data URL) set in Settings — reusable across documents. */
  signature: string | null;
  /** User's own remove.bg API key (on-device) for signature background removal. */
  removeBgKey: string | null;
  /** Assistant (AI helpers). OFF by default — voice / bill reading / questions send data to the internet. */
  aiEnabled: boolean;
  /** Read assistant answers aloud (device text-to-speech). */
  aiSpeak: boolean;
  /** Which language the assistant replies in: auto = follow the user's words. */
  aiReplyLanguage: ReplyLanguageSetting;
  /** Which AI provider answers (see src/ai/providers.ts). */
  aiProvider: AiProviderId;
  /** API key per provider (the user's own, stored on-device). */
  aiKeys: Partial<Record<AiProviderId, string>>;
  /** Chosen model id per provider ('' = provider default). */
  aiModel: Partial<Record<AiProviderId, string>>;
  /** Base URL of the self-hosted AI proxy (Cloudflare Worker). Null = not configured. */
  aiProxyUrl: string | null;
  /** Shared app token the proxy expects (optional). */
  aiProxyToken: string | null;
  /** Base URL for the "custom" OpenAI-compatible provider. */
  aiCustomBaseUrl: string | null;
  /** Stable anonymous id for per-device quotas at the proxy (generated once). */
  aiDeviceId: string;
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
  setDonationPct: (pct: number) => void;
  setSignature: (signature: string | null) => void;
  setRemoveBgKey: (key: string | null) => void;
  setAiEnabled: (on: boolean) => void;
  setAiSpeak: (on: boolean) => void;
  setAiReplyLanguage: (lang: ReplyLanguageSetting) => void;
  setAiProxyUrl: (url: string | null) => void;
  setAiProxyToken: (token: string | null) => void;
  setAiProvider: (provider: AiProviderId) => void;
  setAiKey: (provider: AiProviderId, key: string | null) => void;
  setAiModel: (provider: AiProviderId, model: string | null) => void;
  setAiCustomBaseUrl: (url: string | null) => void;
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
  donationPct: DEFAULT_DONATION_PCT,
  signature: null,
  removeBgKey: null,
  aiEnabled: false,
  aiSpeak: true,
  aiReplyLanguage: 'auto',
  aiProvider: 'groq',
  aiKeys: {},
  aiModel: {},
  aiProxyUrl: null,
  aiProxyToken: null,
  aiCustomBaseUrl: null,
  aiDeviceId: '',

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
      if (s.donationPct != null) patch.donationPct = clampPct(Number(s.donationPct));
      if (s.signature) patch.signature = s.signature;
      if (s.removeBgKey) patch.removeBgKey = s.removeBgKey;
      if (s.aiEnabled != null) patch.aiEnabled = s.aiEnabled === '1';
      if (s.aiSpeak != null) patch.aiSpeak = s.aiSpeak === '1';
      if (s.aiReplyLanguage && (REPLY_LANGUAGE_SETTINGS as readonly string[]).includes(s.aiReplyLanguage)) patch.aiReplyLanguage = s.aiReplyLanguage as ReplyLanguageSetting;
      if (s.aiProxyUrl) patch.aiProxyUrl = s.aiProxyUrl;
      if (s.aiProxyToken) patch.aiProxyToken = s.aiProxyToken;
      if (s.aiCustomBaseUrl) patch.aiCustomBaseUrl = s.aiCustomBaseUrl;
      if (s.aiProvider && (AI_PROVIDERS as readonly string[]).includes(s.aiProvider)) patch.aiProvider = s.aiProvider as AiProviderId;
      if (s.aiKeys) {
        try {
          patch.aiKeys = JSON.parse(s.aiKeys) as Partial<Record<AiProviderId, string>>;
        } catch {
          /* ignore malformed */
        }
      }
      // Older builds stored a single Groq key — carry it into the per-provider map.
      if (s.aiGroqKey && !patch.aiKeys?.groq) patch.aiKeys = { ...(patch.aiKeys ?? {}), groq: s.aiGroqKey };
      if (s.aiModel) {
        try {
          patch.aiModel = JSON.parse(s.aiModel) as Partial<Record<AiProviderId, string>>;
        } catch {
          /* ignore malformed */
        }
      }
      // A saved proxy URL from an older build means the user meant "proxy".
      if (!s.aiProvider && s.aiProxyUrl) patch.aiProvider = 'proxy';
      // One anonymous device id for proxy quotas, minted on first launch.
      if (s.aiDeviceId) patch.aiDeviceId = s.aiDeviceId;
      else {
        patch.aiDeviceId = uuid();
        persist('aiDeviceId', patch.aiDeviceId);
      }
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
  setDonationPct: (pct) => {
    const donationPct = clampPct(pct);
    set({ donationPct });
    persist('donationPct', String(donationPct));
  },
  setSignature: (signature) => {
    set({ signature });
    persist('signature', signature ?? '');
  },
  setRemoveBgKey: (removeBgKey) => {
    set({ removeBgKey });
    persist('removeBgKey', removeBgKey ?? '');
  },
  setAiEnabled: (aiEnabled) => {
    set({ aiEnabled });
    persist('aiEnabled', aiEnabled ? '1' : '0');
  },
  setAiSpeak: (aiSpeak) => {
    set({ aiSpeak });
    persist('aiSpeak', aiSpeak ? '1' : '0');
  },
  setAiReplyLanguage: (aiReplyLanguage) => {
    set({ aiReplyLanguage });
    persist('aiReplyLanguage', aiReplyLanguage);
  },
  setAiProxyUrl: (url) => {
    const aiProxyUrl = url?.trim().replace(/\/+$/, '') || null;
    set({ aiProxyUrl });
    persist('aiProxyUrl', aiProxyUrl ?? '');
  },
  setAiProxyToken: (token) => {
    const aiProxyToken = token?.trim() || null;
    set({ aiProxyToken });
    persist('aiProxyToken', aiProxyToken ?? '');
  },
  setAiProvider: (aiProvider) => {
    set({ aiProvider });
    persist('aiProvider', aiProvider);
  },
  setAiKey: (provider, key) => {
    const aiKeys = { ...get().aiKeys };
    const v = key?.trim();
    if (v) aiKeys[provider] = v;
    else delete aiKeys[provider];
    set({ aiKeys });
    persist('aiKeys', JSON.stringify(aiKeys));
  },
  setAiModel: (provider, model) => {
    const aiModel = { ...get().aiModel };
    const v = model?.trim();
    if (v) aiModel[provider] = v;
    else delete aiModel[provider];
    set({ aiModel });
    persist('aiModel', JSON.stringify(aiModel));
  },
  setAiCustomBaseUrl: (url) => {
    const aiCustomBaseUrl = url?.trim().replace(/\/+$/, '') || null;
    set({ aiCustomBaseUrl });
    persist('aiCustomBaseUrl', aiCustomBaseUrl ?? '');
  },
}));
