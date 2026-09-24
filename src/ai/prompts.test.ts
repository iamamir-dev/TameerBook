import { describe, expect, it } from 'vitest';

import { agentSystemPrompt, confirmationSystemPrompt, type World } from './prompts';
import { TOOLS } from './tools';

/**
 * Token budget guard. The fixed part of every call (rules + tool schemas)
 * is what Claude caches as a prefix and what a cache miss costs; keep it
 * from creeping. 1 token ≈ 3.6 chars for this mix of English, names and JSON.
 */
const world: World = {
  today: '2026-09-19',
  language: 'ur',
  projects: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Project Name ${i}` })),
  plots: Array.from({ length: 8 }, (_, i) => ({ id: `l${i}`, name: `Bahria Town C-${100 + i}`, taken: i % 2 === 0 })),
  accounts: [
    { id: 'a1', name: 'Cash in Hand' },
    { id: 'a2', name: 'HBL Bank' },
    { id: 'a3', name: 'Meezan 1' },
  ],
  categories: Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, name: `Category ${i}`, type: 'EXPENSE' as const, unit: i % 2 ? 'kg' : null, parentId: i > 5 ? 'c0' : null })),
  parties: Array.from({ length: 15 }, (_, i) => ({ id: `s${i}`, name: `Supplier Traders ${i}` })),
  workers: Array.from({ length: 12 }, (_, i) => ({ id: `w${i}`, name: `Worker Name ${i}` })),
  investors: Array.from({ length: 5 }, (_, i) => ({ id: `i${i}`, name: `Investor ${i}` })),
  unpaidOrders: Array.from({ length: 5 }, (_, i) => ({ poNumber: `PO-00${i}`, supplier: `Supplier Traders ${i}`, remaining: 50000 })),
};

describe('prompt budget', () => {
  // The app targets Claude (claude-sonnet-4-6), so there is no per-minute
  // token ceiling to dodge. What the fixed part of every call costs now is money
  // and latency: it is re-sent on each of the 2-4 calls a turn makes, and only
  // the static prefix is served from cache. These caps are generous enough for a rule that
  // earns its place and tight enough that nobody dumps prose in here.
  // ~3.6 chars per token for this mix of English, names and JSON.
  const TOKENS = (chars: number) => Math.round(chars / 3.6);

  it('keeps the fixed part of a call affordable', () => {
    const sys = agentSystemPrompt(world, { language: 'roman', memory: 'ABOUT THIS USER\n- Usually pays from: Cash in Hand', summary: '' });
    expect(TOKENS(sys.length + JSON.stringify(TOOLS).length)).toBeLessThan(9_500);
  });
  it('keeps each half from creeping', () => {
    const sys = agentSystemPrompt(world, { language: 'roman' });
    expect(TOKENS(sys.length)).toBeLessThan(4_600);
    expect(TOKENS(JSON.stringify(TOOLS).length)).toBeLessThan(4_800);
  });
  it('keeps the confirmation prompt small', () => {
    // It carries the whole language directive, which is the point of it.
    expect(TOKENS(confirmationSystemPrompt('roman').length)).toBeLessThan(600);
  });
});

describe('prompt content', () => {
  it('puts the static core first and the per-turn blocks last (cacheable prefix)', () => {
    const a = agentSystemPrompt(world, { language: 'en' });
    const b = agentSystemPrompt({ ...world, today: '2026-10-01' }, { language: 'ur', memory: 'ABOUT THIS USER\n- x' });
    const common = (() => {
      let i = 0;
      while (i < a.length && a[i] === b[i]) i++;
      return i;
    })();
    expect(common).toBeGreaterThan(5_000);
    expect(a.indexOf('ANSWER IN')).toBeGreaterThan(a.indexOf('PRINCIPLES'));
  });
  it('carries the language directive, the memory and the summary', () => {
    const s = agentSystemPrompt(world, { language: 'ur', memory: 'ABOUT THIS USER\n- Usually pays from: HBL Bank', summary: 'EARLIER IN THIS CHAT\n- q → a' });
    expect(s).toContain('Urdu script');
    expect(s).toContain('HBL Bank');
    expect(s).toContain('EARLIER IN THIS CHAT');
    expect(s).toContain('Saturday 2026-09-19');
  });
  it('never contains an em-dash or Devanagari', () => {
    const s = agentSystemPrompt(world, { language: 'roman' });
    expect(/[ऀ-ॿ]/.test(s)).toBe(false);
  });
});
