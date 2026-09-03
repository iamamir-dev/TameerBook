import type { PurchaseOrderPrefill, MaterialPrefill, WorldNames } from './drafts';
import { matchName } from './match';

/**
 * BILL READING — what the vision model extracts from a supplier bill / parchi
 * photo, validated and matched to the user's own materials + suppliers.
 * Pure + unit-tested; the image call lives in the module hook.
 */

export interface BillItem {
  item: string;
  qty?: number;
  unit?: string;
  rate?: number;
  amount?: number;
}

export interface Bill {
  supplier?: string;
  date?: string;
  items: BillItem[];
  total?: number;
  paid?: number;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.]/g, ''));
    if (v.trim() && Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
};

/** Validate the model's JSON; drops items with no name and fills amount = qty × rate. */
export function coerceBill(raw: unknown): Bill | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const items: BillItem[] = [];
  for (const it of Array.isArray(o.items) ? o.items : []) {
    if (!it || typeof it !== 'object') continue;
    const r = it as Record<string, unknown>;
    const item = str(r.item) ?? str(r.name);
    if (!item) continue;
    const qty = num(r.qty);
    const rate = num(r.rate);
    const amount = num(r.amount) ?? (qty && rate ? Math.round(qty * rate) : undefined);
    if (!qty && !amount) continue;
    items.push({ item, qty, unit: str(r.unit), rate: rate ?? (qty && amount ? Math.round(amount / qty) : undefined), amount });
  }
  const c = o.confidence;
  const confidence: Bill['confidence'] = c === 'high' || c === 'medium' || c === 'low' ? c : 'low';
  const date = typeof o.date === 'string' && ISO_DAY.test(o.date) ? o.date : undefined;
  return {
    supplier: str(o.supplier),
    date,
    items,
    total: num(o.total) ?? (items.length ? items.reduce((s, i) => s + (i.amount ?? 0), 0) || undefined : undefined),
    paid: num(o.paid),
    confidence,
    notes: str(o.notes),
  };
}

/** A single-line bill → Material Entry prefill (category + supplier matched). */
export function billToMaterialPrefill(bill: Bill, world: WorldNames, projectId?: string): MaterialPrefill | null {
  const line = bill.items[0];
  if (!line) return null;
  const materials = world.categories.filter((c) => c.type === 'EXPENSE' && c.parentId);
  const cat = matchName(line.item, materials)?.item;
  const party = matchName(bill.supplier, world.parties)?.item;
  return {
    categoryId: cat?.id ?? null,
    itemName: cat ? undefined : line.item,
    qty: line.qty,
    rate: line.rate,
    amount: line.amount,
    partyId: party?.id ?? null,
    projectId,
    date: bill.date,
  };
}

/** A multi-line bill → New Purchase Order prefill. */
export function billToPurchaseOrderPrefill(bill: Bill, world: WorldNames, projectId?: string): PurchaseOrderPrefill {
  const materials = world.categories.filter((c) => c.type === 'EXPENSE' && c.parentId);
  const party = matchName(bill.supplier, world.parties)?.item;
  return {
    supplierName: party ? undefined : bill.supplier,
    partyId: party?.id ?? null,
    projectId,
    items: bill.items
      .filter((i) => (i.qty ?? 0) > 0)
      .map((i) => {
        const cat = matchName(i.item, materials)?.item;
        return {
          categoryId: cat?.id ?? null,
          name: cat?.name ?? i.item,
          qty: i.qty ?? 0,
          rate: i.rate ?? (i.amount && i.qty ? Math.round(i.amount / i.qty) : 0),
        };
      }),
  };
}
