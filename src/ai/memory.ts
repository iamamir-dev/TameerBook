import type { ResolvedDraft } from './drafts';
import type { ReplyLanguage } from './language';

/**
 * USER MEMORY — what the assistant knows about this user across
 * conversations (semantic memory), as opposed to the chat history (episodic).
 * Small on purpose: it rides in every system prompt.
 *
 *   langs     the language the user wrote in, newest last (→ usual language)
 *   defaults  the account / project the user last confirmed a write on
 *   facts     stable things the user said to remember ("main Gulberg ka
 *             supervisor hoon", "Cash in Hand = site petty cash")
 *
 * Pure: the hook persists it in app_settings. Nothing here touches the DB.
 */

export interface UserMemory {
  v: 1;
  langs: ReplyLanguage[];
  defaults: { account?: string; project?: string };
  facts: { text: string; at: string }[];
}

const MAX_LANGS = 12;
export const MAX_FACTS = 10;
const MAX_FACT_CHARS = 140;

export const emptyMemory = (): UserMemory => ({ v: 1, langs: [], defaults: {}, facts: [] });

/** Read a saved memory (tolerant of older / broken shapes). */
export function parseMemory(raw: string | null | undefined): UserMemory {
  if (!raw) return emptyMemory();
  try {
    const o = JSON.parse(raw) as Partial<UserMemory>;
    const langs = Array.isArray(o.langs) ? o.langs.filter((l): l is ReplyLanguage => l === 'ur' || l === 'roman' || l === 'en').slice(-MAX_LANGS) : [];
    const defaults = o.defaults && typeof o.defaults === 'object' ? { account: strOrUndef(o.defaults.account), project: strOrUndef(o.defaults.project) } : {};
    const facts = Array.isArray(o.facts)
      ? o.facts.filter((f): f is { text: string; at: string } => !!f && typeof f.text === 'string' && typeof f.at === 'string').slice(-MAX_FACTS)
      : [];
    return { v: 1, langs, defaults, facts };
  } catch {
    return emptyMemory();
  }
}

const strOrUndef = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export function noteLanguage(m: UserMemory, lang: ReplyLanguage | null): UserMemory {
  if (!lang) return m;
  return { ...m, langs: [...m.langs, lang].slice(-MAX_LANGS) };
}

/** An accepted write tells us the user's usual account and current project. */
export function noteAccepted(m: UserMemory, r: ResolvedDraft, chosen?: { account?: string | null; project?: string | null }): UserMemory {
  const account = chosen?.account ?? r.account?.name ?? r.accountTo?.name;
  const project = chosen?.project ?? r.project?.name;
  if (!account && !project) return m;
  return { ...m, defaults: { account: account ?? m.defaults.account, project: project ?? m.defaults.project } };
}

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Add a stable fact (deduplicated, bounded, newest last). Returns the same object when nothing changed. */
export function addFact(m: UserMemory, text: string, todayIso: string): UserMemory {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_FACT_CHARS);
  if (clean.length < 3) return m;
  const key = norm(clean);
  const kept = m.facts.filter((f) => norm(f.text) !== key);
  return { ...m, facts: [...kept, { text: clean, at: todayIso }].slice(-MAX_FACTS) };
}

export function forgetFacts(m: UserMemory): UserMemory {
  return { ...m, facts: [] };
}

/** The "about this user" block for the system prompt ('' when there is nothing worth saying). */
export function memoryBlock(m: UserMemory): string {
  const lines: string[] = [];
  if (m.defaults.account) lines.push(`Usually pays from: ${m.defaults.account} (use it when the user names no account)`);
  if (m.defaults.project) lines.push(`Working on lately: ${m.defaults.project} (assume it when a project is not named and only one fits)`);
  for (const f of m.facts) lines.push(`${f.text} (${f.at})`);
  return lines.length ? `ABOUT THIS USER (learned earlier; use quietly, never recite)\n- ${lines.join('\n- ')}` : '';
}
