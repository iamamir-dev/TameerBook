import { describe, expect, it } from 'vitest';

import { resolveDraft, type Draft } from './drafts';
import { draftGaps, gapPrompt } from './gaps';
import type { World } from './prompts';

const base: World = {
  today: '2026-09-20',
  language: 'en',
  projects: [],
  plots: [],
  accounts: [{ id: 'a1', name: 'Cash in Hand' }],
  categories: [{ id: 'c1', name: 'Cement', type: 'EXPENSE', unit: 'bori', parentId: 'c0' }],
  parties: [{ id: 'p1', name: 'Akram Traders' }],
  workers: [],
  investors: [],
};

const world = (over: Partial<World> = {}): World => ({ ...base, ...over });
const gaps = (draft: Draft, w: World) => draftGaps(resolveDraft(draft, w), w);

describe('draftGaps', () => {
  it('is empty when everything essential is known', () => {
    const w = world({ projects: [{ id: 'pr1', name: 'Gulberg House' }] });
    expect(gaps({ kind: 'material', item: 'Cement', qty: 50, rate: 1250, project: 'Gulberg House' }, w)).toEqual([]);
    expect(gaps({ kind: 'expense', amount: 3000, note: 'diesel' }, w)).toEqual([]);
  });

  it('asks for the amount rather than showing a card with a blank figure', () => {
    expect(gaps({ kind: 'expense', note: 'diesel' }, world())[0].what).toContain('amount');
    expect(gaps({ kind: 'payWorker', worker: 'Bilal' }, world({ workers: [{ id: 'w1', name: 'Bilal' }] }))[0].what).toContain('amount');
  });

  it('asks for a name before creating anything', () => {
    expect(gaps({ kind: 'createWorker' }, world())[0].what).toContain('name');
  });

  it('offers to create the missing thing when the user owns none', () => {
    const [gap] = gaps({ kind: 'material', item: 'Cement', qty: 50, rate: 1250 }, world());
    expect(gap.mustCreate).toBe(true);
    expect(gapPrompt([gap])).toContain('OFFER TO CREATE IT YOURSELF');
  });

  it('asks which one, with the names, when there are several', () => {
    const w = world({ projects: [{ id: '1', name: 'Gulberg House' }, { id: '2', name: 'Wapda Town' }] });
    const [gap] = gaps({ kind: 'material', item: 'Cement', qty: 50, rate: 1250 }, w);
    expect(gap.mustCreate).toBe(false);
    expect(gap.choices).toEqual(['Gulberg House', 'Wapda Town']);
    expect(gapPrompt([gap])).toContain('Gulberg House | Wapda Town');
  });

  it('does not ask when there is only one possible answer', () => {
    const w = world({ projects: [{ id: 'pr1', name: 'Only Project' }] });
    expect(gaps({ kind: 'material', item: 'Cement', qty: 50, rate: 1250 }, w)).toEqual([]);
  });

  it('will not pay a worker it cannot identify', () => {
    const w = world({ workers: [{ id: 'w1', name: 'Bilal' }] });
    const found = gaps({ kind: 'payWorker', worker: 'Shahbaz Butt', amount: 2000 }, w);
    expect(found).toHaveLength(1);
    expect(found[0].choices).toEqual(['Bilal']);
  });

  it('flags a book with no account at all', () => {
    const w = world({ accounts: [], projects: [{ id: 'pr1', name: 'Only Project' }] });
    expect(gaps({ kind: 'expense', amount: 500, note: 'tea' }, w).some((g) => g.what.includes('account'))).toBe(true);
  });

  it('never tells the model to send the user to a screen', () => {
    expect(gapPrompt([{ what: 'a project', mustCreate: true }])).toContain('do not tell the user to open a screen');
  });
});
