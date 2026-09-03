import * as FileSystem from 'expo-file-system/legacy';

import { useSettingsStore } from '@/stores/useSettingsStore';

import { GROQ_WHISPER, MAX_OUTPUT_TOKENS, PROVIDERS, TOOL_MAX_TOKENS, type AiProviderId } from './providers';
import {
  AiError,
  type AiChatMessage,
  type AiTransport,
  type AudioFile,
  type ChatOptions,
  type ChatToolsResult,
  type ToolCall,
  type ToolSpec,
  type TranscribeOptions,
} from './types';

export { chatJson, extractJson } from './json';

/**
 * The one door to any AI provider. Settings pick the provider, key, model and
 * (for proxy / custom) the base URL; this builds the matching transport:
 *
 *   groq | openrouter | custom | proxy → OpenAI-compatible chat completions
 *   gemini                             → Gemini native generateContent
 *
 * Voice: Groq Whisper (Groq or proxy) or Gemini audio. Other providers fall
 * back to a Groq key when one is saved, else AiError('noVoice').
 * Nothing here touches the database.
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
  const key = s.aiKeys[s.aiProvider] ?? '';
  const url = s.aiProvider === 'proxy' ? s.aiProxyUrl : s.aiProvider === 'custom' ? s.aiCustomBaseUrl : info.baseUrl;
  const configured = (!info.needsKey || !!key) && (!info.needsUrl || !!url);
  return { enabled: s.aiEnabled, provider: s.aiProvider, configured, voice: info.voice || !!s.aiKeys.groq };
}

/** Resolve the configured transport or throw a coded error. */
export function getAiTransport(): AiTransport {
  const s = useSettingsStore.getState();
  if (!s.aiEnabled) throw new AiError('disabled');
  const provider = s.aiProvider;
  const info = PROVIDERS[provider];
  const key = s.aiKeys[provider] ?? '';
  const model = s.aiModel[provider] || info.defaultModel;
  const groqKey = s.aiKeys.groq ?? '';
  switch (provider) {
    case 'gemini':
      if (!key) throw new AiError('noProvider');
      return new GeminiTransport(key, model, groqKey || null);
    case 'proxy':
      if (!s.aiProxyUrl) throw new AiError('noProvider');
      return new OpenAiCompatTransport(
        'proxy',
        `${s.aiProxyUrl}/v1`,
        null,
        model,
        { 'x-device-id': s.aiDeviceId, ...(s.aiProxyToken ? { 'x-app-token': s.aiProxyToken } : {}) },
        { voiceModel: GROQ_WHISPER }
      );
    case 'custom':
      if (!s.aiCustomBaseUrl) throw new AiError('noProvider');
      return new OpenAiCompatTransport('custom', s.aiCustomBaseUrl.replace(/\/+$/, ''), key || null, model, {}, { voiceViaGroqKey: groqKey || null });
    case 'openai':
      if (!key) throw new AiError('noProvider');
      // GPT-5 / o-series reject `max_tokens` and non-default temperature.
      return new OpenAiCompatTransport('openai', info.baseUrl!, key, model, {}, { voiceModel: 'gpt-4o-mini-transcribe', tokensParam: 'max_completion_tokens', fixedTemperature: true });
    case 'openrouter':
      if (!key) throw new AiError('noProvider');
      return new OpenAiCompatTransport(
        'openrouter',
        info.baseUrl!,
        key,
        model,
        { 'HTTP-Referer': 'https://tameerbook.app', 'X-Title': 'TameerBook' },
        { voiceViaGroqKey: groqKey || null }
      );
    case 'groq':
    default:
      if (!key) throw new AiError('noProvider');
      return new OpenAiCompatTransport('groq', info.baseUrl!, key, model, {}, { voiceModel: GROQ_WHISPER, fallbackModel: model === 'qwen/qwen3.6-27b' ? 'openai/gpt-oss-120b' : 'qwen/qwen3.6-27b' });
  }
}

/* -------------------------------------------------------------------------- */
/*  Shared HTTP helpers                                                       */
/* -------------------------------------------------------------------------- */

async function doFetch(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new AiError('offline', e instanceof Error ? e.message : undefined);
  }
  if (res.ok) return res;
  const body = await res.text().catch(() => '');
  if (res.status === 401 || res.status === 403) throw new AiError('badkey', body.slice(0, 200));
  if (res.status === 429 || res.status === 402) throw new AiError('quota', body.slice(0, 200));
  throw new AiError('failed', `${res.status} ${body.slice(0, 200)}`);
}

const parseArgs = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const v = JSON.parse(raw) as unknown;
      return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
};

/* -------------------------------------------------------------------------- */
/*  OpenAI-compatible (Groq, OpenRouter, custom, proxy)                       */
/* -------------------------------------------------------------------------- */

interface OaMessage {
  role: string;
  content: unknown;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  name?: string;
}

interface OaResponse {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
    };
  }[];
}

function toOaMessages(messages: AiChatMessage[]): OaMessage[] {
  return messages.map((m) => {
    switch (m.role) {
      case 'assistant':
        return {
          role: 'assistant',
          content: m.content ?? '',
          ...(m.toolCalls?.length
            ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: JSON.stringify(c.args) } })) }
            : {}),
        };
      case 'tool':
        return { role: 'tool', tool_call_id: m.toolCallId, name: m.name, content: m.content };
      default:
        return { role: m.role, content: m.content };
    }
  });
}

interface CompatOptions {
  /** Whisper model available at `${baseUrl}/audio/transcriptions`. */
  voiceModel?: string;
  /** No audio endpoint here: use Groq's with this key when present. */
  voiceViaGroqKey?: string | null;
  /** OpenAI's newer models want `max_completion_tokens`. */
  tokensParam?: 'max_tokens' | 'max_completion_tokens';
  /** Reasoning models only accept the default temperature. */
  fixedTemperature?: boolean;
  /** Retry once on this model when the primary fails (per-model caps, tool-call glitches). */
  fallbackModel?: string;
}

class OpenAiCompatTransport implements AiTransport {
  constructor(
    readonly kind: string,
    private readonly baseUrl: string,
    private readonly apiKey: string | null,
    private readonly model: string,
    private readonly extraHeaders: Record<string, string>,
    private readonly o: CompatOptions
  ) {}

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = { ...this.extraHeaders };
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`;
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  private async completion(body: Record<string, unknown>): Promise<OaResponse> {
    // Normalise the two params providers disagree on.
    const b: Record<string, unknown> = { ...body };
    if (this.o.tokensParam === 'max_completion_tokens' && 'max_tokens' in b) {
      b.max_completion_tokens = b.max_tokens;
      delete b.max_tokens;
    }
    if (this.o.fixedTemperature) delete b.temperature;
    try {
      const res = await doFetch(`${this.baseUrl}/chat/completions`, { method: 'POST', headers: this.headers(), body: JSON.stringify(b) });
      return (await res.json()) as OaResponse;
    } catch (e) {
      // Groq free tier: per-model daily caps (429) and occasional malformed
      // tool calls (400 tool_use_failed). One retry on the secondary model.
      const fb = this.o.fallbackModel;
      if (fb && b.model !== fb && e instanceof AiError && (e.code === 'quota' || e.code === 'failed')) {
        const res = await doFetch(`${this.baseUrl}/chat/completions`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ ...b, model: fb }) });
        return (await res.json()) as OaResponse;
      }
      throw e;
    }
  }

  async chat(messages: AiChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const data = await this.completion({
      model: opts.model ?? this.model,
      messages: toOaMessages(messages),
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? MAX_OUTPUT_TOKENS,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    });
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new AiError('failed', 'empty completion');
    return content;
  }

  async chatTools(messages: AiChatMessage[], tools: ToolSpec[], opts: ChatOptions = {}): Promise<ChatToolsResult> {
    const model = opts.model ?? this.model;
    const data = await this.completion({
      model,
      messages: toOaMessages(messages),
      temperature: opts.temperature ?? 0,
      max_tokens: opts.maxTokens ?? TOOL_MAX_TOKENS,
      tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
      tool_choice: 'auto',
      // gpt-oss thinks before it answers; keep that short so the reply fits.
      ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
    });
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new AiError('failed', 'empty completion');
    const toolCalls: ToolCall[] = (msg.tool_calls ?? [])
      .filter((c) => c.function?.name)
      .map((c, i) => ({ id: c.id ?? `call_${i}`, name: c.function!.name!, args: parseArgs(c.function!.arguments) }));
    return { content: typeof msg.content === 'string' && msg.content.trim() ? msg.content : null, toolCalls };
  }

  async transcribe(file: AudioFile, opts: TranscribeOptions = {}): Promise<string> {
    const base = this.o.voiceModel ? this.baseUrl : this.o.voiceViaGroqKey ? 'https://api.groq.com/openai/v1' : null;
    if (!base) throw new AiError('noVoice');
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    form.append('model', this.o.voiceModel ?? GROQ_WHISPER);
    form.append('response_format', 'json');
    form.append('temperature', '0');
    if (opts.language) form.append('language', opts.language);
    if (opts.prompt) form.append('prompt', opts.prompt);
    const headers = this.o.voiceModel ? this.headers(false) : { Authorization: `Bearer ${this.o.voiceViaGroqKey}` };
    const res = await doFetch(`${base}/audio/transcriptions`, { method: 'POST', headers, body: form });
    const data = (await res.json()) as { text?: string };
    if (typeof data.text !== 'string') throw new AiError('failed', 'empty transcript');
    return data.text.trim();
  }

  async vision(imageBase64: string, prompt: string, opts: ChatOptions = {}): Promise<string> {
    const data = await this.completion({
      model: opts.model ?? this.model,
      temperature: opts.temperature ?? 0.1,
      max_tokens: opts.maxTokens ?? MAX_OUTPUT_TOKENS,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        },
      ],
    });
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new AiError('failed', 'empty completion');
    return content;
  }
}

/* -------------------------------------------------------------------------- */
/*  Gemini native                                                             */
/* -------------------------------------------------------------------------- */

interface GmPart {
  text?: string;
  functionCall?: { name?: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  inline_data?: { mime_type: string; data: string };
}
interface GmResponse {
  candidates?: { content?: { parts?: GmPart[] } }[];
  promptFeedback?: { blockReason?: string };
}

class GeminiTransport implements AiTransport {
  readonly kind = 'gemini';
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly groqKey: string | null
  ) {}

  private url(model: string): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
  }

  private convert(messages: AiChatMessage[]): { system: string; contents: unknown[] } {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => (m as { content: string }).content)
      .join('\n\n');
    const contents: unknown[] = [];
    for (const m of messages) {
      if (m.role === 'system') continue;
      if (m.role === 'user') contents.push({ role: 'user', parts: [{ text: m.content }] });
      else if (m.role === 'assistant') {
        const parts: GmPart[] = [];
        if (m.content) parts.push({ text: m.content });
        for (const c of m.toolCalls ?? []) parts.push({ functionCall: { name: c.name, args: c.args } });
        if (parts.length) contents.push({ role: 'model', parts });
      } else {
        let response: Record<string, unknown>;
        try {
          const v = JSON.parse(m.content) as unknown;
          response = v && typeof v === 'object' ? (v as Record<string, unknown>) : { result: v };
        } catch {
          response = { result: m.content };
        }
        contents.push({ role: 'user', parts: [{ functionResponse: { name: m.name, response } }] });
      }
    }
    return { system, contents };
  }

  private async generate(model: string, body: Record<string, unknown>): Promise<GmPart[]> {
    const res = await doFetch(this.url(model), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json()) as GmResponse;
    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts) throw new AiError('failed', data.promptFeedback?.blockReason ?? 'empty completion');
    return parts;
  }

  async chat(messages: AiChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const { system, contents } = this.convert(messages);
    const parts = await this.generate(opts.model ?? this.model, {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        maxOutputTokens: opts.maxTokens ?? MAX_OUTPUT_TOKENS,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    });
    const text = parts.map((p) => p.text ?? '').join('').trim();
    if (!text) throw new AiError('failed', 'empty completion');
    return text;
  }

  async chatTools(messages: AiChatMessage[], tools: ToolSpec[], opts: ChatOptions = {}): Promise<ChatToolsResult> {
    const { system, contents } = this.convert(messages);
    const parts = await this.generate(opts.model ?? this.model, {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
      generationConfig: { temperature: opts.temperature ?? 0, maxOutputTokens: opts.maxTokens ?? TOOL_MAX_TOKENS },
    });
    const toolCalls: ToolCall[] = parts
      .filter((p) => p.functionCall?.name)
      .map((p, i) => ({ id: `call_${i}`, name: p.functionCall!.name!, args: parseArgs(p.functionCall!.args) }));
    const content = parts.map((p) => p.text ?? '').join('').trim();
    return { content: content || null, toolCalls };
  }

  async transcribe(file: AudioFile, opts: TranscribeOptions = {}): Promise<string> {
    const data = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
    const lang =
      opts.language === 'ur'
        ? 'The speaker is speaking Urdu; write Urdu in Urdu script.'
        : 'The speaker mixes Urdu and English (Roman Urdu is fine).';
    try {
      const parts = await this.generate(this.model, {
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: file.type === 'audio/m4a' ? 'audio/mp4' : file.type, data } },
              { text: `Transcribe this short voice note verbatim. ${lang} Output only the transcript, no quotes.${opts.prompt ? ` Names that may appear: ${opts.prompt}` : ''}` },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 200 },
      });
      return parts.map((p) => p.text ?? '').join('').trim();
    } catch (e) {
      // Gemini audio failed: try Groq Whisper when a key is saved.
      if (!this.groqKey) throw e;
      const t = new OpenAiCompatTransport('groq', 'https://api.groq.com/openai/v1', this.groqKey, this.model, {}, { voiceModel: GROQ_WHISPER });
      return t.transcribe(file, opts);
    }
  }

  async vision(imageBase64: string, prompt: string, opts: ChatOptions = {}): Promise<string> {
    const parts = await this.generate(opts.model ?? this.model, {
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }, { text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: opts.maxTokens ?? MAX_OUTPUT_TOKENS,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    });
    const text = parts.map((p) => p.text ?? '').join('').trim();
    if (!text) throw new AiError('failed', 'empty completion');
    return text;
  }
}

/** A one-line round trip to verify a provider setup from Settings. */
export async function testConnection(): Promise<string> {
  const t = getAiTransport();
  const reply = await t.chat([{ role: 'user', content: 'Reply with exactly: OK' }], { maxTokens: 5, temperature: 0 });
  return reply.trim().slice(0, 40);
}
