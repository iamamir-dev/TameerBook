import { describe, expect, it } from 'vitest';

import type { Turn } from '../hooks/useAssistant';
import { isNo, isYes, pendingDraft } from './confirmWords';

const draft = { draft: { kind: 'expense' as const, amount: 5 }, marks: [], investors: [], unresolved: [], issues: [] };
const reply = (id: string, drafts: number, settled?: Record<number, { status: 'accepted' | 'rejected' }>): Turn => ({ id, role: 'assistant', text: '', cards: [], drafts: Array(drafts).fill(draft), suggestions: [], options: [], settled });

describe('confirm words', () => {
  it('recognises a yes in three scripts and ignores a sentence', () => {
    for (const w of ['haan', 'Haan!', 'ji', 'ok', 'save kar do', 'ہاں', 'جی', 'theek hai']) expect(isYes(w)).toBe(true);
    for (const w of ['haan aur 500 diesel', 'yes but change the account', '']) expect(isYes(w)).toBe(false);
  });
  it('recognises a no', () => {
    for (const w of ['nahi', 'no', 'cancel', 'نہیں', 'rehne do']) expect(isNo(w)).toBe(true);
    expect(isNo('nahi, 6000 tha')).toBe(false);
  });
  it('finds the first unsettled write of the newest reply only', () => {
    expect(pendingDraft([reply('a', 1)])).toEqual({ turnId: 'a', index: 0 });
    expect(pendingDraft([reply('a', 2, { 0: { status: 'accepted' } })])).toEqual({ turnId: 'a', index: 1 });
    expect(pendingDraft([reply('a', 1, { 0: { status: 'rejected' } })])).toBeNull();
    expect(pendingDraft([reply('a', 1), { id: 'u', role: 'user', text: 'x' }, reply('b', 0)])).toBeNull();
    expect(pendingDraft([])).toBeNull();
  });
});
