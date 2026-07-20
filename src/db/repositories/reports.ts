import { getDatabase } from '../database';
import type { TransactionRow } from '../schema';
import { getProjectLaborTotals } from './labor';

export interface CategorySpend {
  categoryId: string;
  nameEn: string;
  nameUr: string;
  total: number;
  /** Σ structured quantities (0 when none recorded). */
  qty: number;
  /** The category's default unit (Settings → Categories). */
  unit: string | null;
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

  // LEFT JOIN so legacy uncategorized rows land in an "Other" bucket instead
  // of silently disappearing — the bars must always sum to the hero total.
  // NET direction: a cross-project material transfer credits the source project
  // with a CONSTRUCTION IN (same "Material Booking" category), so its category
  // total and the hero both net down and the bars still sum to the hero.
  const byCategory = await db.getAllAsync<CategorySpend>(
    `SELECT COALESCE(t.category_id, '__other__') AS categoryId,
            COALESCE(c.name_en, 'Other') AS nameEn,
            COALESCE(c.name_ur, 'Deegar') AS nameUr,
            COALESCE(SUM(CASE t.direction WHEN 'OUT' THEN t.amount ELSE -t.amount END), 0) AS total,
            COALESCE(SUM(t.qty), 0) AS qty,
            c.default_unit AS unit
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.project_id = ? AND t.phase = 'CONSTRUCTION'
       AND t.is_void = 0 AND t.labor_id IS NULL
     GROUP BY COALESCE(t.category_id, '__other__')
     HAVING total > 0
     ORDER BY total DESC`,
    projectId
  );

  const month = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(CASE direction WHEN 'OUT' THEN amount ELSE -amount END), 0) AS s
     FROM transactions
     WHERE project_id = ? AND phase = 'CONSTRUCTION'
       AND is_void = 0 AND labor_id IS NULL AND date LIKE ?`,
    projectId,
    `${monthPrefix}%`
  );

  const labor = await getProjectLaborTotals(projectId);
  // Hero comes from the full netted construction spend (not the HAVING-filtered
  // bars) so it always equals getProjectCost's construction figure.
  const cash = await db.getFirstAsync<{ s: number }>(
    `SELECT COALESCE(SUM(CASE direction WHEN 'OUT' THEN amount ELSE -amount END), 0) AS s
     FROM transactions
     WHERE project_id = ? AND phase = 'CONSTRUCTION' AND is_void = 0 AND labor_id IS NULL`,
    projectId
  );
  const cashSpend = cash?.s ?? 0;

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
