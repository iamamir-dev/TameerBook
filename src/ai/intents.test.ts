import { describe, expect, it } from 'vitest';

import { coerceDraft, draftToEntryPrefill, draftToMaterialPrefill, resolveDraft, type WorldNames } from './drafts';
import { coerceIntent, coercePeriod, parseRouterOutput, periodToRange } from './intents';

const world: WorldNames = {
  projects: [{ id: 'pr1', name: 'Gulberg House' }],
  plots: [{ id: 'pl1', name: 'DHA Plot 14' }],
  accounts: [
    { id: 'a1', name: 'Cash in Hand' },
    { id: 'a2', name: 'HBL' },
  ],
  categories: [
    { id: 'c0', name: 'Materials', type: 'EXPENSE', unit: null, parentId: null },
    { id: 'c1', name: 'Cement', alt: ['سیمنٹ'], type: 'EXPENSE', unit: 'bori', parentId: 'c0' },
    { id: 'c2', name: 'Home Expense', type: 'EXPENSE', unit: null, parentId: null },
    { id: 'c3', name: 'Other Income', type: 'INCOME', unit: null, parentId: null },
  ],
  parties: [{ id: 'p1', name: 'Akram Traders' }],
  workers: [
    { id: 'w1', name: 'Bilal' },
    { id: 'w2', name: 'Rashid' },
  ],
  investors: [{ id: 'i1', name: 'Umar' }],
};

describe('periodToRange', () => {
  it('handles yesterday and lastMonth explicitly', () => {
    expect(periodToRange({ kind: 'yesterday' }, '2026-09-01')).toEqual({ start: '2026-08-31', end: '2026-08-31' });
    expect(periodToRange({ kind: 'lastMonth' }, '2026-09-15')).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(periodToRange({ kind: 'lastMonth' }, '2026-01-15')).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });
  it('delegates presets and passes custom through', () => {
    expect(periodToRange({ kind: 'month' }, '2026-09-15')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(periodToRange({ kind: 'custom', start: '2026-01-01', end: '2026-01-10' }, '2026-09-15')).toEqual({ start: '2026-01-01', end: '2026-01-10' });
  });
});

describe('coercePeriod', () => {
  it('accepts kinds as strings or objects and falls back', () => {
    expect(coercePeriod('week')).toEqual({ kind: 'week' });
    expect(coercePeriod({ kind: 'lastMonth' })).toEqual({ kind: 'lastMonth' });
    expect(coercePeriod('bogus')).toEqual({ kind: 'month' });
    expect(coercePeriod(undefined, 'all')).toEqual({ kind: 'all' });
  });
  it('orders a reversed custom range', () => {
    expect(coercePeriod({ kind: 'custom', start: '2026-02-10', end: '2026-02-01' })).toEqual({ kind: 'custom', start: '2026-02-01', end: '2026-02-10' });
  });
});

describe('coerceIntent', () => {
  it('requires the mandatory fields', () => {
    expect(coerceIntent({ type: 'spend_by_category' })).toBeNull();
    expect(coerceIntent({ type: 'spend_by_category', category: 'cement', period: 'month' })).toEqual({
      type: 'spend_by_category',
      category: 'cement',
      project: undefined,
      period: { kind: 'month' },
    });
  });
  it('rejects unknown types', () => {
    expect(coerceIntent({ type: 'drop_tables' })).toBeNull();
  });
  it('lists entities by kind and rejects unknown kinds', () => {
    expect(coerceIntent({ type: 'list_entities', entity: 'workers' })).toEqual({ type: 'list_entities', entity: 'workers' });
    expect(coerceIntent({ type: 'list_entities', entity: 'aliens' })).toBeNull();
  });
  it('accepts the company overview', () => {
    expect(coerceIntent({ type: 'company_overview' })).toEqual({ type: 'company_overview' });
  });
  it('defaults purchase_orders to open only', () => {
    expect(coerceIntent({ type: 'purchase_orders' })).toEqual({ type: 'purchase_orders', openOnly: true });
  });
});

describe('parseRouterOutput', () => {
  it('reads the three wrapper kinds', () => {
    expect(parseRouterOutput({ kind: 'chat', reply: 'Salam' })).toEqual({ kind: 'chat', reply: 'Salam' });
    expect(parseRouterOutput({ kind: 'question', intent: { type: 'pnl' } })).toEqual({ kind: 'question', intent: { type: 'pnl' } });
    expect(parseRouterOutput({ kind: 'draft', draft: { kind: 'expense', amount: 500 } })?.kind).toBe('draft');
  });
  it('reads an open-screen action and rejects unknown screens', () => {
    expect(parseRouterOutput({ kind: 'open', screen: 'NewProject' })).toEqual({ kind: 'open', screen: 'NewProject' });
    expect(parseRouterOutput({ kind: 'open', screen: 'DevTools' })).toBeNull();
  });
  it('accepts a bare intent or draft', () => {
    expect(parseRouterOutput({ type: 'insights' })?.kind).toBe('question');
    expect(parseRouterOutput({ kind: 'payWorker', worker: 'Bilal', amount: 2000 })?.kind).toBe('draft');
  });
  it('returns null for junk', () => {
    expect(parseRouterOutput('hello')).toBeNull();
    expect(parseRouterOutput({ kind: 'question', intent: { type: 'nope' } })).toBeNull();
  });
});

describe('coerceDraft', () => {
  it('parses string amounts and computes material totals', () => {
    const d = coerceDraft({ kind: 'material', item: 'cement', qty: '50', rate: 1200 });
    expect(d).toEqual({ kind: 'material', item: 'cement', qty: 50, unit: undefined, rate: 1200, amount: 60000, project: undefined, party: undefined, account: undefined, date: undefined });
  });
  it('normalises attendance statuses and drops bad marks', () => {
    const d = coerceDraft({ kind: 'attendance', marks: [{ worker: 'Bilal', status: 'half' }, { worker: '', status: 'FULL' }, { worker: 'X', status: 'late' }] });
    expect(d).toEqual({ kind: 'attendance', project: undefined, date: undefined, allPresent: false, marks: [{ worker: 'Bilal', status: 'HALF' }] });
  });
  it('parses "add" drafts with sensible defaults', () => {
    expect(coerceDraft({ kind: 'createParty', name: 'Rafiq Traders' })).toEqual({ kind: 'createParty', name: 'Rafiq Traders', partyType: 'SUPPLIER', phone: undefined });
    expect(coerceDraft({ kind: 'createAccount', name: 'Meezan', accountType: 'bank', openingBalance: '2,00,000' })).toEqual({ kind: 'createAccount', name: 'Meezan', accountType: 'BANK', openingBalance: 200000 });
    expect(coerceDraft({ kind: 'createPlot', society: 'Bahria', plotNo: '22', dealPrice: 5000000 })).toMatchObject({ kind: 'createPlot', name: 'Bahria 22' });
    expect(coerceDraft({ kind: 'createWorker' })).toBeNull();
  });
  it('resolves the plot named for a new project', () => {
    const r = resolveDraft(coerceDraft({ kind: 'createProject', name: 'Gulberg House', plot: 'dha plot 14' })!, world);
    expect(r.plot?.id).toBe('pl1');
  });
  it('rejects drafts missing essentials', () => {
    expect(coerceDraft({ kind: 'expense' })).toBeNull();
    expect(coerceDraft({ kind: 'transfer', from: 'HBL', amount: 10 })).toBeNull();
    expect(coerceDraft({ kind: 'attendance', marks: [] })).toBeNull();
  });
});

describe('resolveDraft + prefills', () => {
  it('resolves names to ids and reports unknown ones', () => {
    const d = coerceDraft({ kind: 'expense', amount: 5000, category: 'home expense', party: 'Zubair', account: 'cash', project: 'gulberg' })!;
    const r = resolveDraft(d, world);
    expect(r.category?.id).toBe('c2');
    expect(r.account?.id).toBe('a1');
    expect(r.project?.id).toBe('pr1');
    expect(r.party).toBeUndefined();
    expect(r.unresolved).toEqual(['Zubair']);
    expect(draftToEntryPrefill(r)).toEqual({
      direction: 'OUT',
      prefill: { amount: 5000, categoryId: 'c2', note: undefined, accountId: 'a1', projectId: 'pr1', partyId: null },
    });
  });
  it('matches materials by Urdu name and keeps free text for unknown items', () => {
    const known = resolveDraft(coerceDraft({ kind: 'material', item: 'سیمنٹ', qty: 50, rate: 1200, party: 'akram' })!, world);
    expect(known.category?.id).toBe('c1');
    expect(draftToMaterialPrefill(known)).toMatchObject({ categoryId: 'c1', qty: 50, rate: 1200, amount: 60000, partyId: 'p1' });
    const unknown = resolveDraft(coerceDraft({ kind: 'material', item: 'Marble tiles', amount: 90000 })!, world);
    expect(unknown.category).toBeUndefined();
    expect(unknown.unresolved).toEqual([]);
    expect(draftToMaterialPrefill(unknown)?.itemName).toBe('Marble tiles');
  });
  it('resolves attendance marks per worker', () => {
    const r = resolveDraft(coerceDraft({ kind: 'attendance', allPresent: true, marks: [{ worker: 'bilal', status: 'HALF' }, { worker: 'Kamran', status: 'ABSENT' }] })!, world);
    expect(r.marks[0].worker?.id).toBe('w1');
    expect(r.marks[1].worker).toBeNull();
    expect(r.unresolved).toEqual(['Kamran']);
  });
  it('resolves both sides of a transfer', () => {
    const r = resolveDraft(coerceDraft({ kind: 'transfer', from: 'hbl', to: 'cash in hand', amount: 20000 })!, world);
    expect(r.account?.id).toBe('a2');
    expect(r.accountTo?.id).toBe('a1');
  });
});
