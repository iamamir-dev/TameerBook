/**
 * Pure investor-standing arithmetic (no DB), so it's unit-tested headlessly.
 * The repo (`getInvestorSummary`) feeds it the four ledger sums.
 *
 * Two ledgers back an investor: real cash (`transactions.investor_id`) and
 * per-participation capital/profit accounting (`capital_ledger`). Neither alone
 * tells the whole story — this folds them into the numbers the user wants:
 * their money in, their earned profit, and what's re-deployable.
 */
export interface InvestorLedgerSums {
  /** Σ IN cash received FROM the investor (gross money they put in). */
  receivedCash: number;
  /** Σ OUT cash paid TO the investor (payouts / withdrawals / buyouts in cash). */
  paidOutCash: number;
  /** Σ realized profit: PROFIT_PAYOUT − DONATION − LOSS_ADJ across participations. */
  realizedProfit: number;
  /** Net capital currently staked in projects (CAPITAL_SUM; freed by settlement/exit). */
  netStaked: number;
}

export interface InvestorStanding {
  /** "Total investment" — gross cash the investor has put in. */
  invested: number;
  /** "Profit earned" — realized profit across settled projects. */
  profit: number;
  /** Cash already paid back to the investor. */
  paidOut: number;
  /** "Total" standing = invested + profit − paidOut. */
  total: number;
  /** Money currently working inside projects. */
  staked: number;
  /** Re-deployable balance (returned capital + earned profit sitting idle). */
  available: number;
}

/**
 * Fold the two ledgers into an investor's standing. `available` is what the
 * "invest from existing balance" flow may draw on: the investor's total
 * standing minus whatever is still staked in projects (never below 0).
 */
export function computeInvestorStanding(s: InvestorLedgerSums): InvestorStanding {
  const total = s.receivedCash + s.realizedProfit - s.paidOutCash;
  return {
    invested: s.receivedCash,
    profit: s.realizedProfit,
    paidOut: s.paidOutCash,
    total,
    staked: s.netStaked,
    available: Math.max(0, total - s.netStaked),
  };
}
