import { useSettingsStore } from '@/stores/useSettingsStore';

import { GROQ_BASE_URL, GROQ_MODELS, MAX_OUTPUT_TOKENS } from './models';
import {
  AiError,
  type AiChatMessage,
  type AiTransport,
  type AudioFile,
  type ChatOptions,
  type TranscribeOptions,
} from './types';

/**
 * The one door to any AI provider.
 *
 *   Settings.aiProxyUrl set → ProxyTransport (keys live on the server; the
 *                             app sends an app token + anonymous device id).
 *   else Settings.aiGroqKey → GroqTransport (developer / self-host: the
 *                             user's own key, stored on-device like remove.bg).
 *   else                    → AiError('noProvider').
 *
 * Nothing here touches the database; callers decide what to do with text.
 */

export type ProviderKind = 'proxy' | 'groq' | null;

export interface AiAvailability {
  enabled: boolean;
  provider: ProviderKind;
}

export function aiAvailability(): AiAvailability {
  const s = useSettingsStore.getState();
  return {
    enabled: s.aiEnabled,
    provider: s.aiProxyUrl ? 'proxy' : s.aiGroqKey ? 'groq' : null,
  };
}

/** Resolve the configured transport or throw a coded error. */
export function getAiTransport(): AiTransport {
  const s = useSettingsStore.getState();
  if (!s.aiEnabled) throw new AiError('disabled');
  if (s.aiProxyUrl) return new ProxyTransport(s.aiProxyUrl, s.aiProxyToken, s.aiDeviceId);
  if (s.aiGroqKey) return new GroqTransport(s.aiGroqKey);
  throw new AiError('noProvider');
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

export { chatJson, extractJson } from './json';

/* -------------------------------------------------------------------------- */
/*  Groq — direct (OpenAI-compatible)                                         */
/* -------------------------------------------------------------------------- */

interface OpenAiChatResponse {
  choices?: { message?: { content?: string | null } }[];
}

class GroqTransport implements AiTransport {
  readonly kind = 'groq' as const;
  constructor(private readonly apiKey: string) {}

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  private async completion(body: Record<string, unknown>): Promise<string> {
    const res = await doFetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as OpenAiChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new AiError('failed', 'empty completion');
    return content;
  }

  async chat(messages: AiChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const model = opts.model ?? GROQ_MODELS.text;
    const body = {
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? MAX_OUTPUT_TOKENS,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    };
    try {
      return await this.completion(body);
    } catch (e) {
      // Per-model daily caps: fall through to the secondary model once.
      if (e instanceof AiError && (e.code === 'quota' || e.code === 'failed') && model !== GROQ_MODELS.textFallback) {
        return this.completion({ ...body, model: GROQ_MODELS.textFallback });
      }
      throw e;
    }
  }

  async transcribe(file: AudioFile, opts: TranscribeOptions = {}): Promise<string> {
    const form = new FormData();
    // React Native's FormData accepts a {uri,name,type} file descriptor.
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    form.append('model', GROQ_MODELS.whisper);
    form.append('response_format', 'json');
    form.append('temperature', '0');
    if (opts.language) form.append('language', opts.language);
    if (opts.prompt) form.append('prompt', opts.prompt);
    const res = await doFetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: this.headers(),
      body: form,
    });
    const data = (await res.json()) as { text?: string };
    if (typeof data.text !== 'string') throw new AiError('failed', 'empty transcript');
    return data.text.trim();
  }

  async vision(imageBase64: string, prompt: string, opts: ChatOptions = {}): Promise<string> {
    return this.completion({
      model: opts.model ?? GROQ_MODELS.vision,
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
  }
}

/* -------------------------------------------------------------------------- */
/*  Proxy — the Cloudflare Worker in server/ai-proxy                          */
/* -------------------------------------------------------------------------- */

class ProxyTransport implements AiTransport {
  readonly kind = 'proxy' as const;
  constructor(
    private readonly baseUrl: string,
    private readonly appToken: string | null,
    private readonly deviceId: string
  ) {}

  private headers(json: boolean): Record<string, string> {
    const h: Record<string, string> = { 'x-device-id': this.deviceId };
    if (this.appToken) h['x-app-token'] = this.appToken;
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  async chat(messages: AiChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const res = await doFetch(`${this.baseUrl}/v1/chat`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ messages, json: !!opts.json, model: opts.model, maxTokens: opts.maxTokens, temperature: opts.temperature }),
    });
    const data = (await res.json()) as { content?: string };
    if (typeof data.content !== 'string') throw new AiError('failed', 'empty completion');
    return data.content;
  }

  async transcribe(file: AudioFile, opts: TranscribeOptions = {}): Promise<string> {
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    if (opts.language) form.append('language', opts.language);
    if (opts.prompt) form.append('prompt', opts.prompt);
    const res = await doFetch(`${this.baseUrl}/v1/transcribe`, {
      method: 'POST',
      headers: this.headers(false),
      body: form,
    });
    const data = (await res.json()) as { text?: string };
    if (typeof data.text !== 'string') throw new AiError('failed', 'empty transcript');
    return data.text.trim();
  }

  async vision(imageBase64: string, prompt: string, opts: ChatOptions = {}): Promise<string> {
    const res = await doFetch(`${this.baseUrl}/v1/vision`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ image: imageBase64, prompt, json: !!opts.json, maxTokens: opts.maxTokens }),
    });
    const data = (await res.json()) as { content?: string };
    if (typeof data.content !== 'string') throw new AiError('failed', 'empty completion');
    return data.content;
  }
}
