import type { EntryPrefill } from '@/navigation/types';

import { matchName, type Named } from './match';

/**
 * DRAFTS — an entry the model extracted from speech / text / a bill photo.
 * A draft is never saved. It is resolved against the user's own names, then
 * turned into a PREFILL for an existing confirm screen. Pure + unit-tested.
 */

export type AttendanceStatusDraft = 'FULL' | 'HALF' | 'ABSENT';

export interface AttendanceMark {
  worker: string;
  status: AttendanceStatusDraft;
}

export type Draft =
  // `amount` may be missing — the confirmation sheet asks for it.
  | { kind: 'expense'; amount?: number; category?: string; project?: string; party?: string; account?: string; note?: string; date?: string }
  | { kind: 'income'; amount?: number; category?: string; project?: string; party?: string; account?: string; note?: string; date?: string }
  | {
      kind: 'material';
      item: string;
      qty?: number;
      unit?: string;
      rate?: number;
      amount?: number;
      project?: string;
      party?: string;
      account?: string;
      date?: string;
    }
  | { kind: 'attendance'; project?: string; date?: string; allPresent: boolean; marks: AttendanceMark[] }
  | { kind: 'payWorker'; worker: string; amount?: number; account?: string; date?: string; note?: string }
  | { kind: 'udhaarGive'; person: string; amount?: number; account?: string; date?: string }
  | { kind: 'udhaarReturn'; person: string; amount?: number; account?: string; date?: string }
  | { kind: 'transfer'; from: string; to: string; amount?: number; date?: string }
  // "Add …" requests — new records, created after the user confirms.
  // `name` may be missing — the confirmation sheet asks for it.
  | { kind: 'createWorker'; name?: string; phone?: string; wage?: number; project?: string }
  | { kind: 'createParty'; name?: string; partyType: PartyTypeDraft; phone?: string }
  | { kind: 'createInvestor'; name?: string; phone?: string; amount?: number }
  | { kind: 'createAccount'; name?: string; accountType: AccountTypeDraft; openingBalance?: number }
  | { kind: 'createPlot'; name?: string; society?: string; plotNo?: string; dealPrice?: number; seller?: string }
  | { kind: 'createProject'; name?: string; plot?: string };

export type DraftKind = Draft['kind'];
export const PARTY_TYPE_DRAFTS = ['SUPPLIER', 'BUYER', 'SELLER', 'CONTRACTOR', 'DEALER'] as const;
export type PartyTypeDraft = (typeof PARTY_TYPE_DRAFTS)[number];
export const ACCOUNT_TYPE_DRAFTS = ['BANK', 'CASH', 'WALLET'] as const;
export type AccountTypeDraft = (typeof ACCOUNT_TYPE_DRAFTS)[number];
/** Drafts that ADD a record (vs. money drafts that post a transaction). */
export const CREATE_KINDS: ReadonlySet<DraftKind> = new Set<DraftKind>(['createWorker', 'createParty', 'createInvestor', 'createAccount', 'createPlot', 'createProject']);

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
};
const day = (v: unknown): string | undefined => (typeof v === 'string' && ISO_DAY.test(v) ? v : undefined);

/** Validate + coerce a raw model object into a `Draft` (null = unusable). */
export function coerceDraft(raw: unknown): Draft | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  switch (kind) {
    case 'expense':
    case 'income': {
      const amount = num(o.amount) || undefined;
      const d = { kind, amount, category: str(o.category), project: str(o.project), party: str(o.party), account: str(o.account), note: str(o.note), date: day(o.date) };
      // Something must identify the entry: an amount, or what/who it was for.
      if (!amount && !d.category && !d.party && !d.note && !d.project) return null;
      return d;
    }
    case 'material': {
      const item = str(o.item);
      if (!item) return null;
      const qty = num(o.qty) || undefined;
      const rate = num(o.rate) || undefined;
      const amount = (num(o.amount) || undefined) ?? (qty && rate ? Math.round(qty * rate) : undefined);
      return { kind, item, qty, unit: str(o.unit), rate, amount, project: str(o.project), party: str(o.party), account: str(o.account), date: day(o.date) };
    }
    case 'attendance': {
      const marksRaw = Array.isArray(o.marks) ? o.marks : [];
      const marks: AttendanceMark[] = [];
      for (const m of marksRaw) {
        if (!m || typeof m !== 'object') continue;
        const mm = m as Record<string, unknown>;
        const worker = str(mm.worker);
        const status = typeof mm.status === 'string' ? mm.status.toUpperCase() : '';
        if (worker && (status === 'FULL' || status === 'HALF' || status === 'ABSENT')) marks.push({ worker, status });
      }
      const allPresent = o.allPresent === true;
      if (!allPresent && marks.length === 0) return null;
      return { kind, project: str(o.project), date: day(o.date), allPresent, marks };
    }
    case 'payWorker': {
      const worker = str(o.worker);
      if (!worker) return null;
      return { kind, worker, amount: num(o.amount) || undefined, account: str(o.account), date: day(o.date), note: str(o.note) };
    }
    case 'udhaarGive':
    case 'udhaarReturn': {
      const person = str(o.person);
      if (!person) return null;
      return { kind, person, amount: num(o.amount) || undefined, account: str(o.account), date: day(o.date) };
    }
    case 'transfer': {
      const from = str(o.from);
      const to = str(o.to);
      if (!from || !to) return null;
      return { kind, from, to, amount: num(o.amount) || undefined, date: day(o.date) };
    }
    case 'createWorker':
      return { kind, name: str(o.name), phone: str(o.phone), wage: num(o.wage) || undefined, project: str(o.project) };
    case 'createParty': {
      const name = str(o.name);
      const pt = typeof o.partyType === 'string' ? o.partyType.toUpperCase() : '';
      const partyType = (PARTY_TYPE_DRAFTS as readonly string[]).includes(pt) ? (pt as PartyTypeDraft) : 'SUPPLIER';
      return { kind, name, partyType, phone: str(o.phone) };
    }
    case 'createInvestor':
      return { kind, name: str(o.name), phone: str(o.phone), amount: num(o.amount) || undefined };
    case 'createAccount': {
      const name = str(o.name);
      const at = typeof o.accountType === 'string' ? o.accountType.toUpperCase() : '';
      const accountType = (ACCOUNT_TYPE_DRAFTS as readonly string[]).includes(at) ? (at as AccountTypeDraft) : 'BANK';
      return { kind, name, accountType, openingBalance: num(o.openingBalance) };
    }
    case 'createPlot': {
      const name = str(o.name) ?? ([str(o.society), str(o.plotNo)].filter(Boolean).join(' ') || undefined);
      return { kind, name, society: str(o.society), plotNo: str(o.plotNo), dealPrice: num(o.dealPrice) || undefined, seller: str(o.seller) };
    }
    case 'createProject':
      return { kind, name: str(o.name), plot: str(o.plot) };
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Resolution against the user's own names                                   */
/* -------------------------------------------------------------------------- */

export interface CategoryNamed extends Named {
  type: 'INCOME' | 'EXPENSE';
  unit: string | null;
  parentId: string | null;
}

/** Everything the assistant may refer to by name (ids stay on the phone). */
export interface WorldNames {
  projects: Named[];
  plots: Named[];
  accounts: Named[];
  categories: CategoryNamed[];
  parties: Named[];
  workers: Named[];
  investors: Named[];
}

export interface Ref {
  id: string;
  name: string;
}

export interface ResolvedDraft {
  draft: Draft;
  project?: Ref;
  plot?: Ref;
  account?: Ref;
  accountTo?: Ref;
  category?: Ref;
  party?: Ref;
  worker?: Ref;
  /** Attendance: each spoken mark with its matched worker (null = unknown name). */
  marks: { mark: AttendanceMark; worker: Ref | null }[];
  /** Names the model used that matched nothing — shown to the user to fix. */
  unresolved: string[];
}

const ref = <T extends Named>(q: string | undefined, list: readonly T[], unresolved: string[]): Ref | undefined => {
  if (!q) return undefined;
  const m = matchName(q, list);
  if (!m) {
    unresolved.push(q);
    return undefined;
  }
  return { id: m.item.id, name: m.item.name };
};

/** Match every name in the draft to a real row; unknown names are reported, not guessed. */
export function resolveDraft(draft: Draft, world: WorldNames): ResolvedDraft {
  const unresolved: string[] = [];
  const r: ResolvedDraft = { draft, marks: [], unresolved };
  switch (draft.kind) {
    case 'expense':
    case 'income': {
      const cats = world.categories.filter((c) => c.type === (draft.kind === 'expense' ? 'EXPENSE' : 'INCOME'));
      r.category = ref(draft.category, cats, unresolved);
      r.project = ref(draft.project, world.projects, unresolved);
      r.party = ref(draft.party, world.parties, unresolved);
      r.account = ref(draft.account, world.accounts, unresolved);
      break;
    }
    case 'material': {
      // Material items are EXPENSE sub-categories (they carry a unit).
      const materials = world.categories.filter((c) => c.type === 'EXPENSE' && c.parentId);
      r.category = ref(draft.item, materials, []);
      r.project = ref(draft.project, world.projects, unresolved);
      r.party = ref(draft.party, world.parties, unresolved);
      r.account = ref(draft.account, world.accounts, unresolved);
      break;
    }
    case 'attendance':
      r.project = ref(draft.project, world.projects, unresolved);
      r.marks = draft.marks.map((mark) => {
        const m = matchName(mark.worker, world.workers);
        if (!m) unresolved.push(mark.worker);
        return { mark, worker: m ? { id: m.item.id, name: m.item.name } : null };
      });
      break;
    case 'payWorker':
      r.worker = ref(draft.worker, world.workers, unresolved);
      r.account = ref(draft.account, world.accounts, unresolved);
      break;
    case 'udhaarGive':
    case 'udhaarReturn':
      r.party = ref(draft.person, world.parties, []);
      r.account = ref(draft.account, world.accounts, unresolved);
      break;
    case 'transfer':
      r.account = ref(draft.from, world.accounts, unresolved);
      r.accountTo = ref(draft.to, world.accounts, unresolved);
      break;
    case 'createWorker':
      r.project = ref(draft.project, world.projects, unresolved);
      break;
    case 'createProject':
      r.plot = ref(draft.plot, world.plots, unresolved);
      break;
    case 'createParty':
    case 'createInvestor':
    case 'createAccount':
    case 'createPlot':
      break;
  }
  return r;
}

/* -------------------------------------------------------------------------- */
/*  Draft → prefill for the existing confirm screens                          */
/* -------------------------------------------------------------------------- */

/** Prefill for the generic Entry screen (expense / income). */
export function draftToEntryPrefill(r: ResolvedDraft): { direction: 'IN' | 'OUT'; prefill: EntryPrefill } | null {
  const d = r.draft;
  if (d.kind !== 'expense' && d.kind !== 'income') return null;
  return {
    direction: d.kind === 'expense' ? 'OUT' : 'IN',
    prefill: {
      amount: d.amount,
      categoryId: r.category?.id ?? null,
      note: d.note,
      accountId: r.account?.id,
      projectId: r.project?.id,
      partyId: r.party?.id ?? null,
    },
  };
}

/** Prefill for the Material Entry screen. */
export interface MaterialPrefill {
  categoryId?: string | null;
  /** Free-text item name when the material is not a managed category. */
  itemName?: string;
  qty?: number;
  rate?: number;
  amount?: number;
  projectId?: string;
  partyId?: string | null;
  accountId?: string;
  date?: string;
}

export function draftToMaterialPrefill(r: ResolvedDraft): MaterialPrefill | null {
  const d = r.draft;
  if (d.kind !== 'material') return null;
  return {
    categoryId: r.category?.id ?? null,
    itemName: r.category ? undefined : d.item,
    qty: d.qty,
    rate: d.rate,
    amount: d.amount,
    projectId: r.project?.id,
    partyId: r.party?.id ?? null,
    accountId: r.account?.id,
    date: d.date,
  };
}

/** Prefill for the New Purchase Order screen (a multi-line bill). */
export interface PurchaseOrderPrefill {
  supplierName?: string;
  partyId?: string | null;
  projectId?: string;
  items: { categoryId?: string | null; name: string; qty: number; rate: number }[];
}
