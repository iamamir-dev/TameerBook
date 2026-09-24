import type { ResolvedDraft } from '@/ai';
import type { TranslationKey } from '@/i18n';
import { formatDisplayDate, todayISO } from '@/utils/date';
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
    case 'createPurchaseOrder':
      return t('bookingsTitle');
    case 'receiveDelivery':
      return t('poDelivered');
    case 'payPurchaseOrder':
      return t('payBookingLabel');
    case 'plotPayment':
      return t('sellerPaymentTypes');
    case 'plotExpense':
      return `${t('plotsTitle')} · ${t('kharcha')}`;
    case 'setSale':
      return t('aiSoldLabel');
    case 'saleReceipt':
      return t('buyerPaymentTypes');
    case 'saleCost':
      return `${t('aiSoldLabel')} · ${t('kharcha')}`;
    case 'investorPayment':
      return t('fromInvestor');
    case 'markTransferred':
      return t('markTransferred');
  }
}

/**
 * Which way the money moves, for colour and sign. DESIGN_GUIDELINES: money IN
 * is success green, money OUT is danger red, and colour is never the only
 * signal, so the amount also carries a sign.
 */
export function draftDirection(r: ResolvedDraft): 'in' | 'out' | null {
  switch (r.draft.kind) {
    case 'expense':
    case 'material':
    case 'payWorker':
    case 'udhaarGive':
    case 'payPurchaseOrder':
    case 'plotPayment':
    case 'plotExpense':
    case 'saleCost':
      return 'out';
    case 'income':
    case 'udhaarReturn':
    case 'saleReceipt':
    case 'investorPayment':
      return 'in';
    default:
      // Transfers move money between the user's own accounts, and add_* /
      // attendance move none: neither is a gain or a loss.
      return null;
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
    case 'createPurchaseOrder':
      return d.items.length ? d.items.reduce((s, i) => s + i.qty * i.rate, 0) : null;
    case 'payPurchaseOrder':
    case 'plotPayment':
    case 'plotExpense':
    case 'saleReceipt':
    case 'saleCost':
    case 'investorPayment':
      return d.amount ?? null;
    case 'setSale':
      return d.price ?? null;
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
  /** A party that is not in contacts is fine: the entry keeps the name. Show it as new, not as a problem. */
  const partyOrNew = (label: string) => {
    if (r.party) f.push({ label, value: r.party.name });
    else if (d.kind === 'expense' || d.kind === 'income' || d.kind === 'material') {
      if (d.party) f.push({ label, value: `${d.party} · ${t('aiNewShort')}` });
    }
  };
  const date = (iso?: string) => f.push({ label: t('date'), value: iso && iso !== todayISO() ? formatDisplayDate(iso) : t('today') });

  switch (d.kind) {
    case 'expense':
    case 'income':
      named(t('category'), r.category, d.category);
      partyOrNew(t('party'));
      named(t('projectLabel'), r.project, d.project);
      named(t('accountLabel'), r.account, d.account);
      if (d.note) f.push({ label: t('note'), value: d.note });
      date(d.date);
      break;
    case 'material':
      f.push({ label: t('material'), value: r.category ? r.category.name : `${d.item} · ${t('aiNewShort')}` });
      if (d.qty) f.push({ label: t('size'), value: `${formatQty(d.qty)} ${d.unit ?? ''}`.trim() });
      if (d.rate) f.push({ label: t('rateLabel'), value: formatRupees(d.rate), money: true });
      partyOrNew(t('supplier'));
      named(t('projectLabel'), r.project, d.project);
      named(t('accountLabel'), r.account, d.account);
      date(d.date);
      break;
    case 'attendance':
      named(t('projectLabel'), r.project, d.project);
      if (d.allPresent) f.push({ label: t('markAttendance'), value: t('aiAllPresent') });
      for (const m of r.marks) f.push({ label: m.worker?.name ?? m.mark.worker, value: statusLabel(t, m.mark.status), unresolved: !m.worker });
      date(d.date);
      break;
    case 'payWorker':
      named(t('laborTitle'), r.worker, d.worker);
      named(t('accountLabel'), r.account, d.account);
      if (d.note) f.push({ label: t('note'), value: d.note });
      date(d.date);
      break;
    case 'udhaarGive':
    case 'udhaarReturn':
      f.push({ label: t('party'), value: r.party?.name ?? d.person });
      f.push({ label: t('udhaar'), value: d.kind === 'udhaarGive' ? t('receivable') : t('fromUdhaarReturn') });
      named(t('accountLabel'), r.account, d.account);
      date(d.date);
      break;
    case 'transfer':
      named(t('fromAccount'), r.account, d.from);
      named(t('toAccount'), r.accountTo, d.to);
      date(d.date);
      break;
    case 'createWorker':
      if (d.name) f.push({ label: t('name'), value: d.name });
      if (d.phone) f.push({ label: t('sellerPhone'), value: d.phone });
      if (d.wage) f.push({ label: t('aiWage'), value: formatRupees(d.wage), money: true });
      named(t('projectLabel'), r.project, d.project);
      break;
    case 'createParty':
      if (d.name) f.push({ label: t('name'), value: d.name });
      f.push({ label: t('party'), value: d.partyType });
      if (d.phone) f.push({ label: t('sellerPhone'), value: d.phone });
      break;
    case 'createInvestor':
      if (d.name) f.push({ label: t('name'), value: d.name });
      if (d.phone) f.push({ label: t('sellerPhone'), value: d.phone });
      break;
    case 'createAccount':
      if (d.name) f.push({ label: t('name'), value: d.name });
      f.push({ label: t('accountLabel'), value: d.accountType });
      break;
    case 'createPlot':
      if (d.name) f.push({ label: t('name'), value: d.name });
      if (d.society) f.push({ label: t('society'), value: d.society });
      if (d.plotNo) f.push({ label: t('plotNo'), value: d.plotNo });
      if (d.seller) f.push({ label: t('seller'), value: d.seller });
      break;
    case 'createPurchaseOrder':
      // A supplier that is not saved yet is fine here: the PO stores the name.
      if (r.party) f.push({ label: t('supplier'), value: r.party.name });
      else if (d.supplier) f.push({ label: t('supplier'), value: `${d.supplier} (${t('addNew').toLowerCase()})` });
      named(t('projectLabel'), r.project, d.project);
      for (const it of d.items) f.push({ label: `${it.item} · ${formatQty(it.qty)}${it.unit ? ` ${it.unit}` : ''} @ ${formatQty(it.rate)}`, value: formatRupees(it.qty * it.rate), money: true });
      break;
    case 'receiveDelivery':
      if (d.po) f.push({ label: t('poLabelShort'), value: d.po });
      if (d.item) f.push({ label: t('material'), value: `${d.item}${d.qty ? ` · ${formatQty(d.qty)}` : ''}` });
      else f.push({ label: t('material'), value: t('aiAllItems') });
      date(d.date);
      break;
    case 'payPurchaseOrder':
      if (d.po) f.push({ label: t('poLabelShort'), value: d.po });
      named(t('accountLabel'), r.account, d.account);
      date(d.date);
      break;
    case 'plotPayment':
      named(t('plotLabel'), r.plot, d.plot);
      if (d.payType) f.push({ label: t('paymentType'), value: payTypeLabel(t, d.payType) });
      named(t('accountLabel'), r.account, d.account);
      date(d.date);
      break;
    case 'plotExpense':
      named(t('plotLabel'), r.plot, d.plot);
      named(t('category'), r.category, d.category);
      named(t('accountLabel'), r.account, d.account);
      if (d.note) f.push({ label: t('note'), value: d.note });
      date(d.date);
      break;
    case 'setSale':
      named(t('projectLabel'), r.project, d.project);
      f.push({ label: t('party'), value: r.party?.name ?? d.buyer ?? '—', unresolved: !r.party && !!d.buyer });
      break;
    case 'saleReceipt':
      named(t('projectLabel'), r.project, d.project);
      if (d.payType) f.push({ label: t('paymentType'), value: payTypeLabel(t, d.payType) });
      named(t('accountLabel'), r.account, d.account);
      date(d.date);
      break;
    case 'saleCost':
      named(t('projectLabel'), r.project, d.project);
      if (d.note) f.push({ label: t('note'), value: d.note });
      named(t('accountLabel'), r.account, d.account);
      date(d.date);
      break;
    case 'investorPayment':
      named(t('investor'), r.investor, d.investor);
      named(t('projectLabel'), r.project, d.project);
      named(t('accountLabel'), r.account, d.account);
      date(d.date);
      break;
    case 'markTransferred':
      named(t('plotLabel'), r.plot, d.plot);
      date(d.date);
      break;
    case 'createProject':
      if (d.name) f.push({ label: t('projectName'), value: d.name });
      named(t('plotLabel'), r.plot, d.plot);
      for (const inv of r.investors) {
        f.push({
          // Short label so the amount keeps its column: "Umar · new" not "Investor · Umar (add new)".
          label: `${inv.ref?.name ?? inv.draft.name}${inv.ref ? '' : ` · ${t('aiNewShort')}`}`,
          value: inv.draft.amount ? formatRupees(inv.draft.amount) : '—',
          money: !!inv.draft.amount,
        });
      }
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

const PAY_TYPE_KEYS = { TOKEN: 'ptToken', BAYANA: 'ptBayana', INSTALLMENT: 'ptInstallment', FINAL: 'ptFinal' } as const;
function payTypeLabel(t: T, pt: string): string {
  const key = PAY_TYPE_KEYS[pt as keyof typeof PAY_TYPE_KEYS];
  return key ? t(key) : pt;
}

const STATUS_KEYS: Record<string, TranslationKey> = { FULL: 'attFull', HALF: 'attHalf', ABSENT: 'attAbsent' };
function statusLabel(t: T, status: string): string {
  const key = STATUS_KEYS[status];
  return key ? t(key) : status;
}
