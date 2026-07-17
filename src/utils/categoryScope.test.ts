import { describe, expect, it } from 'vitest';

import type { CategoryRow } from '@/db/schema';

import { scopeCategoriesToContext } from './categoryScope';

/** Minimal category-row factory (only the fields the scoper reads). */
function cat(partial: Partial<CategoryRow> & Pick<CategoryRow, 'id' | 'name_en'>): CategoryRow {
  return {
    created_at: '2026-01-01',
    created_by: 'local',
    parent_id: null,
    name_ur: partial.name_en,
    type: 'EXPENSE',
    icon: null,
    is_system: 0,
    default_unit: null,
    sort_order: 0,
    ...partial,
  } as CategoryRow;
}

// A representative tree mirroring the seeded DEFAULT_CATEGORIES shape.
const materials = cat({ id: 'h-mat', name_en: 'Materials', is_system: 1 });
const labor = cat({ id: 'h-lab', name_en: 'Labor', is_system: 1 });
const plot = cat({ id: 'h-plot', name_en: 'Plot', is_system: 1 });
const home = cat({ id: 'h-home', name_en: 'Home Expense', is_system: 1 });
const sale = cat({ id: 'h-sale', name_en: 'Sale', is_system: 1 });

const cement = cat({ id: 'c-cement', name_en: 'Cement', parent_id: 'h-mat' });
const laborDehari = cat({ id: 'c-dehari', name_en: 'Labor Dehari', parent_id: 'h-lab' });
const laborPayment = cat({ id: 'c-labpay', name_en: 'Labor Payment', parent_id: 'h-lab', is_system: 1 });
const plotPayment = cat({ id: 'c-plotpay', name_en: 'Plot Payment', parent_id: 'h-plot', is_system: 1 });
const transferFees = cat({ id: 'c-transfee', name_en: 'Transfer Fees & Tax', parent_id: 'h-plot' });
const groceries = cat({ id: 'c-groc', name_en: 'Groceries', parent_id: 'h-home' });
const saleCost = cat({ id: 'c-salecost', name_en: 'Sale Cost', parent_id: 'h-sale', is_system: 1 });
const misc = cat({ id: 'c-misc', name_en: 'Misc' }); // standalone leaf

const expenseAll = [
  materials, labor, plot, home, sale,
  cement, laborDehari, laborPayment, plotPayment, transferFees, groceries, saleCost, misc,
];

const otherIncome = cat({ id: 'i-other', name_en: 'Other Income', type: 'INCOME' });
const buyerReceipt = cat({ id: 'i-buyer', name_en: 'Buyer Receipt', type: 'INCOME', is_system: 1 });
const incomeAll = [otherIncome, buyerReceipt];

const names = (rows: CategoryRow[]) => rows.map((r) => r.name_en);

describe('scopeCategoriesToContext', () => {
  it('never returns headings or system/business categories', () => {
    for (const ctx of ['plot', 'construction', 'home', 'sale', 'general'] as const) {
      const out = scopeCategoriesToContext(expenseAll, ctx);
      expect(out.some((c) => c.is_system)).toBe(false);
      expect(out.map((c) => c.id)).not.toContain('h-mat'); // heading
      expect(names(out)).not.toContain('Labor Payment'); // business-posted
      expect(names(out)).not.toContain('Plot Payment');
      expect(names(out)).not.toContain('Sale Cost');
    }
  });

  it('construction = Materials + Labor subs + standalone leaves', () => {
    expect(names(scopeCategoriesToContext(expenseAll, 'construction')).sort()).toEqual(
      ['Cement', 'Labor Dehari', 'Misc'].sort()
    );
  });

  it('plot = Plot subs + standalone leaves, no Groceries', () => {
    const out = names(scopeCategoriesToContext(expenseAll, 'plot'));
    expect(out).toContain('Transfer Fees & Tax');
    expect(out).toContain('Misc');
    expect(out).not.toContain('Groceries');
    expect(out).not.toContain('Cement');
  });

  it('home = Home Expense subs only (no standalone Misc)', () => {
    expect(names(scopeCategoriesToContext(expenseAll, 'home'))).toEqual(['Groceries']);
  });

  it('sale = Sale subs only (Sale Cost is system → empty here)', () => {
    expect(names(scopeCategoriesToContext(expenseAll, 'sale'))).toEqual([]);
  });

  it('general = every bookable leaf across headings', () => {
    expect(names(scopeCategoriesToContext(expenseAll, 'general')).sort()).toEqual(
      ['Cement', 'Groceries', 'Labor Dehari', 'Misc', 'Transfer Fees & Tax'].sort()
    );
  });

  it('income = income leaves only, drops system Buyer Receipt', () => {
    expect(names(scopeCategoriesToContext(incomeAll, 'income'))).toEqual(['Other Income']);
  });

  it('preserves input order', () => {
    const out = scopeCategoriesToContext(expenseAll, 'general');
    expect(out).toEqual([...out].sort((a, b) => expenseAll.indexOf(a) - expenseAll.indexOf(b)));
  });
});
