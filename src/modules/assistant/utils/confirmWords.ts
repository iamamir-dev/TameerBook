import type { Turn } from '../hooks/useAssistant';

/**
 * A typed "haan" / "nahi" while a write is waiting for confirmation is an
 * answer to the card, not a new request: it opens the confirmation (or
 * rejects it) without a model call. Pure + unit-tested.
 */
const YES = /^(haan|han|ha|hanji|ji|jee|g|yes|yep|y|ok|okay|theek|thik|theek hai|sahi|sahi hai|kar do|kardo|save|save karo|save kar do|confirm|done|accept|ہاں|جی|ٹھیک|ٹھیک ہے|صحیح|کر دو|محفوظ کرو|منظور)[\s!.،۔]*$/i;
const NO = /^(nahi|nahin|nai|no|nope|na|cancel|reject|rehne do|rehne do|chor do|نہیں|نہ|رہنے دو|منسوخ|مسترد)[\s!.،۔]*$/i;

export const isYes = (text: string): boolean => YES.test(text.trim());
export const isNo = (text: string): boolean => NO.test(text.trim());

export interface PendingDraft {
  turnId: string;
  index: number;
}

/** The first unsettled write of the newest assistant turn, if that turn is still waiting on one. */
export function pendingDraft(turns: readonly Turn[]): PendingDraft | null {
  const last = [...turns].reverse().find((t) => t.role === 'assistant');
  if (!last || last.role !== 'assistant' || !('drafts' in last) || last.drafts.length === 0) return null;
  const index = last.drafts.findIndex((_, i) => !last.settled?.[i]);
  return index === -1 ? null : { turnId: last.id, index };
}
