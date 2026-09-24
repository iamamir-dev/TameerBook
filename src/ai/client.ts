import { useSettingsStore } from '@/stores/useSettingsStore';

import { anthropicHeaders, parseAnthropicResponse, toAnthropicBody } from './anthropic';
import { lostToolCall, parseOpenAiResponse, toOpenAiBody } from './openai';
import {
  aiConfigured,
  IMAGE_REQUEST_TIMEOUT_MS,
  isClaudeModel,
  MAX_OUTPUT_TOKENS,
  MWAPI_BASE_URL,
  OPENAI_BASE_URL,
  OPENAI_TRANSCRIBE_MODEL,
  PROVIDERS,
  REQUEST_TIMEOUT_MS,
  TOOL_MAX_TOKENS,
  type AiProviderId,
} from './providers';
import {
  AiError,
  type AiChatMessage,
  type AiTransport,
  type AudioFile,
  type ChatOptions,
  type ChatToolsResult,
  type ToolSpec,
  type TranscribeOptions,
} from './types';

export { chatJson, extractJson } from './json';

/**
 * The one door to any AI provider. Settings pick the provider, key, model and
 * (for the proxy) the base URL; this builds the matching transport:
 *
 *   claude          → Messages API (MWAPI gateway or api.anthropic.com)
 *   openai          → chat completions
 *   proxy           → the Worker, which speaks both shapes; the model id
 *                     decides the route (claude-* → /v1/messages)
 *
 * Voice is always OpenAI transcription: with the OpenAI key directly, or
 * through the proxy. Nothing here touches the database.
 */

export interface AiAvailability {
  enabled: boolean;
  provider: AiProviderId;
  /** True when the chosen provider has what it needs (key / URL). */
  configured: boolean;
  voice: boolean;
}

export function aiAvailability(): AiAvailability {
  const s = useSettingsStore.getState();
  const info = PROVIDERS[s.aiProvider];
  return { enabled: s.aiEnabled, provider: s.aiProvider, configured: aiConfigured(s), voice: info.voice || !!s.aiKeys.openai };
}

/** Where speech goes: OpenAI directly, or the proxy's audio route. */
type VoiceRoute = { base: string; headers: Record<string, string> } | null;

/** Resolve the configured transport or throw a coded error. */
export function getAiTransport(): AiTransport {
  const s = useSettingsStore.getState();
  if (!s.aiEnabled) throw new AiError('disabled');
  const provider = s.aiProvider;
  const info = PROVIDERS[provider];
  const key = s.aiKeys[provider] ?? '';
  const model = s.aiModel[provider] || info.defaultModel;
  const openaiKey = s.aiKeys.openai ?? '';
  const openaiVoice: VoiceRoute = openaiKey ? { base: OPENAI_BASE_URL, headers: { Authorization: `Bearer ${openaiKey}` } } : null;
  switch (provider) {
    case 'proxy': {
      if (!s.aiProxyUrl) throw new AiError('noProvider');
      const base = `${s.aiProxyUrl.replace(/\/+$/, '')}/v1`;
      const headers = { 'x-device-id': s.aiDeviceId, ...(s.aiProxyToken ? { 'x-app-token': s.aiProxyToken } : {}) };
      const voice: VoiceRoute = { base, headers };
      return isClaudeModel(model) ? new AnthropicTransport('proxy', base, null, headers, model, voice) : new OpenAiTransport('proxy', base, null, headers, model, voice);
    }
    case 'openai':
      if (!key) throw new AiError('noProvider');
      return new OpenAiTransport('openai', OPENAI_BASE_URL, key, {}, model, openaiVoice);
    case 'claude':
    default: {
      if (!key) throw new AiError('noProvider');
      const base = (s.aiCustomBaseUrl || MWAPI_BASE_URL).replace(/\/+$/, '');
      return new AnthropicTransport('claude', base, key, {}, model, openaiVoice);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Shared HTTP helpers                                                       */
/* -------------------------------------------------------------------------- */

/**
 * fetch with a deadline (React Native's fetch never times out on its own) and
 * one quiet retry on a transient server error. Errors come back coded.
 */
async function doFetch(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: ctrl.signal });
    } catch (e) {
      clearTimeout(timer);
      if (ctrl.signal.aborted) throw new AiError('timeout', `${timeoutMs}ms`);
      throw new AiError('offline', e instanceof Error ? e.message : undefined);
    }
    clearTimeout(timer);
    if (res.ok) return res;
    const body = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) throw new AiError('badkey', body.slice(0, 200));
    if (res.status === 429 || res.status === 402) throw new AiError('quota', body.slice(0, 200));
    // 5xx / 408 / 529 (overloaded): the provider hiccupped. One short pause, one retry, then give up.
    if (attempt === 0 && (res.status >= 500 || res.status === 408)) {
      await new Promise((r) => setTimeout(r, 1200));
      continue;
    }
    throw new AiError('failed', `${res.status} ${body.slice(0, 200)}`);
  }
}

const hasImages = (messages: AiChatMessage[]): boolean => messages.some((m) => m.role === 'user' && !!m.images?.length);

/** Speech → text through OpenAI's transcription endpoint (directly or via the proxy). */
async function transcribeOpenAi(route: VoiceRoute, file: AudioFile, opts: TranscribeOptions): Promise<string> {
  if (!route) throw new AiError('noVoice');
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  form.append('model', OPENAI_TRANSCRIBE_MODEL);
  form.append('response_format', 'json');
  if (opts.language) form.append('language', opts.language);
  if (opts.prompt) form.append('prompt', opts.prompt.slice(0, 1000));
  const res = await doFetch(`${route.base}/audio/transcriptions`, { method: 'POST', headers: route.headers, body: form });
  const data = (await res.json()) as { text?: string };
  if (typeof data.text !== 'string') throw new AiError('failed', 'empty transcript');
  return data.text.trim();
}

/* -------------------------------------------------------------------------- */
/*  Claude (Messages API)                                                     */
/* -------------------------------------------------------------------------- */

class AnthropicTransport implements AiTransport {
  constructor(
    readonly kind: string,
    private readonly baseUrl: string,
    private readonly apiKey: string | null,
    private readonly extraHeaders: Record<string, string>,
    private readonly model: string,
    private readonly voice: VoiceRoute
  ) {}

  private async messages(messages: AiChatMessage[], opts: ChatOptions, tools?: ToolSpec[]): Promise<ChatToolsResult> {
    const model = opts.model ?? this.model;
    const maxTokens = opts.maxTokens ?? (tools ? TOOL_MAX_TOKENS : MAX_OUTPUT_TOKENS);
    const timeout = hasImages(messages) ? IMAGE_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
    const body = toAnthropicBody(messages, { model, maxTokens, temperature: opts.temperature, tools, json: opts.json });
    const res = await doFetch(`${this.baseUrl}/messages`, { method: 'POST', headers: anthropicHeaders(this.apiKey, this.extraHeaders), body: JSON.stringify(body) }, timeout);
    const parsed = parseAnthropicResponse(await res.json());
    // MWAPI's Anthropic route loses a tool_use block whose input is {} (seen
    // 2026-09-25: stop_reason tool_use, content []). The same gateway's
    // chat-completions route returns the call intact, so ask it the same thing.
    if (tools && lostToolCall(parsed)) return this.compat(messages, { ...opts, model, maxTokens }, tools, timeout);
    return parsed;
  }

  /** The OpenAI-shaped route of the same gateway (`/chat/completions`), bearer auth. */
  private async compat(messages: AiChatMessage[], opts: ChatOptions & { model: string; maxTokens: number }, tools: ToolSpec[], timeout: number): Promise<ChatToolsResult> {
    const body = toOpenAiBody(messages, { model: opts.model, maxTokens: opts.maxTokens, temperature: opts.temperature, tools, json: opts.json });
    const headers = { ...this.extraHeaders, 'content-type': 'application/json', ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) };
    const res = await doFetch(`${this.baseUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) }, timeout);
    const r = parseOpenAiResponse(await res.json());
    if (!r) throw new AiError('failed', 'empty completion');
    return r;
  }

  async chat(messages: AiChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const r = await this.messages(messages, { temperature: 0.2, ...opts });
    if (!r.content) throw new AiError('failed', 'empty completion');
    return r.content;
  }

  async chatTools(messages: AiChatMessage[], tools: ToolSpec[], opts: ChatOptions = {}): Promise<ChatToolsResult> {
    const r = await this.messages(messages, { temperature: 0, ...opts }, tools);
    return { content: r.content, toolCalls: r.toolCalls, usage: r.usage };
  }

  transcribe(file: AudioFile, opts: TranscribeOptions = {}): Promise<string> {
    return transcribeOpenAi(this.voice, file, opts);
  }

  async vision(imageBase64: string, prompt: string, opts: ChatOptions = {}): Promise<string> {
    return this.chat([{ role: 'user', content: prompt, images: [imageBase64] }], { temperature: 0.1, ...opts });
  }
}

/* -------------------------------------------------------------------------- */
/*  OpenAI (chat completions)                                                 */
/* -------------------------------------------------------------------------- */

/** GPT-5 / o-series: rename the token cap, fixed temperature, reasoning inside the budget. */
const isReasoningModel = (model: string): boolean => /^(gpt-5|o\d)/.test(model);

class OpenAiTransport implements AiTransport {
  constructor(
    readonly kind: string,
    private readonly baseUrl: string,
    private readonly apiKey: string | null,
    private readonly extraHeaders: Record<string, string>,
    private readonly model: string,
    private readonly voice: VoiceRoute
  ) {}

  private async completion(messages: AiChatMessage[], opts: ChatOptions, tools?: ToolSpec[]): Promise<ChatToolsResult> {
    const model = opts.model ?? this.model;
    const b = toOpenAiBody(messages, { model, maxTokens: opts.maxTokens ?? (tools ? TOOL_MAX_TOKENS : MAX_OUTPUT_TOKENS), temperature: opts.temperature, tools, json: opts.json });
    if (isReasoningModel(model)) {
      // Reasoning tokens come out of the same budget; give them room and keep them short.
      b.max_completion_tokens = Math.max(Number(b.max_tokens ?? 0), 6000);
      delete b.max_tokens;
      delete b.temperature;
      b.reasoning_effort = 'low';
    }
    const headers = { ...this.extraHeaders, 'Content-Type': 'application/json', ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}) };
    const res = await doFetch(`${this.baseUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(b) }, hasImages(messages) ? IMAGE_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
    const r = parseOpenAiResponse(await res.json());
    if (!r) throw new AiError('failed', 'empty completion');
    return r;
  }

  async chat(messages: AiChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const r = await this.completion(messages, { temperature: 0.2, ...opts });
    if (!r.content) throw new AiError('failed', 'empty completion');
    return r.content;
  }

  chatTools(messages: AiChatMessage[], tools: ToolSpec[], opts: ChatOptions = {}): Promise<ChatToolsResult> {
    return this.completion(messages, { temperature: 0, ...opts }, tools);
  }

  transcribe(file: AudioFile, opts: TranscribeOptions = {}): Promise<string> {
    return transcribeOpenAi(this.voice, file, opts);
  }

  async vision(imageBase64: string, prompt: string, opts: ChatOptions = {}): Promise<string> {
    return this.chat([{ role: 'user', content: prompt, images: [imageBase64] }], { temperature: 0.1, ...opts });
  }
}

/** A one-line round trip to verify a provider setup from Settings. */
export async function testConnection(): Promise<string> {
  const t = getAiTransport();
  const reply = await t.chat([{ role: 'user', content: 'Reply with exactly: OK' }], { maxTokens: 16, temperature: 0 });
  return reply.trim().slice(0, 40);
}
