# Assistant Module — Plan

One AI module ("Assistant" / معاون) that absorbs voice entry, bill reading, spoken
summaries, ledger questions and proactive suggestions. Follows the 8 restructure
rules + DESIGN_GUIDELINES. Every phase is `tsc + vitest` green and one commit.

## Principles (decided 2026-09-03)
- **Every API free.** Groq (text + Whisper + Qwen vision; no training on data) is the
  primary provider. Cloudflare Workers AI is the fallback inside the proxy. No Gemini
  by default (its free tier trains on data).
- **No key in the app bundle.** Production traffic goes through a Cloudflare Worker
  (free plan) in `server/ai-proxy/`. For development / self-hosting the user may
  paste their own Groq key in Settings (same pattern as the remove.bg key).
- **The model never writes to the database.** Drafts land on the existing confirm
  screens via `EntryPrefill` / new prefill params. Questions map to a fixed intent
  catalogue that calls existing repository queries — no raw SQL from the model.
- **Offline first.** Insights are pure SQL and always work. AI actions show a plain
  "needs internet / enable in Settings" state, never a spinner.
- **Opt-in.** `aiEnabled` defaults OFF; Settings explains what leaves the phone.
- **Minimal data.** Prompts carry names of projects/accounts/categories/parties/
  workers (needed to resolve ids) but never phones, CNICs or bank details.

## Layout
```
src/ai/                      horizontal layer (like src/db)
  types.ts   models.ts   client.ts (proxy | direct Groq)   context.ts (world snapshot)
  prompts.ts intents.ts  drafts.ts  runner.ts  narrate.ts  index.ts   *.test.ts
src/db/repositories/insights.ts   offline suggestion engine + last-rate lookup
src/utils/insights.ts             pure ranking/formatting (vitest)
src/modules/assistant/{screens,components,hooks,utils,styled}
server/ai-proxy/                  Cloudflare Worker (wrangler), excluded from root tsc
```

## Phases
- [x] **0 Plan** (this file)
- [x] **1 Insights (offline).** `insights.ts` repo: worker owed >30d, duplicate entry
      today, material rate outlier (>50% vs median of last 5), transfer deadline ≤7d,
      buyer outstanding with no receipt 30d, stale udhaar 60d, PO undelivered 14d,
      construction spend spike (>1.5× last month). `getLastMaterialRate()`.
      Pure `utils/insights.ts` (rank + severity) with tests. Home "Assistant" card
      (top 3 insights + Ask button). MaterialEntry last-rate hint (tap to fill).
- [x] **2 AI layer.** Settings store keys (`aiEnabled`, `aiSpeak`, `aiProxyUrl`,
      `aiGroqKey`). `client.ts` with coded errors. `context.ts`. Pure `intents.ts`
      (catalogue + validation + period resolution), `drafts.ts` (name→id fuzzy
      resolve, draft→prefill), `prompts.ts`, `narrate.ts` template fallback — all
      unit-tested. `runner.ts` over existing repos.
- [x] **3 Assistant screen.** Route `Assistant`. Turns list, suggestion chips,
      composer. Answer card (LedgerTable + stat), Draft card (Open form), text turn.
      Settings → Assistant section. Quick Entry tile. Home card "Ask".
- [x] **4 Voice.** `expo-audio` recording → Groq Whisper (via proxy) → same
      pipeline. Spoken answers via `expo-speech` (device Urdu voice when present).
- [x] **5 Read the bill.** Receipt photo → Groq Qwen vision → BillDraft →
      MaterialEntry prefill (single line) / NewPurchaseOrder prefill (multi line).
- [ ] **6 Proxy.** `server/ai-proxy`: `/v1/chat`, `/v1/transcribe`, `/v1/vision`;
      app-token header, per-device rate limit binding, Groq → Workers AI fallback.
      README with deploy steps.
- [ ] **7 Audit.** DB tests for insights in `src/db/tests.ts`; token sweep; dead code.

## Route / param additions
- `Assistant: { seed?: string } | undefined`
- `MaterialEntry: { prefill?: MaterialPrefill } | undefined`
- `NewPurchaseOrder: { poId?: string; prefill?: PurchaseOrderPrefill } | undefined`
