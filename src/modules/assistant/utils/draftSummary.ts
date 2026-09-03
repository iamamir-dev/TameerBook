import type { ResolvedDraft } from '@/ai';
import type { TranslationKey } from '@/i18n';
import { formatQty, formatRupees } from '@/utils/money';

/**
 * One line that tells the user what the assistant understood, built from the
 * RESOLVED names (so a matched "akram" shows as "Akram Traders"). Fragments
 * joined with " · " read the same in English and Urdu.
 */
export function draftSummary(r: ResolvedDraft, t: (k: TranslationKey) => string): { title: string; line: string } {
  const d = r.draft;
  const money = formatRupees;
  const parts: (string | undefined)[] = [];
  let title = t('aiDraftTitle');
  switch (d.kind) {
    case 'expense':
    case 'income':
      title = d.kind === 'expense' ? t('kharcha') : t('aamdani');
      parts.push(money(d.amount), r.category?.name ?? d.category, r.party?.name ?? d.party, r.project?.name ?? d.project, r.account?.name ?? d.account, d.note);
      break;
    case 'material':
      title = t('material');
      parts.push(
        r.category?.name ?? d.item,
        d.qty ? `${formatQty(d.qty)} ${d.unit ?? ''}`.trim() : undefined,
        d.rate ? `@ ${formatQty(d.rate)}` : undefined,
        d.amount ? money(d.amount) : undefined,
        r.party?.name ?? d.party,
        r.project?.name ?? d.project,
        r.account?.name ?? d.account
      );
      break;
    case 'attendance':
      title = t('markAttendance');
      parts.push(r.project?.name ?? d.project, d.date, d.allPresent ? t('aiAllPresent') : undefined, ...r.marks.map((m) => `${m.worker?.name ?? m.mark.worker}: ${m.mark.status}`));
      break;
    case 'payWorker':
      title = t('payWorker');
      parts.push(r.worker?.name ?? d.worker, money(d.amount), r.account?.name ?? d.account, d.note);
      break;
    case 'udhaarGive':
    case 'udhaarReturn':
      title = t('udhaar');
      parts.push(r.party?.name ?? d.person, money(d.amount), d.kind === 'udhaarGive' ? t('receivable') : t('fromUdhaarReturn'), r.account?.name ?? d.account);
      break;
    case 'transfer':
      title = t('transferTitleV2');
      parts.push(money(d.amount), `${r.account?.name ?? d.from} → ${r.accountTo?.name ?? d.to}`);
      break;
  }
  return { title, line: parts.filter((p): p is string => !!p && p.length > 0).join(' · ') };
}
