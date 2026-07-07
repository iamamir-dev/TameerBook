import { getDatabase } from '../database';
import type { TransactionRow } from '../schema';
import { getProjectLaborTotals } from './labor';

export interface CategorySpend {
  categoryId: string;
  nameEn: string;
  nameUr: string;
  total: number;
}

export interface ConstructionSummary {
  /** Cash construction spend + accrued labor wages (the true build cost). */
  total: number;
  thisMonth: number;
  /** Top spend categories (cement, bajri, …) high→low. Labor shown separately. */
  byCategory: CategorySpend[];
  /** Accrued labor wages (this IS the labor cost  payments settle it). */
  laborAccrued: number;
  laborPaid: number;
  laborOutstanding: number;
}

/**
 * Construction cost for a project. Cash spend counts CONSTRUCTION-phase OUT
 * transactions EXCLUDING labor payments (those settle the accrued wage
 * balance, which already carries the cost)  so nothing is double counted:
 *   total = Σ(non-labor CONSTRUCTION OUT) + Σ(accrued labor wages)
 */
export async function getConstructionSummary(
  projectId: string,
  monthPrefix: string
): Promise<ConstructionSummary> {
  const db = await getDatabase();

  const byCategory = await db.getAllAsync<CategorySpend>(
    `SELECT t.category_id AS categoryId, c.name_en AS nameEn, c.name_ur AS nameUr,
            COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.project_id = ? AND t.phase = 'CONSTRUCTION' AND t.direction = 'OUT'
       AND t.is_void = 0 AND t.labor_id IS NULL
     GROUP BY t.category_id
     ORDER BY total DESC`,
    projectId
  );

  const month = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS s
     FROM transactions
     WHERE project_id = ? AND phase = 'CONSTRUCTION' AND direction = 'OUT'
       AND is_void = 0 AND labor_id IS NULL AND date LIKE ?`,
    projectId,
    `${monthPrefix}%`
  );

  const labor = await getProjectLaborTotals(projectId);
  const cashSpend = byCategory.reduce((s, c) => s + c.total, 0);

  return {
    total: cashSpend + labor.accrued,
    thisMonth: month?.s ?? 0,
    byCategory,
    laborAccrued: labor.accrued,
    laborPaid: labor.paid,
    laborOutstanding: labor.outstanding,
  };
}

/** All live transactions for a party (supplier ledger: purchases + payments). */
export async function listPartyTransactions(partyId: string): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE party_id = ? AND is_void = 0 ORDER BY date DESC, created_at DESC',
    partyId
  );
}
