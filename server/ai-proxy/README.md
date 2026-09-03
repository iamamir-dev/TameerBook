# TameerBook AI proxy

A tiny Cloudflare Worker that keeps the AI provider keys off the phone. The app
sends text, audio and receipt photos here; the Worker forwards them to **Groq**
(free tier, does not train on your data) and falls back to **Cloudflare Workers
AI** (free neurons, also no training). Nothing is logged or stored.

Cost: **Rs 0** on the Cloudflare free plan (100,000 requests/day) and Groq's
free tier (about 1,000 text requests and 8 audio hours per model per day).

## Deploy (10 minutes)

1. Get a free Groq key at https://console.groq.com.
2. Install wrangler and log in:
   ```bash
   cd server/ai-proxy
   npm install
   npx wrangler login
   ```
3. Put the secrets (never commit them):
   ```bash
   npx wrangler secret put GROQ_API_KEY
   npx wrangler secret put APP_TOKEN      # any long random string
   ```
4. Deploy:
   ```bash
   npm run deploy
   ```
   Wrangler prints a URL like `https://tameerbook-ai.<you>.workers.dev`.
5. In the app: Settings → Assistant (AI) → turn on **AI helpers**, paste the
   URL into **Assistant server URL** and the same random string into **Server
   app token**.

## Routes

| Route | Body | Returns |
|---|---|---|
| `POST /v1/chat` | `{ messages, json?, model?, maxTokens?, temperature? }` | `{ content }` |
| `POST /v1/transcribe` | multipart `file`, `language?`, `prompt?` | `{ text }` |
| `POST /v1/vision` | `{ image (base64 JPEG), prompt, json?, maxTokens? }` | `{ content }` |
| `POST /health` | – | `{ ok: true }` |

Every request needs `x-device-id` (the app generates one per install) and, when
`APP_TOKEN` is set, `x-app-token`.

## Quotas

`wrangler.toml` limits each device to 60 requests per minute. Groq's free
per-model daily caps are handled by falling back to a second Groq model, then
to Workers AI. When everything is exhausted the app shows "free AI limit used
up, try later" instead of failing silently.

## Testing without a server

For development the app can call Groq directly with a key pasted into
Settings → **Groq API key (advanced)**. Never ship a build with a key baked in.
