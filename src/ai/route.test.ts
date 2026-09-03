import { describe, expect, it } from 'vitest';

import type { World } from './prompts';
import { routeUtterance } from './route';
import type { AiChatMessage, AiTransport } from './types';

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

/** A transport that replays scripted replies and records what it was asked. */
function fake(replies: string[]): AiTransport & { calls: AiChatMessage[][] } {
  const calls: AiChatMessage[][] = [];
  return {
    kind: 'groq',
    calls,
    async chat(messages) {
      calls.push(messages);
      return replies.shift() ?? '{}';
    },
    async transcribe() {
      return '';
    },
    async vision() {
      return '';
    },
  };
}

describe('routeUtterance', () => {
  it('accepts a clean first answer in one call', async () => {
    const t = fake(['{"kind":"question","intent":{"type":"pnl"}}']);
    const r = await routeUtterance(t, world, 'total profit');
    expect(r.attempts).toBe(1);
    expect(r.result).toEqual({ kind: 'question', intent: { type: 'pnl' } });
  });

  it('repairs malformed JSON with one follow-up that quotes the problem', async () => {
    const t = fake(['```json\n{"kind":"nonsense"}\n```', '{"kind":"chat","reply":"Salam"}']);
    const r = await routeUtterance(t, world, 'salam');
    expect(r.attempts).toBe(2);
    expect(r.result).toEqual({ kind: 'chat', reply: 'Salam' });
    const repair = t.calls[1][1].content;
    expect(repair).toContain('Problem:');
    expect(repair).toContain('salam');
  });

  it('repairs a draft that used a name outside the lists', async () => {
    const t = fake([
      '{"kind":"draft","draft":{"kind":"material","item":"cement","qty":50,"rate":1200,"party":"Akrm Tradrs","account":"Bank Alfalah"}}',
      '{"kind":"draft","draft":{"kind":"material","item":"Cement","qty":50,"rate":1200,"party":"Akram Traders","account":"Cash in Hand"}}',
    ]);
    const r = await routeUtterance(t, world, '50 bori cement 1200 Akram se');
    expect(r.attempts).toBe(2);
    expect(t.calls[1][1].content).toContain('Bank Alfalah');
    expect(r.resolved?.party?.id).toBe('p1');
    expect(r.resolved?.account?.id).toBe('a1');
    expect(r.resolved?.unresolved).toEqual([]);
  });

  it('keeps the first draft when the repair is worse', async () => {
    const t = fake(['{"kind":"draft","draft":{"kind":"payWorker","worker":"Kamran","amount":2000}}', 'not json at all']);
    const r = await routeUtterance(t, world, 'Kamran ko 2000');
    expect(r.attempts).toBe(2);
    expect(r.result.kind).toBe('draft');
    expect(r.resolved?.unresolved).toEqual(['Kamran']);
  });

  it('throws unparseable when both attempts fail', async () => {
    const t = fake(['??', '??']);
    await expect(routeUtterance(t, world, 'x')).rejects.toMatchObject({ code: 'unparseable' });
  });
});
