/**
 * Provider catalogue — everything Settings needs to let the user pick a
 * provider, paste its key and choose a model. Two model families only:
 *
 *   claude   Claude through an Anthropic-shaped gateway (MWAPI by default,
 *            the same gateway and model SubscribAI runs on). Best tool
 *            choice, follows the whole system prompt, reads images.
 *   openai   GPT-5 family. Also the ONLY voice engine: Claude has no audio
 *            endpoint, so transcription always goes to OpenAI.
 *   proxy    The user's own Cloudflare Worker (server/ai-proxy) holding the
 *            keys for both, so the phone ships none.
 */
export const AI_PROVIDERS = ['claude', 'openai', 'proxy'] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export interface ModelPreset {
  id: string;
  /** Short human label ("best", "fastest"). */
  note: string;
}

export interface ProviderInfo {
  id: AiProviderId;
  label: string;
  /** One line shown under the name in the picker. */
  hint: string;
  /** Where to get a key. */
  consoleUrl?: string;
  /** Default base URL (null for the proxy, whose URL the user types). */
  baseUrl: string | null;
  defaultModel: string;
  models: ModelPreset[];
  /** Transcribes audio itself. */
  voice: boolean;
  /** Needs an API key from the user. */
  needsKey: boolean;
  /** Needs a base URL from the user. */
  needsUrl: boolean;
  /** The base URL may be overridden in Settings (a different gateway). */
  urlEditable: boolean;
}

/** The gateway SubscribAI uses; any Anthropic-shaped endpoint works (api.anthropic.com too). */
export const MWAPI_BASE_URL = 'https://api.mwapi.dev/v1';
export const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export const CLAUDE_DEFAULT_MODEL = 'claude-sonnet-4-6';
export const OPENAI_DEFAULT_MODEL = 'gpt-5-mini';

export const PROVIDERS: Record<AiProviderId, ProviderInfo> = {
  claude: {
    id: 'claude',
    label: 'Claude',
    hint: 'Best answers · same model as SubscribAI · reads bills',
    consoleUrl: 'https://mwapi.dev',
    baseUrl: MWAPI_BASE_URL,
    defaultModel: CLAUDE_DEFAULT_MODEL,
    models: [
      { id: 'claude-sonnet-4-6', note: 'best · recommended' },
      { id: 'claude-haiku-4-5-20251001', note: 'fastest · cheapest' },
      { id: 'claude-opus-4-6', note: 'deepest reasoning' },
    ],
    voice: false,
    needsKey: true,
    needsUrl: false,
    urlEditable: true,
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    hint: 'GPT-5 family · voice + bills · pay per use',
    consoleUrl: 'https://platform.openai.com/api-keys',
    baseUrl: OPENAI_BASE_URL,
    defaultModel: OPENAI_DEFAULT_MODEL,
    models: [
      { id: 'gpt-5-mini', note: 'best value' },
      { id: 'gpt-5', note: 'most capable' },
      { id: 'gpt-5-nano', note: 'cheapest' },
      { id: 'gpt-4o-mini', note: 'older · fast' },
    ],
    voice: true,
    needsKey: true,
    needsUrl: false,
    urlEditable: false,
  },
  proxy: {
    id: 'proxy',
    label: 'My server (Cloudflare Worker)',
    hint: 'Keys stay on your server · Claude + OpenAI · voice',
    baseUrl: null,
    defaultModel: CLAUDE_DEFAULT_MODEL,
    models: [
      { id: 'claude-sonnet-4-6', note: 'Claude · best' },
      { id: 'claude-haiku-4-5-20251001', note: 'Claude · fastest' },
      { id: 'gpt-5-mini', note: 'OpenAI' },
    ],
    voice: true,
    needsKey: false,
    needsUrl: true,
    urlEditable: false,
  },
};

/** A model id that must be routed to the Messages API rather than chat completions. */
export const isClaudeModel = (model: string): boolean => model.startsWith('claude');

/** OpenAI's transcription model (Whisper's successor; takes a vocabulary prompt + language). */
export const OPENAI_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';
/** Room for a full report with tables: the same budget SubscribAI runs on. */
export const MAX_OUTPUT_TOKENS = 4096;
/** Tool turns: a call plus the sentence after it fit comfortably. */
export const TOOL_MAX_TOKENS = 4096;
/** Give up on a provider call after this long (React Native fetch has no timeout of its own). */
export const REQUEST_TIMEOUT_MS = 90_000;
export const IMAGE_REQUEST_TIMEOUT_MS = 120_000;

/** The subset of Settings that decides whether the assistant can be called. */
export interface AiConfigFields {
  aiProvider: AiProviderId;
  aiKeys: Partial<Record<AiProviderId, string>>;
  aiProxyUrl: string | null;
}

/** True when the chosen provider has what it needs (key / URL). Pure; shared by every screen. */
export function aiConfigured(s: AiConfigFields): boolean {
  const info = PROVIDERS[s.aiProvider] ?? PROVIDERS.claude;
  const key = s.aiKeys[s.aiProvider] ?? '';
  return (!info.needsKey || !!key) && (!info.needsUrl || !!s.aiProxyUrl);
}
