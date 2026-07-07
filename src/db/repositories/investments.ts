import { getDatabase } from '../database';
import { DEFAULT_USER } from '../schema';
import { nowISO, uuid } from '../uuid';
import { categoryIdByName } from './categories';
import { addDocument } from './documents';

export interface InvestmentInput {
  investorId: string;
  projectId: string;
  amount: number;
  date: string;
  /** The account the investor's money landed in (real cash entering). */
  accountId: string;
  receiptUri?: string | null;
  createdBy?: string;
}

/**
 * Record REAL money an investor hands over (their commitment is a separate
 * promise on project_investors): writes a capital_ledger entry (INITIAL for
 * the investor's first contribution to the project, otherwise ADDITIONAL) AND
 * an IN transaction (category "Investor Investment") posted to the chosen
 * account, atomically. Auto-creates the project_investor link if it doesn't
 * exist yet. Ownership % is computed live from the ledger, so it recalculates
 * automatically after this write.
 *
 * If the total paid-in now exceeds the committed amount, the commitment is
 * automatically raised to match (they clearly agreed to invest more).
 */
export async function addInvestment(input: InvestmentInput): Promise<void> {
  const db = await getDatabase();
  if (input.amount <= 0) throw new Error('addInvestment: amount must be positive');
  const by = input.createdBy ?? DEFAULT_USER;
  const catId = await categoryIdByName('Investor Investment', 'INCOME', 'سرمایہ کاری');
  const existingPi = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM project_investors WHERE project_id = ? AND investor_id = ? LIMIT 1',
    input.projectId,
    input.investorId
  );
  const investor = await db.getFirstAsync<{ name: string }>(
    'SELECT name FROM investors WHERE id = ?',
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
         (id, created_at, created_by, direction, amount, date, account_id, project_id, plot_id,
          phase, category_id, party_id, counterparty_name, pay_type, transfer_id, udhaar_id,
          labor_id, description, doc_id, is_void, void_of_id)
       VALUES (?, ?, ?, 'IN', ?, ?, ?, ?, NULL, 'GENERAL', ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL)`,
      txnId,
      createdAt,
      by,
      input.amount,
      input.date,
      input.accountId,
      input.projectId,
      catId,
      investor?.name ?? null
    );

    // Auto-raise the commitment when the paid-in total overtakes it.
    await tx.runAsync(
      `UPDATE project_investors SET committed_amount = MAX(committed_amount,
         (SELECT COALESCE(SUM(CASE cl.entry_type
            WHEN 'INITIAL' THEN cl.amount
            WHEN 'ADDITIONAL' THEN cl.amount
            WHEN 'TRANSFER_IN' THEN cl.amount
            ELSE 0 END), 0)
          FROM capital_ledger cl WHERE cl.project_investor_id = project_investors.id))
       WHERE id = ?`,
      piId
    );
  });

  if (input.receiptUri) {
    await addDocument({
      entityType: 'transaction',
      entityId: txnId,
      fileUri: input.receiptUri,
      mime: 'image/jpeg',
    });
  }
}
