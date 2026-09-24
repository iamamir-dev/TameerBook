import { describe, expect, it } from 'vitest';

import { EVAL_CASES, judge, runEvals, type EvalResult } from './evals';
import { matchName, suggestNames } from './match';
import type { Answer } from './runner';
import type { World } from './prompts';
import { anthropicHeaders, parseAnthropicResponse, toAnthropicBody } from './anthropic';
import { lostToolCall, parseOpenAiResponse, toOpenAiBody } from './openai';
import { CLAUDE_DEFAULT_MODEL, MWAPI_BASE_URL, OPENAI_BASE_URL, OPENAI_DEFAULT_MODEL } from './providers';
import type { AiChatMessage, AiTransport, ChatOptions, ChatToolsResult, ToolCall, ToolSpec } from './types';
import { AiError } from './types';

/**
 * LIVE EVALS — the behaviour suite against a REAL model, from the laptop.
 *
 *   TAMEERBOOK_AI_KEY=sk-... npx vitest run src/ai/live.test.ts --reporter=verbose   (Claude via MWAPI)
 *   (without --reporter=verbose a fully passing run prints no per-case table)
 *   TAMEERBOOK_AI_PROVIDER=openai TAMEERBOOK_AI_KEY=sk-... npm test -- src/ai/live.test.ts
 *
 * Skipped without a key, so `npm test` stays offline and free. The ledger is
 * stubbed (see `fakeIntent`), so this measures exactly what the prompt and
 * the tool schemas control: WHICH tool the model reaches for, WHICH language
 * it answers in, and HOW it writes. The on-device runner (Dev Tools →
 * Assistant eval) covers the same cases against real data.
 *
 * Env: TAMEERBOOK_AI_KEY (required), TAMEERBOOK_AI_PROVIDER (claude | openai,
 * default claude), TAMEERBOOK_AI_MODEL, TAMEERBOOK_AI_BASE, TAMEERBOOK_AI_ONLY
 * (comma-separated case ids).
 */

const KEY = process.env.TAMEERBOOK_AI_KEY ?? '';
const PROVIDER = process.env.TAMEERBOOK_AI_PROVIDER === 'openai' ? 'openai' : 'claude';
const MODEL = process.env.TAMEERBOOK_AI_MODEL ?? (PROVIDER === 'openai' ? OPENAI_DEFAULT_MODEL : CLAUDE_DEFAULT_MODEL);
const BASE = process.env.TAMEERBOOK_AI_BASE ?? (PROVIDER === 'openai' ? OPENAI_BASE_URL : MWAPI_BASE_URL);
const ONLY = (process.env.TAMEERBOOK_AI_ONLY ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
/** TAMEERBOOK_AI_DEBUG=1 prints every raw reply (to see what an empty completion actually was). */
const DEBUG = !!process.env.TAMEERBOOK_AI_DEBUG;

/** A world shaped like the demo dataset (Dev Tools → Load demo data). */
const world: World = {
  today: new Date().toISOString().slice(0, 10),
  language: 'en',
  company: { name: 'Sufder Company', owner: 'Safdar' },
  projects: [
    { id: 'pr1', name: 'Gulberg Greens G-508' },
    { id: 'pr2', name: 'Wapda Town H-101 House' },
  ],
  plots: [
    { id: 'pl1', name: 'Bahria Town C-123', taken: false },
    { id: 'pl2', name: 'Park View B-506', taken: false },
    { id: 'pl3', name: 'Gulberg Greens G-508', taken: true },
  ],
  accounts: [
    { id: 'a1', name: 'Cash in Hand' },
    { id: 'a2', name: 'Meezan bank' },
  ],
  categories: [
    { id: 'c0', name: 'Materials', type: 'EXPENSE', unit: null, parentId: null },
    { id: 'c1', name: 'Cement', type: 'EXPENSE', unit: 'bori', parentId: 'c0' },
    { id: 'c2', name: 'Sariya', type: 'EXPENSE', unit: 'kg', parentId: 'c0' },
    { id: 'c3', name: 'Bajri', type: 'EXPENSE', unit: 'ft', parentId: 'c0' },
    { id: 'c4', name: 'Fuel & Transport', type: 'EXPENSE', unit: null, parentId: null },
    { id: 'c5', name: 'Food', type: 'EXPENSE', unit: null, parentId: null },
    { id: 'c6', name: 'Other Income', type: 'INCOME', unit: null, parentId: null },
  ],
  parties: [
    { id: 'p1', name: 'Akram Traders' },
    { id: 'p2', name: 'Rafiq Traders' },
  ],
  workers: [
    { id: 'w1', name: 'Bilal' },
    { id: 'w2', name: 'Ustad Liaqat Malik' },
    { id: 'w3', name: 'Zulfiqar Ahmed' },
  ],
  investors: [{ id: 'i1', name: 'Umar' }],
  unpaidOrders: [{ poNumber: 'PO-0016', supplier: 'Rafiq Traders', remaining: 120000 }],
};

/** Plausible ledger answers, so the model has real numbers to write from. */
function fakeIntent(intent: { type: string } & Record<string, unknown>): Answer {
  const row = (id: string, title: string, amount: number, subtitle = '') => ({ id, title, date: '2026-09-10', subtitle, amount, direction: 'out' as const });
  // A name the user does not have must come back as not-found with the closest
  // saved names, exactly as the real runner does, or the did-you-mean path is
  // never exercised.
  const worker = typeof intent.worker === 'string' ? intent.worker : undefined;
  if (worker && !matchName(worker, world.workers)) {
    return { title: worker, rows: [], speak: 'Nothing found.', notFound: { what: 'worker', query: worker, candidates: suggestNames(worker, world.workers) } };
  }
  switch (intent.type) {
    case 'spend_summary':
      return { title: 'This month', headline: 'Rs 5,52,500', sub: 'Out Rs 5,52,500 · In Rs 0', rows: [], speak: 'This month: out Rs 5,52,500, in Rs 0' };
    case 'expense_breakdown':
      return { title: 'This month', headline: 'Rs 5,52,500', rows: [row('1', 'Cement', 300000), row('2', 'Sariya', 180000), row('3', 'Fuel & Transport', 72500)], speak: 'Cement Rs 3,00,000, Sariya Rs 1,80,000' };
    case 'account_balance':
      return { title: 'Accounts', headline: 'Rs 49,37,500', sub: '2 accounts', rows: [row('a1', 'Cash in Hand', 4937500), row('a2', 'Meezan bank', 0)], speak: 'Total Rs 49,37,500' };
    case 'purchase_orders':
      return { title: 'Orders · 2', headline: 'Rs 1,20,000', sub: '0 delivered · 2 pending', rows: [row('1', 'PO-0016 · Rafiq Traders', 120000, 'Pending delivery')], speak: '2 orders, 2 pending' };
    case 'worker_balance':
      return { title: 'Workers', headline: 'Rs 34,000', sub: '2 workers', rows: [row('w1', 'Bilal', 20000), row('w2', 'Ustad Liaqat Malik', 14000)], speak: 'Still to pay Rs 34,000 to 2 workers' };
    case 'worker_attendance': {
      // Answer about the worker actually asked for; returning Bilal's calendar
      // for every name made the model report the wrong person.
      const who = worker ? (matchName(worker, world.workers)?.item.name ?? worker) : 'Bilal';
      return { title: `${who} · September`, headline: '18 days', sub: '16 full · 2 half', rows: [], calendar: { month: '2026-09', days: {}, full: 16, half: 2, absent: 3 }, speak: `${who}: 16 full, 2 half, 3 absent` };
    }
    case 'list_entities': {
      const kind = String(intent.entity ?? 'projects');
      const names = kind === 'plots' ? world.plots.filter((p) => !p.taken).map((p) => p.name) : kind === 'workers' ? world.workers.map((w) => w.name) : world.projects.map((p) => p.name);
      return { title: kind, rows: [], list: names.map((n, i) => ({ id: String(i), title: n })), speak: `${names.length} ${kind}` };
    }
    case 'project_details':
      return {
        title: 'Gulberg Greens G-508',
        headline: 'Rs 61,66,950',
        sub: 'Cost so far',
        rows: [],
        sections: [
          { title: 'Cost', rows: [row('1', 'Plot', 1800000), row('2', 'Construction', 4366950)] },
          { title: 'Workers', rows: [{ ...row('w1', 'Bilal', 20000), fields: { dailyWage: 1500, days: 18, toPay: 20000 } }] },
          { title: 'Orders', rows: [{ ...row('1', 'PO-0016', 120000), fields: { supplier: 'Rafiq Traders', status: 'Pending delivery', toPay: 120000 } }] },
        ],
        speak: 'Gulberg Greens G-508: cost Rs 61,66,950',
      };
    case 'project_status':
      return { title: 'Projects', headline: 'Rs 61,66,950', sub: '2 projects', rows: [row('pr1', 'Gulberg Greens G-508', 6166950), row('pr2', 'Wapda Town H-101 House', 1150000)], speak: '2 projects, cost Rs 61,66,950' };
    default:
      return { title: intent.type, headline: 'Rs 0', rows: [], speak: 'Nothing found.' };
  }
}

/** GPT-5 / o-series rename the token cap, fix the temperature and think inside the budget. */
const isOpenAiReasoning = (model: string): boolean => /^(gpt-5|o\d)/.test(model);

const failFor = (status: number, text: string): AiError =>
  new AiError(status === 429 ? 'quota' : status === 401 || status === 403 ? 'badkey' : 'failed', `${status} ${text.slice(0, 160)}`);

/** Claude through the same wire code the app uses (no react-native, no expo), including the gateway fallback. */
function claudeTransport(): AiTransport {
  const compat = async (messages: AiChatMessage[], opts: ChatOptions, tools: ToolSpec[]): Promise<ChatToolsResult> => {
    const body = toOpenAiBody(messages, { model: MODEL, maxTokens: opts.maxTokens ?? 4096, temperature: opts.temperature, tools, json: opts.json });
    const res = await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw failFor(res.status, await res.text().catch(() => ''));
    const data: unknown = await res.json();
    if (DEBUG) console.log(`[live-raw compat] ${JSON.stringify(data).slice(0, 1500)}`);
    const r = parseOpenAiResponse(data);
    if (!r) throw new AiError('failed', 'empty completion');
    return r;
  };
  const call = async (messages: AiChatMessage[], opts: ChatOptions, tools?: ToolSpec[]): Promise<ChatToolsResult> => {
    const body = toAnthropicBody(messages, { model: MODEL, maxTokens: opts.maxTokens ?? 4096, temperature: opts.temperature, tools, json: opts.json });
    const res = await fetch(`${BASE}/messages`, { method: 'POST', headers: anthropicHeaders(KEY), body: JSON.stringify(body) });
    if (!res.ok) throw failFor(res.status, await res.text().catch(() => ''));
    const data: unknown = await res.json();
    if (DEBUG) console.log(`[live-raw] ${JSON.stringify(data).slice(0, 1500)}`);
    const parsed = parseAnthropicResponse(data);
    if (tools && lostToolCall(parsed)) return compat(messages, opts, tools);
    return parsed;
  };
  return {
    kind: 'live-claude',
    async chat(messages, opts: ChatOptions = {}) {
      return (await call(messages, { temperature: 0.2, ...opts })).content ?? '';
    },
    chatTools(messages, tools, opts: ChatOptions = {}) {
      return call(messages, { temperature: 0, ...opts }, tools);
    },
    async transcribe() {
      return '';
    },
    async vision() {
      return '';
    },
  };
}

/** Minimal OpenAI transport (no react-native, no expo). */
function openAiTransport(): AiTransport {
  const post = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const b: Record<string, unknown> = { model: MODEL, ...body };
    if (isOpenAiReasoning(MODEL)) {
      b.max_completion_tokens = Math.max(Number(b.max_tokens ?? 0), 6000);
      delete b.max_tokens;
      delete b.temperature;
      b.reasoning_effort = 'low';
    }
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(b),
    });
    if (!res.ok) throw failFor(res.status, await res.text().catch(() => ''));
    return (await res.json()) as Record<string, unknown>;
  };
  const toOa = (messages: AiChatMessage[]): unknown[] =>
    messages.map((m) => {
      if (m.role === 'assistant') {
        return {
          role: 'assistant',
          content: m.content ?? '',
          ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) } : {}),
        };
      }
      if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, name: m.name, content: m.content };
      return { role: m.role, content: m.content };
    });
  const pick = (data: Record<string, unknown>) => (data.choices as { message?: { content?: string | null; tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[] } }[])?.[0]?.message;
  return {
    kind: 'live-openai',
    async chat(messages, opts: ChatOptions = {}) {
      const msg = pick(await post({ messages: toOa(messages), temperature: opts.temperature ?? 0.2, max_tokens: opts.maxTokens ?? 4096 }));
      return typeof msg?.content === 'string' ? msg.content : '';
    },
    async chatTools(messages, tools: ToolSpec[], opts: ChatOptions = {}): Promise<ChatToolsResult> {
      const msg = pick(
        await post({
          messages: toOa(messages),
          temperature: opts.temperature ?? 0,
          max_tokens: opts.maxTokens ?? 4096,
          tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
          tool_choice: 'auto',
        })
      );
      const toolCalls: ToolCall[] = (msg?.tool_calls ?? [])
        .filter((c) => c.function?.name)
        .map((c, i) => ({ id: c.id ?? `call_${i}`, name: c.function!.name!, args: safeArgs(c.function!.arguments) }));
      return { content: typeof msg?.content === 'string' && msg.content.trim() ? msg.content : null, toolCalls };
    },
    async transcribe() {
      return '';
    },
    async vision() {
      return '';
    },
  };
}

const liveTransport = (): AiTransport => (PROVIDER === 'openai' ? openAiTransport() : claudeTransport());

const safeArgs = (raw: unknown): Record<string, unknown> => {
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

const table = (results: EvalResult[]): string =>
  results.map((r) => `${r.passed ? 'PASS' : 'FAIL'}  ${r.id.padEnd(22)} ${String(r.calls)} calls ${String(Math.round(r.ms / 100) / 10).padStart(5)}s ${r.usage ? `${String(r.usage.inputTokens).padStart(6)} in ${String(r.usage.outputTokens).padStart(5)} out` : ''}  ${r.detail}`).join('\n');

describe.skipIf(!KEY)('live assistant evals', () => {
  it(
    'answers every scenario with the right tool, language and wording',
    async () => {
      const results = await runEvals({
        transport: liveTransport(),
        world,
        runIntent: async (intent) => fakeIntent(intent as never),
        only: ONLY,
        pauseMs: 3_000,
        onCase: (r) => console.log(`[live-eval] ${r.passed ? 'PASS' : 'FAIL'} ${r.id} · ${r.calls} calls · ${r.ms}ms${r.usage ? ` · ${r.usage.inputTokens} in / ${r.usage.outputTokens} out` : ''} · ${r.detail}`),
      });
      const failed = results.filter((r) => !r.passed);
      console.log(`\n${table(results)}\n\n${results.length - failed.length}/${results.length} passed\n`);
      expect(failed.map((f) => `${f.id}: ${f.detail}`)).toEqual([]);
    },
    30 * 60_000
  );
});

/** A transport that always answers the same way, to exercise the runner itself. */
function scriptedTransport(reply: string, tool?: { name: string; args: Record<string, unknown> }): AiTransport {
  let turn = 0;
  return {
    kind: 'scripted',
    async chat() {
      return reply;
    },
    async chatTools(): Promise<ChatToolsResult> {
      turn += 1;
      if (tool && turn === 1) return { content: null, toolCalls: [{ id: 'c1', name: tool.name, args: tool.args }] };
      return { content: reply, toolCalls: [] };
    },
    async transcribe() {
      return '';
    },
    async vision() {
      return '';
    },
  };
}

describe('eval runner', () => {
  it('runs a case, seeds its history and reports a verdict without throwing', async () => {
    const results = await runEvals({
      transport: scriptedTransport('Pichle mahine **Rs 5,52,500** kharcha hua.', { name: 'get_spend_summary', args: { period: { kind: 'lastMonth' } } }),
      world,
      runIntent: async (intent) => fakeIntent(intent as never),
      only: ['followup-lastmonth'],
      pauseMs: 0,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: 'followup-lastmonth', passed: true });
  });
  it('turns a provider failure into a FAIL row instead of throwing', async () => {
    const broken: AiTransport = {
      kind: 'broken',
      async chat() {
        throw new AiError('failed', 'boom');
      },
      async chatTools(): Promise<ChatToolsResult> {
        throw new AiError('failed', 'boom');
      },
      async transcribe() {
        return '';
      },
      async vision() {
        return '';
      },
    };
    const results = await runEvals({ transport: broken, world, runIntent: async (intent) => fakeIntent(intent as never), only: ['cash-en'], pauseMs: 0 });
    expect(results[0].passed).toBe(false);
    expect(results[0].detail).toContain('error');
  });
});

describe('eval suite shape', () => {
  it('has unique ids and a check on every case', () => {
    const ids = EVAL_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of EVAL_CASES) expect(Boolean(c.tools || c.draft || c.noTool || c.asks)).toBe(true);
  });
  it('judges a clean reply as a pass and a wrong-language one as a fail', () => {
    const base = { text: '', cards: [], drafts: [], suggestions: [], options: [], links: [], memory: '', toolLog: ['get_account_balance({}) → Rs 1,000'], draftLines: [], learned: [], calls: 2 };
    expect(judge({ id: 'x', text: 'cash kitna hai', tools: ['get_account_balance'], lang: 'roman' }, { ...base, text: 'Aap ke paas **Rs 1,000** hain.' }).passed).toBe(true);
    expect(judge({ id: 'x', text: 'cash kitna hai', tools: ['get_account_balance'], lang: 'roman' }, { ...base, text: 'You have Rs 1,000 in the account.' }).passed).toBe(false);
    expect(judge({ id: 'x', text: 'hi', noTool: true }, { ...base, text: 'Salam.' }).passed).toBe(false);
  });
});
