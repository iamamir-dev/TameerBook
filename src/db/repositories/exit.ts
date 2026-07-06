import { getDatabase } from '../database';
import { DEFAULT_USER, type ProjectInvestorRow } from '../schema';
import { nowISO, uuid } from '../uuid';
import { getInvestorCapital } from './capital';

export type ExitScenario =
  | 'PARTNER_BUY'
  | 'NEW_INVESTOR'
  | 'OWNER_BUY'
  | 'PARTIAL'
  | 'COMMITTED_UNPAID';

/** Marker CNIC used to identify the auto-created "Owner" investor. */
const OWNER_MARKER = '__OWNER__';

async function ownerInvestorId(): Promise<string> {
  const db = await getDatabase();
  const found = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM investors WHERE cnic = ? LIMIT 1',
    OWNER_MARKER
  );
  if (found) return found.id;
  const id = uuid();
  await db.runAsync(
    `INSERT INTO investors (id, created_at, created_by, name, cnic, phone, photo_uri, bank_info, status)
     VALUES (?, ?, ?, 'Owner', ?, NULL, NULL, NULL, 'ACTIVE')`,
    id,
    nowISO(),
    DEFAULT_USER,
    OWNER_MARKER
  );
  return id;
}

export interface ExitInput {
  projectId: string;
  projectInvestorId: string;
  scenario: ExitScenario;
  valuationAmount: number;
  date: string;
  portionAmount?: number;
  /** Existing partner's project_investor id (PARTNER_BUY). */
  buyerProjectInvestorId?: string | null;
  /** Already-created investor id to bring in (NEW_INVESTOR). */
  newInvestorId?: string | null;
  createdBy?: string;
}

/**
 * Execute an investor exit. APPEND-ONLY: writes TRANSFER_OUT/WITHDRAWAL/
 * EXIT_SETTLEMENT for the leaver and TRANSFER_IN for the buyer (with the
 * agreed valuation), flips the leaver's status, and redistributes profit % so
 * the totals still sum to 100. Ownership % recomputes automatically from the
 * ledger. Never deletes anything.
 */
export async function exitInvestor(input: ExitInput): Promise<void> {
  const db = await getDatabase();
  const by = input.createdBy ?? DEFAULT_USER;
  const createdAt = nowISO();

  const leaver = await db.getFirstAsync<ProjectInvestorRow>(
    'SELECT * FROM project_investors WHERE id = ?',
    input.projectInvestorId
  );
  if (!leaver) throw new Error('exitInvestor: leaver not found');

  const leaverCapital = await getInvestorCapital(input.projectInvestorId);
  const amount = input.scenario === 'PARTIAL' ? input.portionAmount ?? 0 : leaverCapital;
  if (amount <= 0 && input.scenario !== 'COMMITTED_UNPAID') {
    throw new Error('exitInvestor: amount must be positive');
  }
  if (amount > leaverCapital + 0.001) throw new Error('exitInvestor: amount exceeds capital');

  // Resolve / create the buyer participation (if any).
  let buyerPiId: string | null = null;
  let buyerInvestorId: string | null = null;
  if (input.scenario === 'PARTNER_BUY') buyerPiId = input.buyerProjectInvestorId ?? null;
  else if (input.scenario === 'NEW_INVESTOR') buyerInvestorId = input.newInvestorId ?? null;
  else if (input.scenario === 'OWNER_BUY') buyerInvestorId = await ownerInvestorId();

  const leaverPct = leaver.profit_pct ?? 0;

  await db.withExclusiveTransactionAsync(async (tx) => {
    // Create a buyer PI for NEW_INVESTOR / OWNER_BUY.
    if (buyerInvestorId) {
      buyerPiId = uuid();
      await tx.runAsync(
        `INSERT INTO project_investors
           (id, created_at, created_by, project_id, investor_id, committed_amount, profit_pct, status, joined_at, exited_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, NULL)`,
        buyerPiId,
        createdAt,
        by,
        input.projectId,
        buyerInvestorId,
        amount,
        leaverPct,
        input.date
      );
    }

    const leaverEntry =
      input.scenario === 'PARTIAL'
        ? 'WITHDRAWAL'
        : input.scenario === 'COMMITTED_UNPAID'
          ? 'EXIT_SETTLEMENT'
          : 'TRANSFER_OUT';

    if (amount > 0) {
      await tx.runAsync(
        `INSERT INTO capital_ledger
           (id, created_at, created_by, project_investor_id, entry_type, amount, counterparty_pi_id, valuation_amount, date, note, doc_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
        uuid(),
        createdAt,
        by,
        input.projectInvestorId,
        leaverEntry,
        amount,
        buyerPiId,
        input.valuationAmount,
        input.date
      );
    }

    if (buyerPiId && (input.scenario === 'PARTNER_BUY' || input.scenario === 'NEW_INVESTOR' || input.scenario === 'OWNER_BUY')) {
      await tx.runAsync(
        `INSERT INTO capital_ledger
           (id, created_at, created_by, project_investor_id, entry_type, amount, counterparty_pi_id, valuation_amount, date, note, doc_id)
         VALUES (?, ?, ?, ?, 'TRANSFER_IN', ?, ?, ?, ?, NULL, NULL)`,
        uuid(),
        createdAt,
        by,
        buyerPiId,
        amount,
        input.projectInvestorId,
        input.valuationAmount,
        input.date
      );
    }

    // Status + profit redistribution.
    if (input.scenario === 'PARTIAL') {
      // capital reduced; participation stays ACTIVE, profit % unchanged
      return;
    }

    await tx.runAsync(
      "UPDATE project_investors SET status = 'EXITED', exited_at = ?, profit_pct = 0 WHERE id = ?",
      input.date,
      input.projectInvestorId
    );

    if (input.scenario === 'PARTNER_BUY' && buyerPiId) {
      await tx.runAsync(
        'UPDATE project_investors SET profit_pct = COALESCE(profit_pct, 0) + ? WHERE id = ?',
        leaverPct,
        buyerPiId
      );
    } else if (input.scenario === 'COMMITTED_UNPAID' && leaverPct > 0) {
      // Redistribute the leaver's profit % across remaining active partners.
      const remaining = await tx.getAllAsync<{ id: string; profit_pct: number | null }>(
        "SELECT id, profit_pct FROM project_investors WHERE project_id = ? AND status = 'ACTIVE' AND id != ?",
        input.projectId,
        input.projectInvestorId
      );
      const sum = remaining.reduce((s, r) => s + (r.profit_pct ?? 0), 0);
      for (const r of remaining) {
        const share = sum > 0 ? leaverPct * ((r.profit_pct ?? 0) / sum) : leaverPct / remaining.length;
        await tx.runAsync(
          'UPDATE project_investors SET profit_pct = COALESCE(profit_pct, 0) + ? WHERE id = ?',
          share,
          r.id
        );
      }
    }
    // NEW_INVESTOR / OWNER_BUY already received leaverPct at PI creation.
  });
}
