import { type CategoryContext, scopeCategoriesToContext } from '@/utils/categoryScope';

import { getDatabase } from '../database';
import { type CategoryRow, type CategoryType, DEFAULT_USER } from '../schema';
import { nowISO, uuid } from '../uuid';

// Re-export the pure scoping helpers so `@/db` stays the one import site.
export { scopeCategoriesToContext };
export type { CategoryContext };

export interface NewCategory {
  nameEn: string;
  nameUr: string;
  type: CategoryType;
  icon?: string | null;
  parentId?: string | null;
  defaultUnit?: string | null;
  createdBy?: string;
}

/** Thrown when deleting a category that still has entries or sub-categories. */
export class CategoryInUseError extends Error {
  constructor(public readonly count: number) {
    super('CATEGORY_IN_USE');
    this.name = 'CategoryInUseError';
  }
}
export function isCategoryInUse(e: unknown): e is CategoryInUseError {
  return e instanceof Error && e.message === 'CATEGORY_IN_USE';
}

export async function addCategory(input: NewCategory): Promise<CategoryRow> {
  const nameEn = input.nameEn.trim();
  const nameUr = input.nameUr.trim() || nameEn;
  if (!nameEn) throw new Error('addCategory: name is required');
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO categories (id, created_at, created_by, parent_id, name_en, name_ur, type, icon, is_system, default_unit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.parentId ?? null,
    nameEn,
    nameUr,
    input.type,
    input.icon ?? null,
    input.defaultUnit ?? null
  );
  return (await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', id))!;
}

export interface UpdateCategory {
  name?: string;
  icon?: string | null;
  parentId?: string | null;
  defaultUnit?: string | null;
}

/** Edit a user category (system categories are locked). */
export async function updateCategory(id: string, patch: UpdateCategory): Promise<void> {
  const db = await getDatabase();
  const c = await getCategory(id);
  if (!c) throw new Error(`updateCategory: category ${id} not found`);
  if (c.is_system) throw new Error('updateCategory: system category is locked');
  const name = patch.name?.trim() || c.name_en;
  await db.runAsync(
    'UPDATE categories SET name_en = ?, name_ur = ?, icon = ?, parent_id = ?, default_unit = ? WHERE id = ?',
    name,
    name,
    patch.icon !== undefined ? patch.icon : c.icon,
    patch.parentId !== undefined ? patch.parentId : c.parent_id,
    patch.defaultUnit !== undefined ? patch.defaultUnit : c.default_unit,
    id
  );
}

/** Delete a user category — blocked if it's a system one, has entries, or has
 *  sub-categories (reassign/clear those first). */
export async function deleteCategory(id: string): Promise<void> {
  const db = await getDatabase();
  const c = await getCategory(id);
  if (!c) return;
  if (c.is_system) throw new Error('deleteCategory: system category is locked');
  const kids = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM categories WHERE parent_id = ?',
    id
  );
  const txns = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM transactions WHERE category_id = ?',
    id
  );
  const used = (kids?.c ?? 0) + (txns?.c ?? 0);
  if (used > 0) throw new CategoryInUseError(used);
  await db.runAsync('DELETE FROM categories WHERE id = ?', id);
}

/** Sub-categories under a named main heading (e.g. the materials under "Materials"). */
export async function listSubcategories(parentNameEn: string): Promise<CategoryRow[]> {
  const parent = await getCategoryByNameEn(parentNameEn);
  if (!parent) return [];
  const db = await getDatabase();
  return db.getAllAsync<CategoryRow>(
    'SELECT * FROM categories WHERE parent_id = ? ORDER BY sort_order, name_en',
    parent.id
  );
}

export interface CategoryTreeNode extends CategoryRow {
  children: CategoryRow[];
}

/** Categories of a type as a main→sub tree (headings each with their subs). */
export async function listCategoryTree(type: CategoryType): Promise<CategoryTreeNode[]> {
  const all = await listCategories(type);
  const byParent = new Map<string, CategoryRow[]>();
  for (const c of all) {
    if (c.parent_id) {
      const list = byParent.get(c.parent_id) ?? [];
      list.push(c);
      byParent.set(c.parent_id, list);
    }
  }
  return all.filter((c) => !c.parent_id).map((m) => ({ ...m, children: byParent.get(m.id) ?? [] }));
}

/**
 * The single source for a module's bookable categories. Returns only LEAF
 * categories (never headings, never system/business-posted ones), in the
 * user's Settings order, scoped to the given context.
 */
export async function listCategoriesForContext(context: CategoryContext): Promise<CategoryRow[]> {
  const type: CategoryType = context === 'income' ? 'INCOME' : 'EXPENSE';
  const all = await listCategories(type);
  return scopeCategoriesToContext(all, context);
}

export async function listCategories(type?: CategoryType): Promise<CategoryRow[]> {
  const db = await getDatabase();
  if (type) {
    return db.getAllAsync<CategoryRow>(
      'SELECT * FROM categories WHERE type = ? ORDER BY sort_order, name_en',
      type
    );
  }
  return db.getAllAsync<CategoryRow>('SELECT * FROM categories ORDER BY type, sort_order, name_en');
}

/** Persist a new display order (drag-to-reorder): sort_order = position. */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.runAsync('UPDATE categories SET sort_order = ? WHERE id = ?', i, orderedIds[i]);
    }
  });
}

export async function getCategory(id: string): Promise<CategoryRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', id);
}

/** Look up a category by its canonical English name (e.g. "Cement"). */
export async function getCategoryByNameEn(nameEn: string): Promise<CategoryRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE name_en = ? LIMIT 1', nameEn);
}

/**
 * Find-or-create a category by its canonical English name. Used by business
 * logic that posts system transactions (Plot Payment, Transfer, Labor
 * Payment, …) so the category always exists.
 */
export async function categoryIdByName(
  nameEn: string,
  type: CategoryType,
  nameUr?: string,
  system = false
): Promise<string> {
  const existing = await getCategoryByNameEn(nameEn);
  if (existing) return existing.id;
  const created = await addCategory({ nameEn, nameUr: nameUr ?? nameEn, type });
  if (system) {
    // Business categories are locked from rename/delete so lookups by this
    // exact English name keep working forever.
    const db = await getDatabase();
    await db.runAsync('UPDATE categories SET is_system = 1 WHERE id = ?', created.id);
  }
  return created.id;
}
