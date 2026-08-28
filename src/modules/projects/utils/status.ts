import type { ProjectSummary } from '@/db';
import type { TranslationKey } from '@/i18n';
import type { ColorKey } from '@/utils/tones';

const EPS = 0.001;

export interface ProjectStatusMeta {
  tone: ColorKey;
  labelKey: TranslationKey;
}

/**
 * Auto-derived project status — no user-managed stages (like a plot or a
 * Purchase Order). Read STRICTLY in priority order so exactly one applies:
 *
 *   Cancelled → Settled/Completed → On hold → (ACTIVE:) Sold → For sale →
 *   Construction → Planning.
 *
 * Pure — unit-tested; shared by the project card + detail hero.
 */
export function projectStatusMeta(s: ProjectSummary): ProjectStatusMeta {
  const { project, cost, saleDeal, saleReceived } = s;

  if (project.status === 'CANCELLED') return { tone: 'danger', labelKey: 'statusCancelled' };
  if (project.status === 'COMPLETED') {
    return { tone: 'success', labelKey: project.settled_at ? 'statusSettled' : 'statusDone' };
  }
  if (project.status === 'ON_HOLD') return { tone: 'gold', labelKey: 'statusOnHold' };

  // ACTIVE lifecycle, most-advanced first.
  if (saleDeal > 0 && saleReceived + EPS >= saleDeal) return { tone: 'gold', labelKey: 'plotSold' };
  if (saleDeal > 0) return { tone: 'accent', labelKey: 'statusForSale' };
  if (cost.constructionCost > EPS) return { tone: 'primary', labelKey: 'statusConstruction' };
  return { tone: 'accent', labelKey: 'statusPlanning' };
}
