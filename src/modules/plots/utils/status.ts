import type { PlotSummary } from '@/db';
import type { TranslationKey } from '@/i18n';
import type { ColorKey } from '@/utils/tones';

/** Small epsilon for money comparisons (matches the repositories). */
const EPS = 0.001;

export interface PlotStatusMeta {
  tone: ColorKey;
  labelKey: TranslationKey;
}

/**
 * Auto-derived plot status — no user-managed statuses (like a Purchase Order).
 * Read STRICTLY in priority order so exactly one branch ever applies:
 *
 *   1. SOLD        — terminal (standalone fully received, or sold with a project).
 *   2. In project  — belongs to a project; its sale/settlement live there.
 *   3. For sale    — standalone, listed (sale price set) and not yet fully paid.
 *   4. Paid up     — standalone, the seller's deal is fully paid off.
 *   5. Part paid   — standalone, some (but not all) of the deal paid.
 *   6. Owned       — standalone, purchase recorded, nothing paid yet.
 *
 * Pure — unit-tested exhaustively, shared by the list card + detail hero.
 */
export function plotStatusMeta(s: PlotSummary): PlotStatusMeta {
  const { plot, dealPrice, remaining, paidToSeller, salePrice } = s;

  if (plot.status === 'SOLD') return { tone: 'gold', labelKey: 'plotSold' };
  if (plot.status === 'IN_PROJECT') return { tone: 'primary', labelKey: 'plotInProject' };
  if (salePrice > 0) return { tone: 'accent', labelKey: 'statusForSale' };
  if (dealPrice > EPS && remaining <= EPS) return { tone: 'success', labelKey: 'statusPaidUp' };
  if (paidToSeller > EPS) return { tone: 'gold', labelKey: 'statusPartPaid' };
  return { tone: 'accent', labelKey: 'plotOwned' };
}
