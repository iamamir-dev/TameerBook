import { PROJECT_STAGES, type ProjectStage } from '@/db/schema';
import type { TranslationKey } from '@/i18n';
import type { ColorPalette } from '@/theme/theme';

type ColorKey = keyof ColorPalette;

/** Map each pipeline stage to its i18n label key. */
export const PROJECT_STAGE_LABEL: Record<ProjectStage, TranslationKey> = {
  TOKEN_PAID: 'pstageTokenPaid',
  BAYANA_PAID: 'pstageBayanaPaid',
  TRANSFER: 'pstageTransfer',
  POSSESSION: 'pstagePossession',
  CONSTRUCTION: 'pstageConstruction',
  FINISHING: 'pstageFinishing',
  LISTED_FOR_SALE: 'pstageListedForSale',
  CLOSED: 'pstageClosed',
};

/** Theme color key used to tint a stage badge (grouped by pipeline phase). */
export function projectStageTone(stage: ProjectStage): ColorKey {
  switch (stage) {
    case 'TOKEN_PAID':
    case 'BAYANA_PAID':
    case 'TRANSFER':
    case 'POSSESSION':
      return 'gold';
    case 'CONSTRUCTION':
    case 'FINISHING':
      return 'accent';
    case 'LISTED_FOR_SALE':
    case 'CLOSED':
    default:
      return 'success';
  }
}

/** Zero-based position of a stage in the pipeline. */
export function stageIndex(stage: ProjectStage): number {
  return Math.max(0, PROJECT_STAGES.indexOf(stage));
}

/**
 * The document legally/customarily required to COMPLETE each buying-phase stage
 * (Pakistani plot-deal paper trail): verify ownership → sign agreement →
 * society clearance → registered transfer. Used both to gate stage advancement
 * (see `checkNextStage`) and to drive the guided purchase stepper.
 */
export const STAGE_REQUIRED_DOC: Partial<Record<ProjectStage, TranslationKey>> = {
  TOKEN_PAID: 'docFard', // verify the seller owns the plot before paying
  BAYANA_PAID: 'docAgreement', // the signed sale agreement (بیع نامہ)
  TRANSFER: 'docNdc', // society No-Demand Certificate (clears dues)
  POSSESSION: 'docRegistry', // registered transfer / sale deed
};
