import {
  getProject,
  getProjectProgress,
  listDocuments,
  listProperties,
  listPropertyPayments,
  nextStage,
} from '@/db';
import type { TranslationKey } from '@/i18n';
import { STAGE_REQUIRED_DOC } from '@/utils/projectStage';

export interface StageCheck {
  ok: boolean;
  /** i18n key explaining why advancing is blocked (null when ok). */
  reasonKey: TranslationKey | null;
}

/**
 * Validate whether a project may advance to its next pipeline stage. Each
 * target stage has a real prerequisite (token paid, bayana paid, transfer
 * date set, construction started). CLOSED is never a manual move — it only
 * happens through settlement.
 */
export async function checkNextStage(projectId: string): Promise<StageCheck> {
  const project = await getProject(projectId);
  if (!project) return { ok: false, reasonKey: null };
  const cur = project.stage;
  const next = nextStage(cur);
  if (!next) return { ok: false, reasonKey: 'needSettle' }; // CLOSED — terminal

  const props = await listProperties(projectId);
  const prop = props[0] ?? null;
  const payments = prop ? await listPropertyPayments(prop.id) : [];
  const hasToken = payments.some((p) => p.type === 'TOKEN');
  const hasBayana = payments.some((p) => p.type === 'BAYANA');

  // What must be done to COMPLETE the CURRENT step before moving on.
  switch (cur) {
    case 'TOKEN_PAID':
      if (!hasToken) return { ok: false, reasonKey: 'needToken' };
      break;
    case 'BAYANA_PAID':
      if (!hasBayana) return { ok: false, reasonKey: 'needBayana' };
      break;
    case 'TRANSFER':
      if (!prop?.transfer_date) return { ok: false, reasonKey: 'needTransferDate' };
      break;
    case 'FINISHING': {
      const prog = await getProjectProgress(projectId);
      if (prog.percent <= 0) return { ok: false, reasonKey: 'needConstruction' };
      break;
    }
    case 'LISTED_FOR_SALE':
      return { ok: false, reasonKey: 'needSettle' }; // sale closes via settlement
    default:
      break; // CONSTRUCTION / POSSESSION have only a document requirement (below)
  }

  // Document required to complete the current step (Fard / Agreement / NDC / Registry).
  const requiredDoc = STAGE_REQUIRED_DOC[cur];
  if (requiredDoc) {
    const docs = prop ? await listDocuments('property', prop.id) : [];
    const hasDoc = docs.some((d) => d.label === requiredDoc);
    const docReason: Record<string, TranslationKey> = {
      docFard: 'needFard',
      docAgreement: 'needAgreement',
      docNdc: 'needNdc',
      docRegistry: 'needRegistry',
    };
    if (!hasDoc) return { ok: false, reasonKey: docReason[requiredDoc] ?? null };
  }

  return { ok: true, reasonKey: null };
}
