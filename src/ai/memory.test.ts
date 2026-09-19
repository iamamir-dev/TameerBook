import { describe, expect, it } from 'vitest';

import type { ResolvedDraft } from './drafts';
import { assistantGist, compactHistory, parseExchanges, recordOutcome, type Exchange } from './history';
import { addFact, emptyMemory, memoryBlock, noteAccepted, noteLanguage, parseMemory } from './memory';

const draft: ResolvedDraft = {
  draft: { kind: 'expense', amount: 3000, note: 'diesel' },
  account: { id: 'a1', name: 'Cash in Hand' },
  project: { id: 'p1', name: 'Gulberg House' },
  marks: [],
  investors: [],
  unresolved: [],
  issues: [],
};

describe('UserMemory', () => {
  it('starts empty and prints nothing', () => {
    expect(memoryBlock(emptyMemory())).toBe('');
    expect(parseMemory('garbage')).toEqual(emptyMemory());
    expect(parseMemory(null)).toEqual(emptyMemory());
  });
  it('learns language, defaults and facts, bounded and deduplicated', () => {
    let m = noteLanguage(emptyMemory(), 'roman');
    m = noteLanguage(m, null);
    expect(m.langs).toEqual(['roman']);
    m = noteAccepted(m, draft);
    expect(m.defaults).toEqual({ account: 'Cash in Hand', project: 'Gulberg House' });
    m = noteAccepted(m, draft, { account: 'HBL Bank' });
    expect(m.defaults.account).toBe('HBL Bank');
    m = addFact(m, 'User is the site supervisor at Gulberg', '2026-09-19');
    m = addFact(m, 'user is the site supervisor at gulberg.', '2026-09-20');
    expect(m.facts).toHaveLength(1);
    expect(m.facts[0].at).toBe('2026-09-20');
    for (let i = 0; i < 15; i++) m = addFact(m, `fact ${i}`, '2026-09-20');
    expect(m.facts).toHaveLength(10);
    const block = memoryBlock(m);
    expect(block).toContain('HBL Bank');
    expect(block).toContain('fact 14');
    expect(parseMemory(JSON.stringify(m))).toEqual(m);
  });
});

const ex = (i: number, extra: Partial<Exchange> = {}): Exchange => ({
  turnId: `t${i}`,
  user: `question ${i}`,
  assistant: `answer ${i}`,
  tools: [],
  drafts: [],
  outcomes: [],
  ...extra,
});

describe('history', () => {
  it('keeps recent exchanges verbatim and folds older ones into a summary', () => {
    const list = Array.from({ length: 7 }, (_, i) => ex(i));
    const { summary, messages } = compactHistory(list, { recent: 4 });
    expect(messages).toHaveLength(8);
    expect(messages[0]).toEqual({ role: 'user', content: 'question 3' });
    expect(summary).toContain('question 0');
    expect(summary).toContain('question 2');
    expect(summary).not.toContain('question 3');
  });
  it('has no summary for a short chat', () => {
    expect(compactHistory([ex(1)]).summary).toBe('');
  });
  it('never emits an empty assistant message', () => {
    const blank: Exchange = { turnId: 't', user: 'hi', assistant: '', tools: [], drafts: [], outcomes: [] };
    expect(compactHistory([blank]).messages[1]).toEqual({ role: 'assistant', content: '(no answer)' });
  });
  it('gist carries tools, proposals and the user\'s decision', () => {
    let list = [ex(1, { tools: ['get_spend_summary({"period":{"kind":"month"}}) → Rs 5,000 out'], drafts: ['expense: amount=3000'] })];
    expect(assistantGist(list[0])).toContain('[ran: get_spend_summary');
    expect(assistantGist(list[0])).toContain('not confirmed');
    list = recordOutcome(list, 't1', 0, 'accepted', 'Saved Rs 3,000');
    expect(assistantGist(list[0])).toContain('step 1 accepted (saved: Saved Rs 3,000)');
    list = recordOutcome(list, 't1', 0, 'rejected');
    expect(list[0].outcomes).toEqual(['step 1 rejected']);
  });
  it('parses saved exchanges tolerantly', () => {
    expect(parseExchanges([{ user: 'hi' }, 'junk', { assistant: 'x' }])).toEqual([{ turnId: '', user: 'hi', assistant: '', tools: [], drafts: [], outcomes: [] }]);
  });
});
