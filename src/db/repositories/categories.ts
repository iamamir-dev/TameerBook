import { getDatabase } from '../database';
import { type CategoryRow, type CategoryType, DEFAULT_USER } from '../schema';
import { nowISO, uuid } from '../uuid';

export interface NewCategory {
  nameEn: string;
  nameUr: string;
  type: CategoryType;
  icon?: string | null;
  parentId?: string | null;
  createdBy?: string;
}

export async function addCategory(input: NewCategory): Promise<CategoryRow> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO categories (id, created_at, created_by, parent_id, name_en, name_ur, type, icon)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.parentId ?? null,
    input.nameEn,
    input.nameUr,
    input.type,
    input.icon ?? null
  );
  return (await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', id))!;
}

export async function listCategories(type?: CategoryType): Promise<CategoryRow[]> {
  const db = await getDatabase();
  if (type) {
    return db.getAllAsync<CategoryRow>(
      'SELECT * FROM categories WHERE type = ? ORDER BY name_en',
      type
    );
  }
  return db.getAllAsync<CategoryRow>('SELECT * FROM categories ORDER BY type, name_en');
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
  nameUr?: string
): Promise<string> {
  const existing = await getCategoryByNameEn(nameEn);
  if (existing) return existing.id;
  const created = await addCategory({ nameEn, nameUr: nameUr ?? nameEn, type });
  return created.id;
}
