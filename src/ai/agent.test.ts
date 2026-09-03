import { describe, expect, it } from 'vitest';

import { runAgent } from './agent';
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
      seen.push(messages);
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

describe('runAgent', () => {
  it('runs a read tool, feeds the result back, and returns the model text + card', async () => {
    const t = fake([
      { content: null, toolCalls: [{ id: 'c1', name: 'get_purchase_orders', args: { status: 'pending' } }] },
      { content: '2 orders are still pending: PO-0015 Akram Traders (Rs 5,40,293) and PO-0011 Bilal Depot.', toolCalls: [] },
    ]);
    const calls: string[] = [];
    const r = await runAgent('which orders are not delivered yet', {
      transport: t,
      world,
      runIntent: async (intent) => {
        calls.push(intent.type);
        return poAnswer;
      },
    });
    expect(calls).toEqual(['purchase_orders']);
    expect(r.cards).toHaveLength(1);
    expect(r.text).toContain('PO-0015');
    expect(r.calls).toBe(2);
    // Second model call saw the tool result.
    const roles = t.seen[1].map((m) => m.role);
    expect(roles).toEqual(['system', 'user', 'assistant', 'tool']);
  });

  it('stops at a write tool with a resolved draft', async () => {
    const t = fake([{ content: 'Adding Kamran as a worker.', toolCalls: [{ id: 'c1', name: 'add_worker', args: { name: 'Kamran', project: 'gulberg' } }] }]);
    const r = await runAgent('add worker Kamran on Gulberg', { transport: t, world, runIntent: async () => poAnswer });
    expect(r.draft?.draft.kind).toBe('createWorker');
    expect(r.draft?.project?.id).toBe('pr1');
    expect(r.calls).toBe(1);
    expect(r.memory).toContain('awaiting user confirmation');
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

  it('passes history between system and user', async () => {
    const t = fake([{ content: 'Hi', toolCalls: [] }]);
    await runAgent('aur?', { transport: t, world, runIntent: async () => poAnswer, history: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'y' }] });
    expect(t.seen[0].map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
  });

  it('throws unparseable when the model returns nothing usable', async () => {
    const t = fake([{ content: '', toolCalls: [] }]);
    await expect(runAgent('?', { transport: t, world, runIntent: async () => poAnswer })).rejects.toMatchObject({ code: 'unparseable' });
  });
});
