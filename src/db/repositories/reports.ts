import { getDatabase } from '../database';
import type { TransactionRow } from '../schema';

/** Categories considered "construction" for the Tameer cost summary. */
export const CONSTRUCTION_CATEGORIES = [
  'Cement',
  'Sariya',
  'Bricks',
  'Sand/Crush',
  'Tiles',
  'Wood',
  'Paint',
  'Electric',
  'Sanitary',
  'Labor Dehari',
  'Contractor',
] as const;

export interface CategorySpend {
  categoryId: string;
  nameEn: string;
  nameUr: string;
  total: number;
}

export interface ConstructionSummary {
  total: number;
  thisMonth: number;
  byCategory: CategorySpend[];
}

/**
 * Construction spend for a project: all-time total, this-month total, and a
 * per-category breakdown (sorted high→low) for the mini bar list.
 */
export async function getConstructionSummary(
  projectId: string,
  monthPrefix: string
): Promise<ConstructionSummary> {
  const db = await getDatabase();
  const placeholders = CONSTRUCTION_CATEGORIES.map(() => '?').join(', ');

  const byCategory = await db.getAllAsync<CategorySpend>(
    `SELECT t.category_id AS categoryId, c.name_en AS nameEn, c.name_ur AS nameUr,
            COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.project_id = ? AND t.direction = 'OUT' AND t.is_void = 0
       AND c.name_en IN (${placeholders})
     GROUP BY t.category_id
     ORDER BY total DESC`,
    projectId,
    ...CONSTRUCTION_CATEGORIES
  );

  const month = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(t.amount), 0) AS s
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.project_id = ? AND t.direction = 'OUT' AND t.is_void = 0
       AND c.name_en IN (${placeholders}) AND t.date LIKE ?`,
    projectId,
    ...CONSTRUCTION_CATEGORIES,
    `${monthPrefix}%`
  );

  const total = byCategory.reduce((s, c) => s + c.total, 0);
  return { total, thisMonth: month?.s ?? 0, byCategory };
}

/** All live transactions for a party (supplier ledger: purchases + payments). */
export async function listPartyTransactions(partyId: string): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE party_id = ? AND is_void = 0 ORDER BY date DESC, created_at DESC',
    partyId
  );
}
