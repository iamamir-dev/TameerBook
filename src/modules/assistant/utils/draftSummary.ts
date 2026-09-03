import type { ResolvedDraft } from '@/ai';
import type { TranslationKey } from '@/i18n';
import { formatDisplayDate } from '@/utils/date';
import { formatQty, formatRupees } from '@/utils/money';

type T = (k: TranslationKey) => string;

/** One label/value pair shown in the confirmation sheet. */
export interface DraftField {
  label: string;
  value: string;
  /** Rupee values render bold + tabular. */
  money?: boolean;
  /** Set when the value came from the user's words but matched nothing saved. */
  unresolved?: boolean;
}

/** Card title per draft kind ("Expense", "New worker"…). */
export function draftTitle(r: ResolvedDraft, t: T): string {
  switch (r.draft.kind) {
    case 'expense':
      return t('kharcha');
    case 'income':
      return t('aamdani');
    case 'material':
      return t('material');
    case 'attendance':
      return t('markAttendance');
    case 'payWorker':
      return t('payWorker');
    case 'udhaarGive':
    case 'udhaarReturn':
      return t('udhaar');
    case 'transfer':
      return t('transferTitleV2');
    case 'createWorker':
      return t('aiNewWorker');
    case 'createParty':
      return t('aiNewParty');
    case 'createInvestor':
      return t('aiNewInvestor');
    case 'createAccount':
      return t('aiNewAccount');
    case 'createPlot':
      return t('aiNewPlot');
    case 'createProject':
      return t('newProject');
  }
}

/** The headline figure, when the draft is about money. */
export function draftAmount(r: ResolvedDraft): number | null {
  const d = r.draft;
  switch (d.kind) {
    case 'expense':
    case 'income':
    case 'payWorker':
    case 'udhaarGive':
    case 'udhaarReturn':
    case 'transfer':
      return d.amount ?? null;
    case 'material':
      return d.amount ?? (d.qty && d.rate ? Math.round(d.qty * d.rate) : null);
    case 'createInvestor':
      return d.amount ?? null;
    case 'createAccount':
      return d.openingBalance ?? null;
    case 'createPlot':
      return d.dealPrice ?? null;
    default:
      return null;
  }
}

/**
 * The fields the confirmation sheet lists, built from RESOLVED names so a
 * matched "akram" reads "Akram Traders". Unresolved names are flagged.
 */
export function draftFields(r: ResolvedDraft, t: T): DraftField[] {
  const d = r.draft;
  const f: DraftField[] = [];
  const named = (label: string, ref: { name: string } | undefined, spoken: string | undefined) => {
    if (ref) f.push({ label, value: ref.name });
    else if (spoken) f.push({ label, value: spoken, unresolved: true });
  };
  const date = (iso?: string) => f.push({ label: t('date'), value: iso ? formatDisplayDate(iso) : t('today') });

  switch (d.kind) {
    case 'expense':
    case 'income':
      named(t('category'), r.category, d.category);
      named(t('party'), r.party, d.party);
      named(t('projectLabel'), r.project, d.project);
      named(t('accountsTitle'), r.account, d.account);
      if (d.note) f.push({ label: t('note'), value: d.note });
      date(d.date);
      break;
    case 'material':
      named(t('material'), r.category, d.item);
      if (d.qty) f.push({ label: t('size'), value: `${formatQty(d.qty)} ${d.unit ?? ''}`.trim() });
      if (d.rate) f.push({ label: t('rateLabel'), value: formatRupees(d.rate), money: true });
      named(t('supplier'), r.party, d.party);
      named(t('projectLabel'), r.project, d.project);
      named(t('accountsTitle'), r.account, d.account);
      date(d.date);
      break;
    case 'attendance':
      named(t('projectLabel'), r.project, d.project);
      if (d.allPresent) f.push({ label: t('markAttendance'), value: t('aiAllPresent') });
      for (const m of r.marks) f.push({ label: m.worker?.name ?? m.mark.worker, value: m.mark.status, unresolved: !m.worker });
      date(d.date);
      break;
    case 'payWorker':
      named(t('laborTitle'), r.worker, d.worker);
      named(t('accountsTitle'), r.account, d.account);
      if (d.note) f.push({ label: t('note'), value: d.note });
      date(d.date);
      break;
    case 'udhaarGive':
    case 'udhaarReturn':
      f.push({ label: t('party'), value: r.party?.name ?? d.person });
      f.push({ label: t('udhaar'), value: d.kind === 'udhaarGive' ? t('receivable') : t('fromUdhaarReturn') });
      named(t('accountsTitle'), r.account, d.account);
      date(d.date);
      break;
    case 'transfer':
      named(t('fromAccount'), r.account, d.from);
      named(t('toAccount'), r.accountTo, d.to);
      date(d.date);
      break;
    case 'createWorker':
      f.push({ label: t('name'), value: d.name });
      if (d.phone) f.push({ label: t('sellerPhone'), value: d.phone });
      if (d.wage) f.push({ label: t('aiWage'), value: formatRupees(d.wage), money: true });
      named(t('projectLabel'), r.project, d.project);
      break;
    case 'createParty':
      f.push({ label: t('name'), value: d.name });
      f.push({ label: t('party'), value: d.partyType });
      if (d.phone) f.push({ label: t('sellerPhone'), value: d.phone });
      break;
    case 'createInvestor':
      f.push({ label: t('name'), value: d.name });
      if (d.phone) f.push({ label: t('sellerPhone'), value: d.phone });
      break;
    case 'createAccount':
      f.push({ label: t('name'), value: d.name });
      f.push({ label: t('accountsTitle'), value: d.accountType });
      break;
    case 'createPlot':
      f.push({ label: t('name'), value: d.name });
      if (d.society) f.push({ label: t('society'), value: d.society });
      if (d.plotNo) f.push({ label: t('plotNo'), value: d.plotNo });
      if (d.seller) f.push({ label: t('seller'), value: d.seller });
      break;
    case 'createProject':
      f.push({ label: t('projectName'), value: d.name });
      named(t('plotsTitle'), r.plot, d.plot);
      break;
  }
  return f;
}

/** One-line summary for the chat card: title + the fields joined. */
export function draftSummary(r: ResolvedDraft, t: T): { title: string; line: string } {
  const amount = draftAmount(r);
  const parts = [amount != null ? formatRupees(amount) : undefined, ...draftFields(r, t).filter((x) => x.label !== t('date')).map((x) => x.value)];
  return { title: draftTitle(r, t), line: parts.filter((p): p is string => !!p).join(' · ') };
}
