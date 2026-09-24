import { describe, expect, it } from 'vitest';

import { runAgent } from './agent';
import { anthropicHeaders, parseAnthropicResponse, toAnthropicBody } from './anthropic';
import { lostToolCall, parseOpenAiResponse, toOpenAiBody } from './openai';
import { CLAUDE_DEFAULT_MODEL, MWAPI_BASE_URL } from './providers';
import type { World } from './prompts';
import type { Answer } from './runner';
import { TOOLS, interpretToolCall } from './tools';
import { AiError, type AiChatMessage, type AiTransport, type ChatOptions, type ChatToolsResult, type ToolSpec } from './types';

/**
 * STYLE COMPARISON — the same questions, the same model, the same data, two
 * ways of asking: (A) TameerBook's prompt and summarised tool results, (B) a
 * SubscribAI-style prompt (tool list + four rules) with the FULL answer JSON
 * handed back. Prints both replies so a human can judge which reads better.
 *
 *   TAMEERBOOK_AI_KEY=... npx vitest run src/ai/compare.live.test.ts --reporter=verbose
 */

const KEY = process.env.TAMEERBOOK_AI_KEY ?? '';
const MODEL = process.env.TAMEERBOOK_AI_MODEL ?? CLAUDE_DEFAULT_MODEL;
const BASE = process.env.TAMEERBOOK_AI_BASE ?? MWAPI_BASE_URL;

const world: World = {
  today: new Date().toISOString().slice(0, 10),
  language: 'en',
  company: { name: 'Shahid company', owner: 'Shahid' },
  projects: [
    { id: 'pr1', name: 'Gulberg Greens G-508' },
    { id: 'pr2', name: 'Wapda Town H-101 House' },
  ],
  plots: [{ id: 'pl3', name: 'Gulberg Greens G-508', taken: true }],
  accounts: [
    { id: 'a1', name: 'Cash in Hand' },
    { id: 'a2', name: 'Meezan bank' },
  ],
  categories: [
    { id: 'c0', name: 'Materials', type: 'EXPENSE', unit: null, parentId: null },
    { id: 'c1', name: 'Cement', type: 'EXPENSE', unit: 'bori', parentId: 'c0' },
    { id: 'c2', name: 'Sariya', type: 'EXPENSE', unit: 'kg', parentId: 'c0' },
    { id: 'c4', name: 'Fuel & Transport', type: 'EXPENSE', unit: null, parentId: null },
  ],
  parties: [
    { id: 'p1', name: 'Akram Traders' },
    { id: 'p2', name: 'Rafiq Traders' },
  ],
  workers: [
    { id: 'w1', name: 'Bilal' },
    { id: 'w2', name: 'Ustad Liaqat Malik' },
  ],
  investors: [{ id: 'i1', name: 'Umar' }],
  unpaidOrders: [{ poNumber: 'PO-0016', supplier: 'Rafiq Traders', remaining: 120000 }],
};

const row = (id: string, title: string, amount: number, subtitle = '') => ({ id, title, date: '2026-09-10', subtitle, amount, direction: 'out' as const });

function fakeIntent(intent: { type: string }): Answer {
  switch (intent.type) {
    case 'spend_summary':
      return { title: 'This month', headline: 'Rs 5,52,500', sub: 'Out Rs 5,52,500 · In Rs 0', rows: [row('1', 'Cement 250 bori', 300000), row('2', 'Sariya 1,800 kg', 180000), row('3', 'Diesel', 42500), row('4', 'Bilal wages', 30000)], speak: 'This month: out Rs 5,52,500, in Rs 0' };
    case 'expense_breakdown':
      return { title: 'This month', headline: 'Rs 5,52,500', rows: [row('1', 'Cement', 300000), row('2', 'Sariya', 180000), row('3', 'Fuel & Transport', 42500), row('4', 'Labour', 30000)], speak: 'Cement Rs 3,00,000, Sariya Rs 1,80,000' };
    case 'worker_balance':
      return { title: 'Workers', headline: 'Rs 34,000', sub: '2 workers', rows: [row('w1', 'Bilal', 20000, '18 days · Rs 1,500/day'), row('w2', 'Ustad Liaqat Malik', 14000, '7 days · Rs 2,000/day')], speak: 'Still to pay Rs 34,000 to 2 workers' };
    case 'project_details':
      return {
        title: 'Gulberg Greens G-508',
        headline: 'Rs 61,66,950',
        sub: 'Cost so far',
        rows: [],
        sections: [
          { title: 'Cost', rows: [row('1', 'Plot', 1800000), row('2', 'Construction', 4366950)] },
          { title: 'Materials · this month', rows: [row('m1', 'Cement', 300000, '250 bori'), row('m2', 'Sariya', 180000, '1,800 kg')] },
          { title: 'Investors · Rs 40,00,000', rows: [{ ...row('i1', 'Umar', 4000000), fields: { sharePct: 65, invested: 4000000 } }] },
          { title: 'Workers', rows: [{ ...row('w1', 'Bilal', 20000), fields: { dailyWage: 1500, days: 18, toPay: 20000 } }] },
          { title: 'Orders', rows: [{ ...row('1', 'PO-0016', 120000), fields: { supplier: 'Rafiq Traders', status: 'Pending delivery', toPay: 120000 } }] },
          { title: 'Needs attention', rows: [row('at1', 'Bilal · still to pay Rs 20,000 · 12 days', 20000)] },
        ],
        speak: 'Gulberg Greens G-508: cost Rs 61,66,950',
      };
    default:
      return { title: intent.type, headline: 'Rs 0', rows: [], speak: 'Nothing found.' };
  }
}

const failFor = (status: number, text: string): AiError => new AiError(status === 429 ? 'quota' : status === 401 ? 'badkey' : 'failed', `${status} ${text.slice(0, 160)}`);

async function claude(messages: AiChatMessage[], opts: ChatOptions, tools?: ToolSpec[]): Promise<ChatToolsResult> {
  const body = toAnthropicBody(messages, { model: MODEL, maxTokens: 4096, temperature: opts.temperature, tools });
  const res = await fetch(`${BASE}/messages`, { method: 'POST', headers: anthropicHeaders(KEY), body: JSON.stringify(body) });
  if (!res.ok) throw failFor(res.status, await res.text().catch(() => ''));
  const parsed = parseAnthropicResponse(await res.json());
  if (tools && lostToolCall(parsed)) {
    const b = toOpenAiBody(messages, { model: MODEL, maxTokens: 4096, temperature: opts.temperature, tools });
    const r2 = await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(b) });
    const r = parseOpenAiResponse(await r2.json());
    if (!r) throw new AiError('failed', 'empty');
    return r;
  }
  return parsed;
}

const transport: AiTransport = {
  kind: 'compare',
  async chat(messages, opts = {}) {
    return (await claude(messages, { temperature: 0.2, ...opts })).content ?? '';
  },
  chatTools(messages, tools, opts = {}) {
    return claude(messages, { temperature: 0, ...opts }, tools);
  },
  async transcribe() {
    return '';
  },
  async vision() {
    return '';
  },
};

/** Style B: SubscribAI's prompt shape, applied to TameerBook's tools. */
const SUBSCRIBAI_STYLE = `You are the TameerBook Executive AI Assistant.
You have FULL ACCESS to live ledger tools to help a Pakistani builder manage the business: money in and out, projects, plots, workers (dihari), suppliers, purchase orders, investors, loans (udhaar).

Tools: ${TOOLS.map((t) => `${t.name}: ${t.description}`).join('\n')}

The user's names: projects ${world.projects.map((p) => p.name).join(', ')}; accounts ${world.accounts.map((a) => a.name).join(', ')}; suppliers ${world.parties.map((p) => p.name).join(', ')}; workers ${world.workers.map((w) => w.name).join(', ')}.

CRITICAL INSTRUCTIONS:
1. ALWAYS execute tools immediately when requested. When asked for figures, fetch them directly.
2. Keep responses concise, professional, structured, and friendly. Reply in the language the user wrote in (Roman Urdu stays Roman Urdu).
3. Use *bold* for key figures. Amounts as Rs 5,52,500.`;

async function styleB(text: string): Promise<{ text: string; calls: number }> {
  const messages: AiChatMessage[] = [{ role: 'system', content: SUBSCRIBAI_STYLE }, { role: 'user', content: text }];
  for (let call = 1; call <= 5; call++) {
    const r = await claude(messages, {}, TOOLS);
    if (r.toolCalls.length === 0) return { text: r.content ?? '', calls: call };
    messages.push({ role: 'assistant', content: r.content, toolCalls: r.toolCalls });
    for (const tc of r.toolCalls) {
      const action = interpretToolCall(tc);
      const content =
        action.kind === 'read' ? JSON.stringify(fakeIntent(action.intent)) : action.kind === 'write' ? JSON.stringify({ success: true, saved: action.draft, message: 'Saved to the ledger.' }) : JSON.stringify({ ok: true });
      messages.push({ role: 'tool', toolCallId: tc.id, name: tc.name, content });
    }
  }
  return { text: '(no answer)', calls: 5 };
}

const QUESTIONS = ['is mahine kitna kharcha hua', 'kin mazdooron ke paise dene hain', 'tell me everything about Gulberg Greens G-508', 'Akram se 50 bori cement 1250 wala liya Gulberg Greens ke liye'];

describe.skipIf(!KEY)('style comparison', () => {
  it(
    'prints both styles for each question',
    async () => {
      for (const q of QUESTIONS) {
        const a = await runAgent(q, { transport, world, runIntent: async (intent) => fakeIntent(intent), prompt: { language: /kitna|kin |liya/.test(q) ? 'roman' : 'en' } });
        const b = await styleB(q);
        console.log(`\n==================== ${q}\n--- A (TameerBook prompt, ${a.calls} calls, cards: ${a.cards.length}, drafts: ${a.drafts.length})\n${a.text}${a.options.length ? `\nOPTIONS: ${a.options.join(' | ')}` : ''}${a.suggestions.length ? `\nSUGGEST: ${a.suggestions.join(' | ')}` : ''}\n--- B (SubscribAI-style prompt, ${b.calls} calls)\n${b.text}\n`);
      }
      expect(true).toBe(true);
    },
    10 * 60_000
  );
});
