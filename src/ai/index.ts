/** AI layer barrel — transport, prompts, intents, drafts, runner. */
export { AiError, isAiError, type AiErrorCode, type AiTransport, type AudioFile } from './types';
export { GROQ_MODELS } from './models';
export { aiAvailability, chatJson, extractJson, getAiTransport, type AiAvailability, type ProviderKind } from './client';
export { matchName, findNamesIn, normalizeName, type Named } from './match';
export {
  coerceIntent,
  parseRouterOutput,
  periodToRange,
  type Intent,
  type Period,
  type RouterResult,
} from './intents';
export {
  coerceDraft,
  draftToEntryPrefill,
  draftToMaterialPrefill,
  resolveDraft,
  type Draft,
  type MaterialPrefill,
  type PurchaseOrderPrefill,
  type ResolvedDraft,
  type WorldNames,
} from './drafts';
export { billSystemPrompt, narrationSystemPrompt, routerSystemPrompt, transcriptionPrompt, type World } from './prompts';
export { buildWorld } from './context';
export { periodLabel, runIntent, type Answer, type AnswerRow, type AnswerTarget } from './runner';
export { billToMaterialPrefill, billToPurchaseOrderPrefill, coerceBill, type Bill, type BillItem } from './bill';
export { routeUtterance, type Routed } from './route';
