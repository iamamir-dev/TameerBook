import type { Answer } from '@/ai';
import { formatRupees } from '@/utils/money';

/**
 * Plain-text rendering of an answer card, so "Copy" on a card-only reply
 * copies something useful (title, headline, every row) instead of nothing.
 */
export function answerToText(a: Answer): string {
  const lines: string[] = [a.title];
  if (a.headline) lines.push(`${a.headline}${a.sub ? ` · ${a.sub}` : ''}`);
  else if (a.sub) lines.push(a.sub);
  const row = (r: Answer['rows'][number]) => `- ${r.title}${r.subtitle ? ` (${r.subtitle})` : ''}: ${r.direction === 'in' ? '+' : '−'} ${formatRupees(r.amount)}`;
  if (a.list?.length) for (const item of a.list) lines.push(`- ${item.title}${item.subtitle ? ` · ${item.subtitle}` : ''}`);
  for (const r of a.rows) lines.push(row(r));
  for (const sec of a.sections ?? []) {
    lines.push('', `${sec.title}:`);
    for (const r of sec.rows) lines.push(row(r));
  }
  return lines.join('\n').trim();
}

/** Everything in one assistant turn as copyable text: the reply, then each card. */
export function turnToText(text: string, cards: Answer[]): string {
  return [text.trim(), ...cards.map(answerToText)].filter(Boolean).join('\n\n');
}
