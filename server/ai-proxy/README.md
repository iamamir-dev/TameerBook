# TameerBook AI proxy

A tiny Cloudflare Worker that keeps the AI keys off the phone. The app sends
text, audio and receipt photos here; the Worker forwards them to **Claude**
(through the MWAPI gateway, the same model SubscribAI runs on) and, for voice
or when the user picks a GPT model, to **OpenAI**. Nothing is logged or stored.

Cost: the Cloudflare free plan (100,000 requests/day) plus whatever the
gateway and OpenAI bill for tokens.

## Deploy (10 minutes)

1. Get a Claude gateway key (MWAPI) and, for voice, an OpenAI key.
2. Install wrangler and log in:
   ```bash
   cd server/ai-proxy
   npm install
   npx wrangler login
   ```
3. Put the secrets (never commit them):
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler secret put OPENAI_API_KEY      # optional, needed for voice
   npx wrangler secret put APP_TOKEN           # any long random string
   ```
4. Deploy:
   ```bash
   npm run deploy
   ```
   Wrangler prints a URL like `https://tameerbook-ai.<you>.workers.dev`.
5. In the app: Settings → Assistant (AI) → provider **My server**, paste the
   URL into **Assistant server URL** and the same random string into **Server
   app token**.

## Routes

| Route | Body | Returns |
|---|---|---|
| `POST /v1/messages` | Anthropic Messages body (`model`, `system`, `messages`, `tools`…) | Anthropic-shaped response |
| `POST /v1/chat/completions` | OpenAI chat body | OpenAI-shaped response |
| `POST /v1/audio/transcriptions` | multipart `file`, `language?`, `prompt?` | `{ text }` |
| `GET /health` | – | `{ ok: true }` |

The app picks the route from the model id: `claude-*` goes to `/v1/messages`,
`gpt-*` to `/v1/chat/completions`. Every request needs `x-device-id` (the app
generates one per install) and, when `APP_TOKEN` is set, `x-app-token`.

## Quotas

`wrangler.toml` limits each device to 60 requests per minute. Output is capped
at 8,192 tokens per call (the app asks for 4,096). A 429 from upstream reaches
the app as a 429, which it shows as "limit used up, try later".

## Testing without a server

For development the app can call the gateway directly with a key pasted into
Settings → **API key** (provider Claude). Never ship a build with a key baked in.
