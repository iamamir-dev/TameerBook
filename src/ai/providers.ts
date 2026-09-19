/**
 * Provider catalogue — everything Settings needs to let the user pick a
 * provider, paste its key and choose a model. ONE place to bump when a free
 * model is renamed. Free-tier facts as of Sept 2026; re-check the linked
 * consoles when something 404s.
 */
export const AI_PROVIDERS = ['groq', 'gemini', 'openai', 'openrouter', 'proxy', 'custom'] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export interface ModelPreset {
  id: string;
  /** Short human label ("fast", "best Urdu"). */
  note: string;
}

export interface ProviderInfo {
  id: AiProviderId;
  label: string;
  /** One line shown under the name in the picker. */
  hint: string;
  /** Where to get a key. */
  consoleUrl?: string;
  /** OpenAI-compatible base URL (null for Gemini native / proxy / custom). */
  baseUrl: string | null;
  defaultModel: string;
  models: ModelPreset[];
  /** Whisper / native audio available. */
  voice: boolean;
  /** Image input available on the default model. */
  vision: boolean;
  /** Needs an API key from the user. */
  needsKey: boolean;
  /** Needs a base URL from the user. */
  needsUrl: boolean;
  /** Does the free tier train on your data? */
  trainsOnData: boolean;
}

export const PROVIDERS: Record<AiProviderId, ProviderInfo> = {
  groq: {
    id: 'groq',
    label: 'Groq',
    hint: 'Free · fast · no training on your data · voice',
    consoleUrl: 'https://console.groq.com',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    models: [
      { id: 'openai/gpt-oss-120b', note: 'best reasoning + tools' },
      { id: 'qwen/qwen3.8-27b', note: 'good Urdu · vision' },
      { id: 'qwen/qwen3.6-27b', note: 'older Qwen · vision' },
      { id: 'openai/gpt-oss-20b', note: 'fastest' },
      { id: 'llama-3.3-70b-versatile', note: 'Llama 3.3' },
    ],
    voice: true,
    vision: true,
    needsKey: true,
    needsUrl: false,
    trainsOnData: false,
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    hint: 'Free · best Urdu · voice + vision · trains on data',
    consoleUrl: 'https://aistudio.google.com/apikey',
    baseUrl: null,
    defaultModel: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', note: 'balanced' },
      { id: 'gemini-2.5-flash-lite', note: 'fastest · higher free limits' },
      { id: 'gemini-3.5-flash', note: 'newest (check availability)' },
    ],
    voice: true,
    vision: true,
    needsKey: true,
    needsUrl: false,
    trainsOnData: true,
  },
  openai: {
    id: 'openai',
    label: 'OpenAI (paid)',
    hint: 'GPT-5 family · most precise · pay per use · voice + vision',
    consoleUrl: 'https://platform.openai.com/api-keys',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5-mini',
    models: [
      { id: 'gpt-5-mini', note: 'best value' },
      { id: 'gpt-5', note: 'most capable' },
      { id: 'gpt-5-nano', note: 'cheapest' },
      { id: 'gpt-4o-mini', note: 'older · fast' },
    ],
    voice: true,
    vision: true,
    needsKey: true,
    needsUrl: false,
    trainsOnData: false,
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'Free models (50/day, 1000 after $10) · no voice',
    consoleUrl: 'https://openrouter.ai/keys',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemma-4-31b-it:free',
    models: [
      { id: 'google/gemma-4-31b-it:free', note: 'Gemma 4 · good Urdu' },
      { id: 'z-ai/glm-5.2:free', note: 'GLM 5.2' },
      { id: 'nvidia/nemotron-3-super-120b:free', note: 'Nemotron' },
    ],
    voice: false,
    vision: true,
    needsKey: true,
    needsUrl: false,
    trainsOnData: true,
  },
  proxy: {
    id: 'proxy',
    label: 'My server (Cloudflare Worker)',
    hint: 'Keys stay on your server · Groq + Workers AI · voice',
    baseUrl: null,
    defaultModel: 'openai/gpt-oss-120b',
    models: [
      { id: 'openai/gpt-oss-120b', note: 'via Groq' },
      { id: 'qwen/qwen3.8-27b', note: 'via Groq · vision' },
    ],
    voice: true,
    vision: true,
    needsKey: false,
    needsUrl: true,
    trainsOnData: false,
  },
  custom: {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    hint: 'Any /v1/chat/completions endpoint · Ollama, Together, Mistral…',
    baseUrl: null,
    defaultModel: 'gpt-4o-mini',
    models: [],
    voice: false,
    vision: false,
    needsKey: true,
    needsUrl: true,
    trainsOnData: false,
  },
};

/** Whisper model on Groq (the voice fallback for providers without audio). */
export const GROQ_WHISPER = 'whisper-large-v3-turbo';
/** Keep prompts + answers small: Groq's free tier is 8K tokens per minute. */
export const MAX_OUTPUT_TOKENS = 700;
/** Tool turns need room for reasoning + a JSON call + the final answer. */
export const TOOL_MAX_TOKENS = 1400;
/** Vision-capable Groq models, best first (the id list doubles as the fallback chain). */
export const GROQ_VISION_MODELS = ['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b'] as const;
/** Text fallbacks on Groq when the chosen model is capped or fails. */
export const GROQ_TEXT_FALLBACKS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'qwen/qwen3.6-27b'] as const;
/** Give up on a provider call after this long (React Native fetch has no timeout of its own). */
export const REQUEST_TIMEOUT_MS = 60_000;
export const IMAGE_REQUEST_TIMEOUT_MS = 90_000;
