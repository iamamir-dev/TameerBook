/**
 * Fuzzy name matching — how model output ("akram", "cement", "hbl") becomes a
 * real row id. Pure and unit-tested. The model is never given ids: it speaks
 * in names, and we resolve them here against the user's own data, so a
 * hallucinated id can never reach the database.
 */

export interface Named {
  id: string;
  name: string;
  /** Alternate spellings (Urdu-script name, aliases). */
  alt?: string[];
}

export interface Match<T extends Named> {
  item: T;
  /** 0..1 — see `matchName` for the ladder. */
  score: number;
}

/** Lowercase, strip punctuation / Arabic diacritics, collapse whitespace. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ْٰ]/g, '') // Arabic harakat
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Classic Levenshtein distance (small strings only). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function scoreOne(query: string, candidate: string): number {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;
  if (candidate.startsWith(query) || query.startsWith(candidate)) return 0.9;
  if (query.length >= 3 && (candidate.includes(query) || query.includes(candidate))) return 0.8;
  const qt = query.split(' ');
  const ct = new Set(candidate.split(' '));
  const overlap = qt.filter((t) => ct.has(t)).length;
  if (overlap > 0) return 0.5 + 0.2 * (overlap / Math.max(qt.length, ct.size));
  // Typos: allow 1 edit for short words, 2 for longer ones.
  const allowed = Math.max(query.length, candidate.length) >= 6 ? 2 : 1;
  if (Math.abs(query.length - candidate.length) <= allowed && editDistance(query, candidate) <= allowed) return 0.6;
  // A misspelt FIRST name against a full name ("Zulfiqarr" → "Zulfiqar Ahmed"):
  // compare the query with each word of the candidate, not just the whole.
  for (const token of ct) {
    if (token.length < 4) continue;
    const slack = Math.max(token.length, query.length) >= 6 ? 2 : 1;
    if (Math.abs(query.length - token.length) <= slack && editDistance(query, token) <= slack) return 0.7;
  }
  return 0;
}

/** Minimum score a match must reach to be trusted. */
export const MATCH_THRESHOLD = 0.6;

/** Best candidate for a free-text name, or null when nothing is close enough. */
export function matchName<T extends Named>(query: string | null | undefined, candidates: readonly T[]): Match<T> | null {
  if (!query) return null;
  const q = normalizeName(query);
  if (!q) return null;
  let best: Match<T> | null = null;
  for (const item of candidates) {
    const names = [item.name, ...(item.alt ?? [])];
    let s = 0;
    for (const n of names) s = Math.max(s, scoreOne(q, normalizeName(n)));
    if (s >= MATCH_THRESHOLD && (!best || s > best.score)) best = { item, score: s };
  }
  return best;
}

/**
 * Find every candidate whose name appears INSIDE a longer sentence
 * ("50 bag cement Akram se") — longest names first so "Plot Payment" beats
 * "Plot". Returns matches in order of appearance.
 */
export function findNamesIn<T extends Named>(text: string, candidates: readonly T[]): { item: T; index: number; length: number }[] {
  const hay = ` ${normalizeName(text)} `;
  const hits: { item: T; index: number; length: number }[] = [];
  const taken: boolean[] = new Array(hay.length).fill(false);
  const entries = candidates
    .flatMap((item) => [item.name, ...(item.alt ?? [])].map((n) => ({ item, n: normalizeName(n) })))
    .filter((e) => e.n.length >= 2)
    .sort((a, b) => b.n.length - a.n.length);
  for (const e of entries) {
    const needle = ` ${e.n} `;
    let from = 0;
    while (true) {
      const idx = hay.indexOf(needle, from);
      if (idx < 0) break;
      const start = idx + 1;
      const end = start + e.n.length;
      if (!taken.slice(start, end).some(Boolean) && !hits.some((h) => h.item.id === e.item.id)) {
        hits.push({ item: e.item, index: start, length: e.n.length });
        for (let i = start; i < end; i++) taken[i] = true;
      }
      from = idx + 1;
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

/**
 * The closest saved names to a query that matched nothing well enough — for a
 * "did you mean…" question. Relaxed ladder: shared word, shared 3-letter
 * prefix, or a small edit distance; falls back to the first few names.
 */
export function suggestNames<T extends Named>(query: string, candidates: readonly T[], n = 5): string[] {
  const q = normalizeName(query);
  const qTokens = q.split(' ').filter((x) => x.length >= 2);
  const scored = candidates.map((c) => {
    const names = [c.name, ...(c.alt ?? [])].map(normalizeName);
    let score = 0;
    for (const name of names) {
      const tokens = name.split(' ');
      if (name === q) score = Math.max(score, 3);
      if (qTokens.some((t) => tokens.includes(t))) score = Math.max(score, 2);
      if (qTokens.some((t) => tokens.some((k) => k.startsWith(t.slice(0, 3)) || t.startsWith(k.slice(0, 3))))) score = Math.max(score, 1.5);
      if (q.length >= 4 && editDistance(q, name) <= Math.max(2, Math.floor(q.length / 3))) score = Math.max(score, 1);
    }
    return { name: c.name, score };
  });
  const close = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.name);
  const out = close.length ? close : candidates.map((c) => c.name);
  return Array.from(new Set(out)).slice(0, n);
}
