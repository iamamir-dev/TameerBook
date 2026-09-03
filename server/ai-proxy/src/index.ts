/**
 * TameerBook AI proxy — a Cloudflare Worker (free plan) that holds the
 * provider keys so the app never ships one. Three routes, all POST:
 *
 *   /v1/chat/completions   OpenAI chat body (tools supported)              → OpenAI response
 *   /v1/audio/transcriptions  multipart: file, language?, prompt?           → { text }
 *   /v1/vision      { image (base64 jpeg), prompt, json?, maxTokens? }     → { content }
 *
 * Provider order: Groq (free, no training on data) → Workers AI (free
 * neurons, no training on data). Each device is rate-limited via the
 * RATE_LIMITER binding; an optional shared APP_TOKEN raises the bar for
 * casual abuse. No request bodies are logged or stored.
 */

export interface Env {
  GROQ_API_KEY: string;
  /** Optional shared secret the app sends as `x-app-token`. */
  APP_TOKEN?: string;
  /** Workers AI binding (fallback). */
  AI?: Ai;
  /** Rate limiting binding (per device id). */
  RATE_LIMITER?: RateLimit;
  /** Comma-separated allowed origins for CORS (optional; mobile apps send none). */
  ALLOWED_ORIGINS?: string;
}

const GROQ = 'https://api.groq.com/openai/v1';
const MODELS = {
  text: 'openai/gpt-oss-120b',
  textFallback: 'qwen/qwen3.6-27b',
  vision: 'qwen/qwen3.6-27b',
  whisper: 'whisper-large-v3-turbo',
  cfText: '@cf/google/gemma-4-26b-a4b-it',
  cfVision: '@cf/meta/llama-3.2-11b-vision-instruct',
  cfWhisper: '@cf/openai/whisper-large-v3-turbo',
} as const;

const MAX_BODY_BYTES = 6 * 1024 * 1024; // audio + images stay small (the app compresses)
const MAX_OUTPUT_TOKENS = 900;

type Json = Record<string, unknown>;

const json = (body: Json, status = 200, extra: HeadersInit = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } });

class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'POST only');
      await authorize(req, env);
      const url = new URL(req.url);
      const len = Number(req.headers.get('content-length') ?? 0);
      if (len > MAX_BODY_BYTES) throw new HttpError(413, 'body too large');

      switch (url.pathname) {
        case '/v1/chat':
        case '/v1/chat/completions':
          return json(await chat(req, env), 200, cors);
        case '/v1/transcribe':
        case '/v1/audio/transcriptions':
          return json(await transcribe(req, env), 200, cors);
        case '/v1/vision':
          return json(await vision(req, env), 200, cors);
        case '/health':
          return json({ ok: true }, 200, cors);
        default:
          throw new HttpError(404, 'not found');
      }
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status, cors);
      return json({ error: 'upstream failed' }, 502, cors);
    }
  },
} satisfies ExportedHandler<Env>;

/* -------------------------------------------------------------------------- */
/*  Auth + quota                                                              */
/* -------------------------------------------------------------------------- */

async function authorize(req: Request, env: Env): Promise<void> {
  if (env.APP_TOKEN && req.headers.get('x-app-token') !== env.APP_TOKEN) throw new HttpError(401, 'bad app token');
  const device = req.headers.get('x-device-id');
  if (!device || device.length < 8 || device.length > 64) throw new HttpError(400, 'missing device id');
  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({ key: device });
    if (!success) throw new HttpError(429, 'device quota reached');
  }
}

function corsHeaders(req: Request, env: Env): HeadersInit {
  const origin = req.headers.get('origin');
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || (allowed.length && !allowed.includes(origin))) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-app-token, x-device-id',
  };
}

/* -------------------------------------------------------------------------- */
/*  Groq                                                                      */
/* -------------------------------------------------------------------------- */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: unknown;
}

interface OaChoice {
  message?: { content?: string | null; tool_calls?: unknown[] };
}

async function groqRaw(env: Env, body: Json): Promise<{ choices?: OaChoice[] }> {
  const res = await fetch(`${GROQ}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new HttpError(res.status === 429 ? 429 : 502, `groq ${res.status}`);
  const data = (await res.json()) as { choices?: OaChoice[] };
  if (!data.choices?.[0]?.message) throw new HttpError(502, 'empty completion');
  return data;
}

async function groqCompletion(env: Env, body: Json): Promise<string> {
  const data = await groqRaw(env, body);
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new HttpError(502, 'empty completion');
  return content;
}

async function chat(req: Request, env: Env): Promise<Json> {
  const b = (await req.json()) as {
    messages?: ChatMessage[];
    json?: boolean;
    model?: string;
    max_tokens?: number;
    maxTokens?: number;
    temperature?: number;
    tools?: unknown[];
    tool_choice?: unknown;
    response_format?: unknown;
  };
  if (!Array.isArray(b.messages) || b.messages.length === 0) throw new HttpError(400, 'messages required');
  const base = {
    messages: b.messages,
    temperature: clamp(b.temperature ?? 0.2, 0, 1),
    max_tokens: clamp(b.max_tokens ?? b.maxTokens ?? MAX_OUTPUT_TOKENS, 1, MAX_OUTPUT_TOKENS),
    ...(b.json || b.response_format ? { response_format: b.response_format ?? { type: 'json_object' } } : {}),
    ...(Array.isArray(b.tools) && b.tools.length ? { tools: b.tools, tool_choice: b.tool_choice ?? 'auto' } : {}),
  };
  const model = b.model && (b.model.startsWith('openai/') || b.model.startsWith('qwen/') || b.model.startsWith('llama')) ? b.model : MODELS.text;
  // The app speaks the OpenAI shape end-to-end, so return it as-is (tool_calls included).
  try {
    return await groqRaw(env, { ...base, model });
  } catch (first) {
    // Per-model daily caps on the free tier: try the second Groq model, then Workers AI (text only).
    try {
      return await groqRaw(env, { ...base, model: MODELS.textFallback });
    } catch {
      if (!env.AI) throw first;
      const out = (await env.AI.run(MODELS.cfText as never, {
        messages: b.messages.map((m) => ({ role: m.role, content: String(m.content ?? '') })),
        max_tokens: base.max_tokens,
        temperature: base.temperature,
      } as never)) as { response?: string };
      if (typeof out.response !== 'string') throw new HttpError(502, 'empty completion');
      return { choices: [{ message: { content: out.response } }] };
    }
  }
}

async function transcribe(req: Request, env: Env): Promise<Json> {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'file required');
  const upstream = new FormData();
  upstream.append('file', file, file.name || 'speech.m4a');
  upstream.append('model', MODELS.whisper);
  upstream.append('response_format', 'json');
  upstream.append('temperature', '0');
  const language = form.get('language');
  const prompt = form.get('prompt');
  if (typeof language === 'string' && language) upstream.append('language', language.slice(0, 5));
  if (typeof prompt === 'string' && prompt) upstream.append('prompt', prompt.slice(0, 1000));

  const res = await fetch(`${GROQ}/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: upstream,
  });
  if (res.ok) {
    const data = (await res.json()) as { text?: string };
    return { text: (data.text ?? '').trim() };
  }
  if (!env.AI) throw new HttpError(res.status === 429 ? 429 : 502, `groq ${res.status}`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const out = (await env.AI.run(MODELS.cfWhisper as never, { audio: Array.from(bytes) } as never)) as { text?: string };
  return { text: (out.text ?? '').trim() };
}

async function vision(req: Request, env: Env): Promise<Json> {
  const b = (await req.json()) as { image?: string; prompt?: string; json?: boolean; maxTokens?: number };
  if (!b.image || !b.prompt) throw new HttpError(400, 'image and prompt required');
  const body = {
    model: MODELS.vision,
    temperature: 0.1,
    max_tokens: clamp(b.maxTokens ?? MAX_OUTPUT_TOKENS, 1, MAX_OUTPUT_TOKENS),
    ...(b.json ? { response_format: { type: 'json_object' } } : {}),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: b.prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b.image}` } },
        ],
      },
    ],
  };
  try {
    return { content: await groqCompletion(env, body) };
  } catch (first) {
    if (!env.AI) throw first;
    const bytes = Uint8Array.from(atob(b.image), (c) => c.charCodeAt(0));
    const out = (await env.AI.run(MODELS.cfVision as never, {
      prompt: b.prompt,
      image: Array.from(bytes),
      max_tokens: body.max_tokens,
    } as never)) as { description?: string; response?: string };
    const content = out.response ?? out.description;
    if (typeof content !== 'string') throw new HttpError(502, 'empty completion');
    return { content };
  }
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
