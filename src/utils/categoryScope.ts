import { type CategoryRow, SYSTEM_CATEGORY_NAMES } from '@/db/schema';

/**
 * Where a category picker is being shown. Each module sees ONLY its own
 * Settings-managed categories, scoped to where they're used (an explicit
 * product rule): the Plot page never offers Groceries, Construction never
 * offers Sale costs, etc. Centralizes the per-screen leaf-filtering that used
 * to be reimplemented inline (see the old EntryScreen scoping block).
 *
 * Pure (no DB import) so it's unit-tested headlessly; the repo wrapper
 * `listCategoriesForContext` just feeds it the rows.
 */
export type CategoryContext =
  | 'plot'
  | 'construction'
  | 'home'
  | 'sale'
  | 'income'
  | 'general';

/** Heading `name_en`s that anchor each expense context. */
const CONTEXT_HEADINGS: Record<'plot' | 'construction' | 'home' | 'sale', string[]> = {
  plot: ['Plot'],
  construction: ['Materials', 'Labor'],
  home: ['Home Expense'],
  sale: ['Sale'],
};

/** Contexts that also include top-level standalone leaves (e.g. "Misc"). */
const STANDALONE_CONTEXTS = new Set<CategoryContext>(['plot', 'construction', 'general']);

/**
 * Given ALL categories of the right type, return only the bookable LEAF
 * categories for `context` (never headings, never system/business-posted ones),
 * order preserved.
 */
export function scopeCategoriesToContext(
  all: CategoryRow[],
  context: CategoryContext
): CategoryRow[] {
  const parentIds = new Set(all.map((c) => c.parent_id).filter(Boolean) as string[]);
  const systemNames = SYSTEM_CATEGORY_NAMES as readonly string[];
  // A bookable leaf: user category (not locked/business), not a heading.
  const leaves = all.filter(
    (c) => !c.is_system && !systemNames.includes(c.name_en) && !parentIds.has(c.id)
  );

  if (context === 'income' || context === 'general') return leaves;

  const headings = CONTEXT_HEADINGS[context];
  const headingIds = new Set(
    all.filter((c) => !c.parent_id && headings.includes(c.name_en)).map((c) => c.id)
  );
  const withStandalone = STANDALONE_CONTEXTS.has(context);
  return leaves.filter((c) => (c.parent_id ? headingIds.has(c.parent_id) : withStandalone));
}
