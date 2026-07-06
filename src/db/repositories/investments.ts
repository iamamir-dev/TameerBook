import { getDatabase } from '../database';
import { DEFAULT_USER, type PaymentMode } from '../schema';
import { nowISO, uuid } from '../uuid';
import { addDocument } from './documents';

const INVESTOR_CATEGORY_EN = 'Investor Investment';

/** Find (or create) the "Investor Investment" income category. */
async function investorCategoryId(): Promise<string> {
  const db = await getDatabase();
  const found = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM categories WHERE name_en = ? LIMIT 1',
    INVESTOR_CATEGORY_EN
  );
  if (found) return found.id;
  const id = uuid();
  await db.runAsync(
    `INSERT INTO categories (id, created_at, created_by, parent_id, name_en, name_ur, type, icon)
     VALUES (?, ?, ?, NULL, ?, ?, 'INCOME', 'investor')`,
    id,
    nowISO(),
    DEFAULT_USER,
    INVESTOR_CATEGORY_EN,
    'سرمایہ کاری'
  );
  return id;
}

export interface InvestmentInput {
  investorId: string;
  projectId: string;
  amount: number;
  date: string;
  mode: PaymentMode;
  receiptUri?: string | null;
  createdBy?: string;
}

/**
 * Record an investment: writes a capital_ledger entry (INITIAL for the
 * investor's first contribution to the project, otherwise ADDITIONAL) AND an
 * IN transaction (category "Investor Investment") atomically. Auto-creates the
 * project_investor link if it doesn't exist yet. Ownership % is computed live
 * from the ledger, so it recalculates automatically after this write.
 */
export async function addInvestment(input: InvestmentInput): Promise<void> {
  const db = await getDatabase();
  const by = input.createdBy ?? DEFAULT_USER;
  const catId = await investorCategoryId();
  const existingPi = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM project_investors WHERE project_id = ? AND investor_id = ? LIMIT 1',
    input.projectId,
    input.investorId
  );
  const createdAt = nowISO();
  const ledgerId = uuid();
  const txnId = uuid();

  await db.withExclusiveTransactionAsync(async (tx) => {
    let piId = existingPi?.id;
    if (!piId) {
      piId = uuid();
      await tx.runAsync(
        `INSERT INTO project_investors
           (id, created_at, created_by, project_id, investor_id, committed_amount, profit_pct, status, joined_at, exited_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 'ACTIVE', ?, NULL)`,
        piId,
        createdAt,
        by,
        input.projectId,
        input.investorId,
        input.amount,
        createdAt
      );
    }
    const existing = await tx.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) AS c FROM capital_ledger WHERE project_investor_id = ?',
      piId
    );
    const entryType = (existing?.c ?? 0) > 0 ? 'ADDITIONAL' : 'INITIAL';
    await tx.runAsync(
      `INSERT INTO capital_ledger
         (id, created_at, created_by, project_investor_id, entry_type, amount, counterparty_pi_id, valuation_amount, date, note, doc_id)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL)`,
      ledgerId,
      createdAt,
      by,
      piId,
      entryType,
      input.amount,
      input.date
    );
    await tx.runAsync(
      `INSERT INTO transactions
         (id, created_at, created_by, project_id, direction, category_id, amount, date, mode, party_id, description, doc_id, is_void, void_of_id)
       VALUES (?, ?, ?, ?, 'IN', ?, ?, ?, ?, NULL, NULL, NULL, 0, NULL)`,
      txnId,
      createdAt,
      by,
      input.projectId,
      catId,
      input.amount,
      input.date,
      input.mode
    );
  });

  if (input.receiptUri) {
    await addDocument({ entityType: 'transaction', entityId: txnId, fileUri: input.receiptUri, mime: 'image/jpeg' });
  }
}
