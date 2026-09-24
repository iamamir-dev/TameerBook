import { describe, expect, it } from 'vitest';

import { runAgent, splitSuggestions } from './agent';
import type { World } from './prompts';
import type { Answer } from './runner';
import { interpretToolCall, summarizeAnswerForModel, TOOLS } from './tools';
import type { AiChatMessage, AiTransport, ChatToolsResult, ToolSpec } from './types';

const world: World = {
  today: '2026-09-03',
  language: 'en',
  projects: [{ id: 'pr1', name: 'Gulberg House' }],
  plots: [],
  accounts: [{ id: 'a1', name: 'Cash in Hand' }],
  categories: [
    { id: 'c0', name: 'Materials', type: 'EXPENSE', unit: null, parentId: null },
    { id: 'c1', name: 'Cement', type: 'EXPENSE', unit: 'bori', parentId: 'c0' },
  ],
  parties: [{ id: 'p1', name: 'Akram Traders' }],
  workers: [{ id: 'w1', name: 'Bilal' }],
  investors: [],
};

/** Scripted transport: each call pops the next result and records the messages it saw. */
function fake(script: ChatToolsResult[]): AiTransport & { seen: AiChatMessage[][]; tools: ToolSpec[][] } {
  const seen: AiChatMessage[][] = [];
  const tools: ToolSpec[][] = [];
  return {
    kind: 'fake',
    seen,
    tools,
    async chat() {
      return '';
    },
    async chatTools(messages, t) {
      // A copy: the loop mutates its array between calls.
      seen.push([...messages]);
      tools.push(t);
      return script.shift() ?? { content: 'done', toolCalls: [] };
    },
    async transcribe() {
      return '';
    },
    async vision() {
      return '';
    },
  };
}

const poAnswer: Answer = {
  title: 'PO · 2',
  headline: 'Rs 5,40,293',
  sub: '0 delivered · 2 pending',
  rows: [
    { id: '1', title: 'PO-0015 · Akram Traders', date: '', subtitle: 'Pending delivery', amount: 540293, direction: 'out' },
    { id: '2', title: 'PO-0011 · Bilal Depot', date: '', subtitle: 'Pending delivery', amount: 0, direction: 'out' },
  ],
  speak: '2 PO: 0 delivered, 2 pending',
};

describe('interpretToolCall', () => {
  it('maps read tools to intents with validation', () => {
    expect(interpretToolCall({ id: '1', name: 'get_purchase_orders', args: { status: 'pending' } })).toEqual({ kind: 'read', intent: { type: 'purchase_orders', status: 'pending' } });
    expect(interpretToolCall({ id: '1', name: 'list_names', args: { entity: 'projects', filter: 'completed' } })).toEqual({
      kind: 'read',
      intent: { type: 'list_entities', entity: 'projects', filter: 'completed' },
    });
    expect(interpretToolCall({ id: '1', name: 'get_spend_by_category', args: {} }).kind).toBe('invalid');
  });
  it('maps write tools to drafts', () => {
    expect(interpretToolCall({ id: '1', name: 'add_worker', args: { name: 'Kamran', wage: 1500 } })).toEqual({
      kind: 'write',
      draft: { kind: 'createWorker', name: 'Kamran', phone: undefined, wage: 1500, project: undefined },
    });
    expect(interpretToolCall({ id: '1', name: 'record_material', args: { item: 'cement', qty: 50, rate: 1200 } }).kind).toBe('write');
  });
  it('maps the composite project details tool', () => {
    expect(interpretToolCall({ id: '1', name: 'get_project_details', args: { project: 'Gulberg' } })).toEqual({ kind: 'read', intent: { type: 'project_details', project: 'Gulberg' } });
    expect(interpretToolCall({ id: '1', name: 'get_project_details', args: {} }).kind).toBe('invalid');
  });
  it('accepts add_project with no details (the sheet asks)', () => {
    expect(interpretToolCall({ id: '1', name: 'add_project', args: {} })).toEqual({ kind: 'write', draft: { kind: 'createProject', name: undefined, plot: undefined, investors: undefined } });
  });
  it('hands module knowledge back to the model', () => {
    const a = interpretToolCall({ id: '1', name: 'explain_app', args: { topic: 'settlement' } });
    expect(a.kind).toBe('knowledge');
    expect(a.kind === 'knowledge' && a.text).toContain('LOSS always splits by capital ratio');
    expect(interpretToolCall({ id: '1', name: 'explain_app', args: { topic: 'weather' } }).kind).toBe('invalid');
  });
  it('maps open_screen and rejects junk', () => {
    expect(interpretToolCall({ id: '1', name: 'open_screen', args: { screen: 'NewProject' } })).toEqual({ kind: 'open', screen: 'NewProject' });
    expect(interpretToolCall({ id: '1', name: 'open_screen', args: { screen: 'DevTools' } }).kind).toBe('invalid');
    expect(interpretToolCall({ id: '1', name: 'drop_tables', args: {} }).kind).toBe('invalid');
  });
  it('every tool name is unique and has an object schema', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of TOOLS) expect((t.parameters as { type: string }).type).toBe('object');
  });
});

describe('summarizeAnswerForModel', () => {
  it('is compact JSON with the rows the model needs', () => {
    const s = JSON.parse(summarizeAnswerForModel(poAnswer)) as { count: number; rows: unknown[]; headline: string };
    expect(s.count).toBe(2);
    expect(s.rows).toHaveLength(2);
    expect(s.headline).toBe('Rs 5,40,293');
  });
});

describe('splitSuggestions', () => {
  it('peels the SUGGEST line off the answer', () => {
    expect(splitSuggestions('Cash: Rs 1,00,000.\nSUGGEST: Is mahine ka kharcha | Akram ko kitna dena hai | Pending orders')).toEqual({
      text: 'Cash: Rs 1,00,000.',
      suggestions: ['Is mahine ka kharcha', 'Akram ko kitna dena hai', 'Pending orders'],
      options: [],
    });
  });
  it('leaves plain answers alone and caps at three', () => {
    expect(splitSuggestions('Salam!')).toEqual({ text: 'Salam!', suggestions: [], options: [] });
    expect(splitSuggestions('x\nSUGGEST: a | b | c | d').suggestions).toHaveLength(3);
    expect(splitSuggestions(null)).toEqual({ text: '', suggestions: [], options: [] });
  });
  it('keeps a spaced em dash as a separator and turns glued dashes into hyphens', () => {
    expect(splitSuggestions('**Kharcha** — Rs 5 lakh\nplot—cost and 2–3 din\nSUGGEST: Pay Akram — now')).toEqual({
      text: '**Kharcha** — Rs 5 lakh\nplot-cost and 2-3 din',
      suggestions: ['Pay Akram — now'],
      options: [],
    });
  });
  it('peels OPTIONS (choices) as well, in either order', () => {
    const r = splitSuggestions('Kaunsa plot?\nOPTIONS: Plot A | Plot B\nSUGGEST: Cancel');
    expect(r).toEqual({ text: 'Kaunsa plot?', options: ['Plot A', 'Plot B'], suggestions: ['Cancel'] });
  });
});

describe('runAgent', () => {
  it('runs a read tool, feeds the result back, and returns the model text + card', async () => {
    const t = fake([
      { content: null, toolCalls: [{ id: 'c1', name: 'get_purchase_orders', args: { status: 'pending' } }] },
      { content: '2 orders are still pending: PO-0015 Akram Traders (Rs 5,40,293) and PO-0011 Bilal Depot.\nSUGGEST: Akram ko kitna dena hai | Delivered orders', toolCalls: [] },
    ]);
    const calls: string[] = [];
    const progress: [string, string[]][] = [];
    const r = await runAgent('which orders are not delivered yet', {
      transport: t,
      world,
      runIntent: async (intent) => {
        calls.push(intent.type);
        return poAnswer;
      },
      onProgress: (phase, names) => progress.push([phase, names]),
    });
    expect(calls).toEqual(['purchase_orders']);
    expect(progress).toEqual([['tools', ['get_purchase_orders']], ['writing', []]]);
    expect(r.cards).toHaveLength(1);
    expect(r.text).toContain('PO-0015');
    expect(r.text).not.toContain('SUGGEST');
    expect(r.suggestions).toEqual(['Akram ko kitna dena hai', 'Delivered orders']);
    expect(r.calls).toBe(2);
    // Second model call saw the tool result.
    const roles = t.seen[1].map((m) => m.role);
    expect(roles).toEqual(['system', 'user', 'assistant', 'tool']);
  });

  it('stops at a write tool with a resolved draft', async () => {
    // Writes are queued step by step: the model is told the write is queued and
    // gets one more call to add further steps or wrap up with a sentence.
    const t = fake([
      { content: null, toolCalls: [{ id: 'c1', name: 'add_worker', args: { name: 'Kamran', project: 'gulberg' } }] },
      { content: 'Kamran ready to add on Gulberg House.', toolCalls: [] },
    ]);
    const r = await runAgent('add worker Kamran on Gulberg', { transport: t, world, runIntent: async () => poAnswer });
    expect(r.drafts[0]?.draft.kind).toBe('createWorker');
    expect(r.drafts[0]?.project?.id).toBe('pr1');
    expect(r.calls).toBe(2);
    expect(r.text).toBe('Kamran ready to add on Gulberg House.');
    expect(r.memory).toContain('awaiting user confirmation');
    expect(r.draftLines[0]).toContain('createWorker');
    // The queued note went back as a tool result before the second call.
    const toolMsg = t.seen[1].find((m) => m.role === 'tool') as { content: string };
    expect(toolMsg.content).toContain('prepared');
  });

  it('turns several write calls (a bill with two lines) into several drafts', async () => {
    const t = fake([
      {
        content: 'Read 2 lines from the bill.',
        toolCalls: [
          { id: 'c1', name: 'record_material', args: { item: 'Cement', qty: 50, rate: 1200, party: 'Akram Traders' } },
          { id: 'c2', name: 'record_material', args: { item: 'Bajri', qty: 100, rate: 80, party: 'Akram Traders' } },
        ],
      },
    ]);
    const r = await runAgent('bill', { transport: t, world, runIntent: async () => poAnswer, images: ['AAAA'] });
    expect(r.drafts).toHaveLength(2);
    expect(r.drafts[1].party?.id).toBe('p1');
    const user = t.seen[0].find((m) => m.role === 'user') as { images?: string[] };
    expect(user.images).toEqual(['AAAA']);
  });

  it('returns an open action', async () => {
    const t = fake([{ content: null, toolCalls: [{ id: 'c1', name: 'open_screen', args: { screen: 'Reports' } }] }]);
    const r = await runAgent('open reports', { transport: t, world, runIntent: async () => poAnswer });
    expect(r.open).toBe('Reports');
  });

  it('feeds an invalid tool call back as an error so the model can retry', async () => {
    const t = fake([
      { content: null, toolCalls: [{ id: 'c1', name: 'get_spend_by_category', args: {} }] },
      { content: null, toolCalls: [{ id: 'c2', name: 'get_spend_by_category', args: { category: 'Cement', period: { kind: 'month' } } }] },
      { content: 'Cement this month: Rs 5,40,293.', toolCalls: [] },
    ]);
    const r = await runAgent('cement kitna', { transport: t, world, runIntent: async () => poAnswer });
    expect(r.calls).toBe(3);
    const toolMsg = t.seen[1].find((m) => m.role === 'tool') as { content: string };
    expect(toolMsg.content).toContain('error');
    expect(r.cards).toHaveLength(1);
  });

  it('feeds knowledge back as a tool result without a card', async () => {
    const t = fake([
      { content: null, toolCalls: [{ id: 'c1', name: 'explain_app', args: { topic: 'labor' } }] },
      { content: 'Balance = accrued − paid.', toolCalls: [] },
    ]);
    const r = await runAgent('worker balance kaise banta hai', { transport: t, world, runIntent: async () => poAnswer });
    expect(r.cards).toHaveLength(0);
    expect(r.text).toBe('Balance = accrued − paid.');
    const toolMsg = t.seen[1].find((m) => m.role === 'tool') as { content: string };
    expect(toolMsg.content).toContain('dihari');
  });

  it('passes history between system and user', async () => {
    const t = fake([{ content: 'Hi', toolCalls: [] }]);
    await runAgent('aur?', { transport: t, world, runIntent: async () => poAnswer, history: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'y' }] });
    expect(t.seen[0].map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
  });

  it('nudges once after an empty reply with a user turn, never an empty assistant turn', async () => {
    const t = fake([{ content: '', toolCalls: [] }, { content: 'Theek hai.', toolCalls: [] }]);
    const r = await runAgent('?', { transport: t, world, runIntent: async () => poAnswer });
    expect(r.text).toBe('Theek hai.');
    expect(r.calls).toBe(2);
    expect(t.seen[1]).toHaveLength(t.seen[0].length + 1);
    expect(t.seen[1].at(-1)).toMatchObject({ role: 'user' });
    expect(t.seen[1].some((m) => m.role === 'assistant' && !m.content)).toBe(false);
  });

  it('flags the static core as a cacheable prefix on the system message', async () => {
    const t = fake([{ content: 'Salam.', toolCalls: [] }]);
    await runAgent('salam', { transport: t, world, runIntent: async () => poAnswer });
    const sys = t.seen[0][0] as { role: string; content: string; cachePrefixChars?: number };
    expect(sys.role).toBe('system');
    expect(sys.cachePrefixChars).toBeGreaterThan(1000);
    expect(sys.content.slice(0, sys.cachePrefixChars)).toContain('PRINCIPLES');
  });

  it('throws unparseable when the model stays empty after the retry', async () => {
    const t = fake([{ content: '', toolCalls: [] }, { content: '', toolCalls: [] }]);
    await expect(runAgent('?', { transport: t, world, runIntent: async () => poAnswer })).rejects.toMatchObject({ code: 'unparseable' });
  });
});
