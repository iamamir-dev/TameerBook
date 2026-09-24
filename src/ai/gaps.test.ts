import { describe, expect, it } from 'vitest';

import { resolveDraft, type Draft } from './drafts';
import { draftGaps, gapPrompt, groundNames } from './gaps';
import type { World } from './prompts';

const base: World = {
  today: '2026-09-20',
  language: 'en',
  projects: [],
  plots: [],
  accounts: [{ id: 'a1', name: 'Cash in Hand' }],
  categories: [
    { id: 'c1', name: 'Cement', type: 'EXPENSE', unit: 'bori', parentId: 'c0' },
    { id: 'c2', name: 'Fuel', type: 'EXPENSE', unit: null, parentId: null },
  ],
  parties: [{ id: 'p1', name: 'Akram Traders' }],
  workers: [],
  investors: [],
};

const world = (over: Partial<World> = {}): World => ({ ...base, ...over });
const gaps = (draft: Draft, w: World) => draftGaps(resolveDraft(draft, w), w);

describe('groundNames', () => {
  it('keeps a name the user actually said, in any spelling they used', () => {
    const d = { kind: 'material', item: 'Cement', qty: 50, rate: 1250, project: 'Gulberg Greens G-508' } as const;
    expect(groundNames(d, 'Gulberg ke liye 50 bori cement liya').project).toBe('Gulberg Greens G-508');
  });
  it('drops a project the user never mentioned, so it becomes a question', () => {
    const d = { kind: 'material', item: 'Cement', qty: 50, rate: 1250, project: 'Gulberg Greens G-508' } as const;
    expect(groundNames(d, '50 bori cement 1250 wala Akram se liya').project).toBeUndefined();
  });
  it('counts what the user said earlier in the chat, not just this message', () => {
    const d = { kind: 'material', item: 'Cement', qty: 50, project: 'Wapda Town H-101' } as const;
    expect(groundNames(d, 'Wapda Town wala kaam. aur 50 bori cement').project).toBe('Wapda Town H-101');
  });
  it('does not strip a name the user said in the other script', () => {
    const d = { kind: 'payWorker', worker: 'Bilal', amount: 2000 } as const;
    expect(groundNames(d, 'بلال کو دو ہزار دیے').worker).toBe('Bilal');
  });
  it('drops an account the user never named, but leaves a brand-new supplier alone', () => {
    const d = { kind: 'expense', amount: 3000, account: 'Cash in Hand', party: 'Naya Traders' } as const;
    const out = groundNames(d, 'diesel pe 3 hazar kharch');
    expect(out.account).toBeUndefined();
    expect(out.party).toBe('Naya Traders');
    expect(groundNames(d, 'diesel pe 3 hazar cash se').account).toBe('Cash in Hand');
  });
});

describe('draftGaps', () => {
  it('is empty when everything essential is known', () => {
    const w = world({ projects: [{ id: 'pr1', name: 'Gulberg House' }] });
    expect(gaps({ kind: 'material', item: 'Cement', qty: 50, rate: 1250, project: 'Gulberg House' }, w)).toEqual([]);
    expect(gaps({ kind: 'expense', amount: 3000, category: 'fuel', note: 'diesel' }, w)).toEqual([]);
  });

  it('asks for a category, offering the saved ones and a way to add one', () => {
    const w = world();
    const none = gaps({ kind: 'expense', amount: 3000, note: 'diesel' }, w);
    expect(none[0].what).toContain('category');
    expect(none[0].choices).toEqual(['Cement', 'Fuel']);
    expect(none[0].link).toBe('Categories');
    const unknown = gaps({ kind: 'expense', amount: 3000, category: 'Paint' }, w);
    expect(unknown[0].what).toContain('"Paint"');
    expect(gapPrompt(unknown)).toContain('LINK: Categories');
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
    expect(gapPrompt([gap])).toContain('offer to make it');
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

  it('covers every module, not just projects', () => {
    const empty = world({ projects: [{ id: 'p', name: 'Only' }] });
    // Labour: nobody to mark a day against.
    expect(gaps({ kind: 'attendance', allPresent: true, marks: [], project: 'Only' }, empty)[0].mustCreate).toBe(true);
    // Investors: the money came from a named partner.
    expect(gaps({ kind: 'investorPayment', investor: 'Umar', amount: 5000 }, empty)[0].mustCreate).toBe(true);
    // Orders: nothing outstanding to pay against.
    expect(gaps({ kind: 'payPurchaseOrder', po: 'Rafiq', amount: 5000 }, empty).some((g) => g.what.includes('purchase order'))).toBe(true);
    // Transfers need two ends.
    expect(gaps({ kind: 'transfer', from: 'HBL', to: 'Cash', amount: 5000 }, empty)[0].what).toContain('second account');
    // A sale is agreed on a project.
    const many = world({ projects: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
    expect(gaps({ kind: 'setSale', buyer: 'Ahmed', price: 100 }, many).some((g) => g.what.includes('project'))).toBe(true);
  });

  it('asks which account when a transfer names one it cannot place', () => {
    const w = world({ accounts: [{ id: 'a1', name: 'Cash in Hand' }, { id: 'a2', name: 'Meezan bank' }], projects: [{ id: 'p', name: 'Only' }] });
    const found = gaps({ kind: 'transfer', from: 'Meezan bank', to: 'Faysal', amount: 5000 }, w);
    expect(found).toHaveLength(1);
    expect(found[0].what).toContain('Faysal');
  });

  it('never tells the model to send the user to a screen or name the app\'s limits', () => {
    const p = gapPrompt([{ what: 'a project', mustCreate: true }]);
    expect(p).toContain('do not tell the user to open a screen');
    expect(p).toContain('do not tell them what is missing from the app');
  });
  it('asks for everything missing in one checklist, choices written into the lines', () => {
    const p = gapPrompt([
      { what: 'the amount in rupees', mustCreate: false },
      { what: 'which project this belongs to', mustCreate: false, choices: ['A', 'B'] },
    ]);
    expect(p).toContain('1. the amount in rupees');
    expect(p).toContain('2. which project this belongs to (the ONLY choices: A | B)');
    expect(p).toContain('Write no OPTIONS line');
    // A single gap with choices still gets tappable options.
    expect(gapPrompt([{ what: 'which project', mustCreate: false, choices: ['A', 'B'] }])).toContain('OPTIONS line: A | B');
  });

  it('asks which account when the user has several and named none', () => {
    const w = world({ accounts: [{ id: 'a1', name: 'Cash in Hand' }, { id: 'a2', name: 'Meezan' }] });
    const g = gaps({ kind: 'expense', amount: 3000, category: 'fuel' }, w);
    expect(g.map((x) => x.what)).toEqual(['which account the money moves through']);
    expect(g[0].choices).toEqual(['Cash in Hand', 'Meezan']);
    expect(gaps({ kind: 'expense', amount: 3000, category: 'fuel', account: 'Meezan' }, w)).toEqual([]);
  });
});
