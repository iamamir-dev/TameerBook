/** AI layer barrel — transport, prompts, intents, drafts, runner. */
export { AiError, isAiError, type AiChatMessage, type AiErrorCode, type AiTransport, type AudioFile } from './types';
export { GROQ_MODELS } from './models';
export { aiAvailability, chatJson, extractJson, getAiTransport, type AiAvailability, type ProviderKind } from './client';
export { matchName, findNamesIn, normalizeName, type Named } from './match';
export {
  coerceIntent,
  parseRouterOutput,
  periodToRange,
  type EntityKind,
  type Intent,
  type OpenScreen,
  type Period,
  type ReportKind,
  type RouterResult,
} from './intents';
export {
  CREATE_KINDS,
  coerceDraft,
  draftToEntryPrefill,
  draftToMaterialPrefill,
  resolveDraft,
  type Draft,
  type DraftKind,
  type MaterialPrefill,
  type PurchaseOrderPrefill,
  type ResolvedDraft,
  type WorldNames,
} from './drafts';
export { billSystemPrompt, narrationSystemPrompt, routerSystemPrompt, transcriptionPrompt, type World } from './prompts';
export { buildWorld } from './context';
export { periodLabel, runIntent, type Answer, type AnswerChart, type AnswerListItem, type AnswerRow, type AnswerTarget } from './runner';
export { billToMaterialPrefill, billToPurchaseOrderPrefill, coerceBill, type Bill, type BillItem } from './bill';
export { routeUtterance, type Routed } from './route';
export { isWhisperNoise, MIN_RECORDING_MS } from './transcript';
