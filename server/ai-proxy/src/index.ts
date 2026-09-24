/**
 * TameerBook AI proxy — a Cloudflare Worker (free plan) that holds the
 * provider keys so the app never ships one. Three routes, all POST:
 *
 *   /v1/messages              Anthropic Messages body (tools, images)  → Claude via the gateway
 *   /v1/chat/completions      OpenAI chat body (tools)                 → OpenAI
 *   /v1/audio/transcriptions  multipart: file, language?, prompt?     → OpenAI transcription → { text }
 *
 * Claude answers text and tools; OpenAI is the second engine and the only
 * voice engine (Claude has no audio endpoint). Each device is rate-limited
 * via the RATE_LIMITER binding; an optional shared APP_TOKEN raises the bar
 * for casual abuse. No request bodies are logged or stored.
 */

export interface Env {
  /** Key for the Claude gateway (MWAPI or api.anthropic.com). */
  ANTHROPIC_API_KEY: string;
  /** Anthropic-shaped base URL; defaults to MWAPI, the gateway SubscribAI uses. */
  ANTHROPIC_BASE_URL?: string;
  /** Optional: enables /v1/chat/completions and voice. */
  OPENAI_API_KEY?: string;
  /** Optional shared secret the app sends as `x-app-token`. */
  APP_TOKEN?: string;
  /** Rate limiting binding (per device id). */
  RATE_LIMITER?: RateLimit;
  /** Comma-separated allowed origins for CORS (optional; mobile apps send none). */
  ALLOWED_ORIGINS?: string;
}

const MWAPI = 'https://api.mwapi.dev/v1';
const OPENAI = 'https://api.openai.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';

const MAX_BODY_BYTES = 6 * 1024 * 1024; // audio + images stay small (the app compresses)
/** Hard ceiling on what one call may generate; the app asks for 4,096. */
const MAX_OUTPUT_TOKENS = 8192;
const UPSTREAM_TIMEOUT_MS = 90_000;

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
      const url = new URL(req.url);
      if (url.pathname === '/health') return json({ ok: true }, 200, cors);
      if (req.method !== 'POST') throw new HttpError(405, 'POST only');
      await authorize(req, env);
      const len = Number(req.headers.get('content-length') ?? 0);
      if (len > MAX_BODY_BYTES) throw new HttpError(413, 'body too large');

      switch (url.pathname) {
        case '/v1/messages':
          return withCors(await claude(req, env), cors);
        case '/v1/chat':
        case '/v1/chat/completions':
          return withCors(await openaiChat(req, env), cors);
        case '/v1/transcribe':
        case '/v1/audio/transcriptions':
          return json(await transcribe(req, env), 200, cors);
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

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('origin');
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || allowed.length === 0 || !allowed.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-app-token, x-device-id, anthropic-version',
  };
}

const withCors = (res: Response, cors: Record<string, string>): Response => {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
};

/**
 * Forward a JSON body upstream and hand the reply back with the status the
 * app expects: 429 stays 429 (quota), a server-side auth failure becomes 502
 * (the key is the server's problem, not the user's), everything else passes.
 */
async function forward(url: string, headers: HeadersInit, body: Json): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 403) throw new HttpError(502, 'server key rejected upstream');
  const text = await res.text();
  return new Response(text, { status: res.ok ? 200 : res.status, headers: { 'content-type': 'application/json' } });
}

/* -------------------------------------------------------------------------- */
/*  Claude (Messages API)                                                     */
/* -------------------------------------------------------------------------- */

async function claude(req: Request, env: Env): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) throw new HttpError(503, 'claude not configured');
  const b = (await req.json()) as Json;
  if (!Array.isArray(b.messages) || b.messages.length === 0) throw new HttpError(400, 'messages required');
  const model = typeof b.model === 'string' && b.model.startsWith('claude') ? b.model : 'claude-sonnet-4-6';
  const body: Json = {
    ...b,
    model,
    max_tokens: clamp(Number(b.max_tokens ?? 4096), 1, MAX_OUTPUT_TOKENS),
    stream: false,
  };
  const base = (env.ANTHROPIC_BASE_URL || MWAPI).replace(/\/+$/, '');
  return forward(`${base}/messages`, { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': ANTHROPIC_VERSION }, body);
}

/* -------------------------------------------------------------------------- */
/*  OpenAI                                                                    */
/* -------------------------------------------------------------------------- */

async function openaiChat(req: Request, env: Env): Promise<Response> {
  if (!env.OPENAI_API_KEY) throw new HttpError(503, 'openai not configured');
  const b = (await req.json()) as Json;
  if (!Array.isArray(b.messages) || b.messages.length === 0) throw new HttpError(400, 'messages required');
  const model = typeof b.model === 'string' && /^(gpt-|o\d)/.test(b.model) ? b.model : 'gpt-5-mini';
  const body: Json = { ...b, model, stream: false };
  if (typeof b.max_tokens === 'number') body.max_tokens = clamp(b.max_tokens, 1, MAX_OUTPUT_TOKENS);
  if (typeof b.max_completion_tokens === 'number') body.max_completion_tokens = clamp(b.max_completion_tokens, 1, MAX_OUTPUT_TOKENS);
  return forward(`${OPENAI}/chat/completions`, { authorization: `Bearer ${env.OPENAI_API_KEY}` }, body);
}

async function transcribe(req: Request, env: Env): Promise<Json> {
  if (!env.OPENAI_API_KEY) throw new HttpError(503, 'voice not configured');
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'file required');
  const upstream = new FormData();
  upstream.append('file', file, file.name || 'speech.m4a');
  upstream.append('model', TRANSCRIBE_MODEL);
  upstream.append('response_format', 'json');
  const language = form.get('language');
  const prompt = form.get('prompt');
  if (typeof language === 'string' && language) upstream.append('language', language.slice(0, 5));
  if (typeof prompt === 'string' && prompt) upstream.append('prompt', prompt.slice(0, 1000));

  const res = await fetch(`${OPENAI}/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: upstream,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) throw new HttpError(res.status === 429 ? 429 : 502, `openai ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return { text: (data.text ?? '').trim() };
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
