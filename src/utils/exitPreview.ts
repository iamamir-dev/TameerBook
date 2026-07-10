/**
 * Pure before/after ownership math for the investor exit wizard. No React,
 * react-native, or DB imports — this module is unit-testable in plain node.
 *
 * Ownership is always `capital / total paid-in capital` of the project. The
 * "before" column is that split as it stands today; the "after" column is the
 * same split once the leaver's exit is applied, per scenario:
 *
 * - PARTNER_BUY: an existing ACTIVE partner buys the leaver out — the
 *   leaver's capital moves onto the buyer's row and the buyer also inherits
 *   the leaver's profit %; the leaver drops to zero.
 * - NEW_INVESTOR: a brand-new investor buys the leaver out — a new row is
 *   appended with the leaver's capital and profit %; the leaver drops to zero.
 * - OWNER_BUY: same as NEW_INVESTOR, but the appended row is the owner.
 * - PARTIAL: only `portion` of the leaver's capital exits (no buyer row);
 *   the leaver keeps the remainder and keeps their profit %.
 * - COMMITTED_UNPAID: the leaver's committed-but-unpaid stake is cancelled —
 *   their capital simply leaves the pool and their profit % drops to zero.
 */

export type ExitScenarioId =
  | 'PARTNER_BUY'
  | 'NEW_INVESTOR'
  | 'OWNER_BUY'
  | 'PARTIAL'
  | 'COMMITTED_UNPAID';

/** One paid-in capital share (structural subset of the DB's OwnershipShare). */
export interface ExitShareInput {
  projectInvestorId: string;
  name: string;
  capital: number;
}

/** One participation row (structural subset of the DB's ProjectInvestorRow). */
export interface ExitParticipantInput {
  id: string;
  profit_pct: number | null;
}

export interface ExitPreviewInput {
  /** Current capital shares of the project. */
  shares: ExitShareInput[];
  /** Project participations, used to look up profit % per share. */
  pis: ExitParticipantInput[];
  /** project_investor id of the leaver (null until one is chosen). */
  leaverPiId: string | null;
  /** Chosen exit scenario (null until one is chosen). */
  scenario: ExitScenarioId | null;
  /** Capital amount leaving in a PARTIAL exit. */
  portion: number;
  /** Buying partner's project_investor id (PARTNER_BUY only). */
  buyerPiId: string | null;
  /** Typed name of the incoming buyer (NEW_INVESTOR only). */
  newInvestorName: string;
  /** Localized label for the owner row (OWNER_BUY). */
  ownerLabel: string;
  /** Localized fallback label when the new investor has no name yet. */
  buyerFallbackLabel: string;
}

export interface ExitPreviewRow {
  name: string;
  capital: number;
  pct: number;
  /** Ownership % of total capital. */
  ownership: number;
}

export interface ExitPreviewResult {
  before: ExitPreviewRow[];
  after: ExitPreviewRow[];
}

interface ShareView {
  name: string;
  capital: number;
  pct: number;
}

/** Compute the before/after ownership table shown on the review step. */
export function computeExitPreview(input: ExitPreviewInput): ExitPreviewResult {
  const { shares, pis, leaverPiId, scenario, portion, buyerPiId, newInvestorName, ownerLabel, buyerFallbackLabel } = input;
  const leaverShare = shares.find((s) => s.projectInvestorId === leaverPiId) ?? null;

  const bvList: ShareView[] = shares.map((s) => ({
    name: s.name,
    capital: s.capital,
    pct: pis.find((p) => p.id === s.projectInvestorId)?.profit_pct ?? 0,
  }));
  const bTotal0 = bvList.reduce((s, x) => s + x.capital, 0);
  const beforeWithPct0 = bvList.map((x) => ({ ...x, ownership: bTotal0 > 0 ? (x.capital / bTotal0) * 100 : 0 }));
  if (!leaverShare || !scenario) return { before: beforeWithPct0, after: beforeWithPct0 };

  const amount = scenario === 'PARTIAL' ? portion : leaverShare.capital;
  const av: ShareView[] = shares.map((s) => ({
    name: s.name,
    capital: s.capital,
    pct: pis.find((p) => p.id === s.projectInvestorId)?.profit_pct ?? 0,
  }));
  const leaver = av.find((_, i) => shares[i].projectInvestorId === leaverPiId);
  const leaverPct = leaver?.pct ?? 0;
  if (leaver) leaver.capital = Math.max(0, leaver.capital - amount);

  if (scenario === 'PARTNER_BUY' && buyerPiId) {
    const idx = shares.findIndex((s) => s.projectInvestorId === buyerPiId);
    if (idx >= 0) {
      av[idx].capital += amount;
      av[idx].pct += leaverPct;
    }
    if (leaver) leaver.pct = 0;
  } else if (scenario === 'NEW_INVESTOR' || scenario === 'OWNER_BUY') {
    av.push({ name: scenario === 'OWNER_BUY' ? ownerLabel : newInvestorName || buyerFallbackLabel, capital: amount, pct: leaverPct });
    if (leaver) leaver.pct = 0;
  } else if (scenario === 'COMMITTED_UNPAID') {
    if (leaver) leaver.pct = 0;
  }
  const total = av.reduce((s, x) => s + x.capital, 0);
  const withPct = av.map((x) => ({ ...x, ownership: total > 0 ? (x.capital / total) * 100 : 0 }));
  const bTotal = bvList.reduce((s, x) => s + x.capital, 0);
  const beforeWithPct = bvList.map((x) => ({ ...x, ownership: bTotal > 0 ? (x.capital / bTotal) * 100 : 0 }));
  return { before: beforeWithPct, after: withPct };
}
