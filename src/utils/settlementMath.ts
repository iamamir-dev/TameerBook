/**
 * Settlement distribution math — PURE module (no React, no DB), mirroring the
 * exitPreview.ts pattern so it unit-tests in plain node.
 *
 * Shariah grounding:
 *  - Profit may split by ANY mutually-agreed rule (division happens at
 *    settlement time on REALIZED profit — nothing was guaranteed upfront).
 *  - Loss ALWAYS splits by capital ratio: when net < 0 the rule is ignored.
 *  - Sadaqah (donation) is a % of profit taken off the top; rules distribute
 *    what remains. Persisted PROFIT_PAYOUT stays GROSS (share + its sadaqah
 *    slice) so existing ledger rollups (profit − donation) are unchanged.
 */

export const OWNER_PARTICIPANT_ID = '__OWNER__';

export type DistributionRuleKind = 'ownership' | 'agreedPct' | 'ownerFirst' | 'prefReturn' | 'manual';

export type DistributionRule =
  | { kind: 'ownership' }
  | { kind: 'agreedPct'; pctById: Record<string, number> }
  | { kind: 'ownerFirst'; ownerPct: number }
  | { kind: 'prefReturn'; mode: 'flat' | 'perMonth'; pct: number; months: number }
  | { kind: 'manual'; amountById: Record<string, number> };

export interface ParticipantInput {
  id: string;
  name: string;
  /** Real money put in (owner = residual financier). */
  capital: number;
  isOwner: boolean;
}

export interface DistributionInput {
  participants: ParticipantInput[];
  /** Signed net P&L of the project. */
  net: number;
  /** Charity % of each person's profit share, 0–100 (ignored on loss). */
  donationPct: number;
  /** Per-person charity opt-out (true = keeps their charity portion). */
  donationOptOutById?: Record<string, boolean>;
  rule: DistributionRule;
}

export type DistributionErrorCode =
  | 'PCT_SUM_NOT_100'
  | 'AMOUNT_SUM_MISMATCH'
  | 'NEGATIVE_INPUT'
  | 'PCT_OUT_OF_RANGE'
  | 'NO_PARTICIPANTS';

export interface DistributionRow {
  id: string;
  name: string;
  isOwner: boolean;
  capital: number;
  /** capital ÷ total capital × 100 (0 when total capital is 0). */
  ownershipPct: number;
  /** GROSS signed profit/loss share (its sadaqah slice included on profit). */
  profitOrLoss: number;
  /** This row's slice of the sadaqah pool (0 on loss). */
  donation: number;
  /** capital + profitOrLoss − donation (owner row is informational). */
  payout: number;
}

export interface DistributionResult {
  isProfit: boolean;
  net: number;
  totalCapital: number;
  donationPct: number;
  totalDonation: number;
  /** net − totalDonation: what the rule actually divides (profit only). */
  distributable: number;
  rows: DistributionRow[];
  /** Non-empty ⇒ inputs invalid; rows are a best-effort preview. */
  errors: { code: DistributionErrorCode; detail?: string }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Split `target` across `weights` proportionally, rounding to 2 dp with a
 * largest-remainder correction so the parts ALWAYS sum exactly to `target`.
 * Zero total weight → everything to `fallbackIndex` (or index 0).
 */
export function allocateProportional(target: number, weights: number[], fallbackIndex = 0): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const totalW = weights.reduce((s, w) => s + Math.max(0, w), 0);
  const out = new Array<number>(n).fill(0);
  if (totalW <= 0) {
    out[Math.min(fallbackIndex, n - 1)] = round2(target);
    return out;
  }
  let acc = 0;
  let maxI = 0;
  for (let i = 0; i < n; i++) {
    out[i] = round2((target * Math.max(0, weights[i])) / totalW);
    acc = round2(acc + out[i]);
    if (weights[i] > weights[maxI]) maxI = i;
  }
  // Pin the rounding residual on the largest weight so Σ === target exactly.
  const residual = round2(target - acc);
  if (residual !== 0) out[maxI] = round2(out[maxI] + residual);
  return out;
}

/** Equal percentages that sum to exactly 100 (largest-remainder). */
export function equalPctFill(ids: string[]): Record<string, number> {
  const parts = allocateProportional(100, ids.map(() => 1));
  return Object.fromEntries(ids.map((id, i) => [id, parts[i]]));
}

/** Percentages proportional to capital, summing to exactly 100. */
export function ownershipPctFill(participants: ParticipantInput[]): Record<string, number> {
  const parts = allocateProportional(
    100,
    participants.map((p) => p.capital),
    participants.findIndex((p) => p.isOwner)
  );
  return Object.fromEntries(participants.map((p, i) => [p.id, parts[i]]));
}

export function computeDistribution(input: DistributionInput): DistributionResult {
  const { participants, net, rule } = input;
  const donationPct = Math.min(100, Math.max(0, input.donationPct));
  const errors: DistributionResult['errors'] = [];
  const isProfit = net >= 0;
  const totalCapital = participants.reduce((s, p) => s + Math.max(0, p.capital), 0);
  const ownerIdx = participants.findIndex((p) => p.isOwner);

  if (participants.length === 0) {
    return {
      isProfit,
      net,
      totalCapital: 0,
      donationPct,
      totalDonation: 0,
      distributable: 0,
      rows: [],
      errors: [{ code: 'NO_PARTICIPANTS' }],
    };
  }

  const ownershipPcts = allocateProportional(
    100,
    participants.map((p) => p.capital),
    ownerIdx
  );

  // Rules divide the FULL net (e.g. 20% builder + 80% by ownership); charity
  // is then charged per person on their own share — so an opt-out investor
  // simply keeps their charity portion.
  const distributableForRules = net;

  // NET share per participant (before adding back the sadaqah slice).
  let netShares: number[];

  if (!isProfit) {
    // Loss: Shariah-mandated capital-ratio split. Rule ignored.
    netShares = allocateProportional(net, participants.map((p) => p.capital), ownerIdx);
  } else {
    switch (rule.kind) {
      case 'ownership': {
        netShares = allocateProportional(distributableForRules, participants.map((p) => p.capital), ownerIdx);
        break;
      }
      case 'agreedPct': {
        const pcts = participants.map((p) => rule.pctById[p.id] ?? 0);
        for (const v of pcts) {
          if (v < 0 || v > 100) errors.push({ code: 'PCT_OUT_OF_RANGE', detail: String(v) });
        }
        const sum = round2(pcts.reduce((s, v) => s + v, 0));
        if (Math.abs(sum - 100) > 0.01) errors.push({ code: 'PCT_SUM_NOT_100', detail: String(sum) });
        netShares = allocateProportional(distributableForRules, pcts, ownerIdx);
        break;
      }
      case 'ownerFirst': {
        const ownerPct = rule.ownerPct;
        if (ownerPct < 0 || ownerPct > 100) errors.push({ code: 'PCT_OUT_OF_RANGE', detail: String(ownerPct) });
        const ownerCut = round2(distributableForRules * (Math.min(100, Math.max(0, ownerPct)) / 100));
        const remainder = round2(distributableForRules - ownerCut);
        netShares = allocateProportional(remainder, participants.map((p) => p.capital), ownerIdx);
        if (ownerIdx >= 0) netShares[ownerIdx] = round2(netShares[ownerIdx] + ownerCut);
        break;
      }
      case 'prefReturn': {
        if (rule.pct < 0) errors.push({ code: 'NEGATIVE_INPUT', detail: 'pct' });
        const factor = (Math.max(0, rule.pct) / 100) * (rule.mode === 'perMonth' ? Math.max(0, rule.months) : 1);
        const owed = participants.map((p) => (p.isOwner ? 0 : round2(p.capital * factor)));
        const owedSum = round2(owed.reduce((s, v) => s + v, 0));
        if (owedSum <= 0) {
          // Nothing promised → everything to the owner.
          netShares = participants.map((_, i) => (i === ownerIdx ? distributableForRules : 0));
        } else if (distributableForRules >= owedSum) {
          netShares = owed.slice();
          if (ownerIdx >= 0) netShares[ownerIdx] = round2(distributableForRules - owedSum);
        } else {
          // Profit smaller than the promised munafa: divide what exists in
          // proportion to what was owed (nothing is guaranteed — halal).
          netShares = allocateProportional(distributableForRules, owed, 0);
        }
        break;
      }
      case 'manual': {
        const amounts = participants.map((p) => rule.amountById[p.id] ?? 0);
        for (const v of amounts) {
          if (v < 0) errors.push({ code: 'NEGATIVE_INPUT', detail: String(v) });
        }
        const sum = round2(amounts.reduce((s, v) => s + v, 0));
        if (Math.abs(sum - distributableForRules) > 0.01) {
          errors.push({ code: 'AMOUNT_SUM_MISMATCH', detail: `${sum} vs ${distributableForRules}` });
        }
        netShares = amounts.map(round2);
        break;
      }
    }
  }

  // Charity per person on their own POSITIVE share — skipped when opted out.
  const optOut = input.donationOptOutById ?? {};
  const donationSlices = participants.map((p, i) =>
    isProfit && !optOut[p.id] && netShares[i] > 0 ? round2(netShares[i] * (donationPct / 100)) : 0
  );
  const totalDonation = round2(donationSlices.reduce((s, v) => s + v, 0));
  const distributable = round2(net - totalDonation);

  const rows: DistributionRow[] = participants.map((p, i) => {
    const gross = round2(netShares[i]);
    return {
      id: p.id,
      name: p.name,
      isOwner: p.isOwner,
      capital: round2(p.capital),
      ownershipPct: ownershipPcts[i],
      profitOrLoss: gross,
      donation: donationSlices[i],
      payout: round2(p.capital + gross - donationSlices[i]),
    };
  });

  return { isProfit, net, totalCapital: round2(totalCapital), donationPct, totalDonation, distributable, rows, errors };
}
