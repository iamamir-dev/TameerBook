import type { AiChatMessage } from './types';

/**
 * CONVERSATION HISTORY — what the model remembers of THIS chat.
 *
 * One `Exchange` per user turn: the user's words, the assistant's gist, the
 * tools it ran (with arguments, so "aur pichle mahine?" can rerun them), the
 * writes it proposed and what the user did with them (accepted / rejected).
 *
 * `compactHistory` keeps the last few exchanges verbatim and folds the older
 * ones into a short summary, deterministically (no extra model call, no
 * tokens spent on summarising). Pure + unit-tested.
 */

export interface Exchange {
  /** The assistant turn this exchange produced (so outcomes can be attached later). */
  turnId: string;
  user: string;
  /** The assistant's text, or a one-line description of what it did. */
  assistant: string;
  /** "get_spend_summary({"period":"month"}) → Rs 5,52,500 out" */
  tools: string[];
  /** Writes proposed: "record_expense: Rs 3,000 diesel, Cash in Hand" */
  drafts: string[];
  /** What the user did with each draft: "step 1 accepted (saved: …)" / "step 2 rejected". */
  outcomes: string[];
}

export interface CompactOptions {
  /** Exchanges kept verbatim (newest). */
  recent?: number;
  /** Max characters of the older-turns summary. */
  summaryChars?: number;
}

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** One dense line describing what the assistant did in an exchange. */
export function assistantGist(e: Exchange, max = 450): string {
  const parts: string[] = [];
  if (e.assistant) parts.push(clip(e.assistant.replace(/\s+/g, ' ').trim(), 300));
  if (e.tools.length) parts.push(`[ran: ${e.tools.join('; ')}]`);
  if (e.drafts.length) parts.push(`[proposed: ${e.drafts.join('; ')}]`);
  if (e.outcomes.length) parts.push(`[user: ${e.outcomes.join('; ')}]`);
  else if (e.drafts.length) parts.push('[user has not confirmed yet]');
  return clip(parts.join(' '), max);
}

/**
 * Older exchanges → a bulleted summary; recent ones → user/assistant messages.
 * The summary goes into the system prompt (it changes every turn anyway, and
 * the static part of the prompt stays cacheable ahead of it).
 */
export function compactHistory(exchanges: readonly Exchange[], opts: CompactOptions = {}): { summary: string; messages: AiChatMessage[] } {
  const recentN = opts.recent ?? 6;
  const summaryChars = opts.summaryChars ?? 1400;
  const older = exchanges.slice(0, Math.max(0, exchanges.length - recentN));
  const recent = exchanges.slice(-recentN);

  const lines: string[] = [];
  for (const e of older.slice(-10)) lines.push(`- ${clip(e.user.replace(/\s+/g, ' '), 90)} → ${assistantGist(e, 160)}`);
  let summary = '';
  // Keep the newest lines when the budget is tight.
  while (lines.length && lines.join('\n').length > summaryChars) lines.shift();
  if (lines.length) summary = `EARLIER IN THIS CHAT (oldest first)\n${lines.join('\n')}`;

  const messages: AiChatMessage[] = [];
  for (const e of recent) {
    messages.push({ role: 'user', content: clip(e.user, 500) });
    // Some providers reject an empty assistant message, and a blank turn tells
    // the model nothing; say plainly that the turn produced no answer.
    messages.push({ role: 'assistant', content: assistantGist(e) || '(no answer)' });
  }
  return { summary, messages };
}

/** Attach the user's decision on a draft to the exchange that proposed it. */
export function recordOutcome(exchanges: Exchange[], turnId: string, index: number, status: 'accepted' | 'rejected', message?: string): Exchange[] {
  return exchanges.map((e) => {
    if (e.turnId !== turnId) return e;
    const line = `step ${index + 1} ${status}${status === 'accepted' && message ? ` (saved: ${clip(message, 80)})` : ''}`;
    const outcomes = e.outcomes.filter((o) => !o.startsWith(`step ${index + 1} `));
    return { ...e, outcomes: [...outcomes, line] };
  });
}

/** Bring a saved exchange list back (tolerant). */
export function parseExchanges(raw: unknown): Exchange[] {
  if (!Array.isArray(raw)) return [];
  const out: Exchange[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (typeof o.user !== 'string') continue;
    out.push({
      turnId: typeof o.turnId === 'string' ? o.turnId : '',
      user: o.user,
      assistant: typeof o.assistant === 'string' ? o.assistant : '',
      tools: strs(o.tools),
      drafts: strs(o.drafts),
      outcomes: strs(o.outcomes),
    });
  }
  return out;
}

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
