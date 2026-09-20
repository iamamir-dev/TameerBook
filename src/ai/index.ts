/** AI layer barrel — transports, tools, agent loop, drafts, runner. */
export {
  AiError,
  isAiError,
  type AiChatMessage,
  type AiErrorCode,
  type AiTransport,
  type AudioFile,
  type ChatToolsResult,
  type ToolCall,
  type ToolSpec,
} from './types';
export { AI_PROVIDERS, GROQ_WHISPER, MAX_OUTPUT_TOKENS, PROVIDERS, type AiProviderId, type ModelPreset, type ProviderInfo } from './providers';
export { aiAvailability, chatJson, extractJson, getAiTransport, testConnection, type AiAvailability } from './client';
export { matchName, findNamesIn, normalizeName, type Named } from './match';
export {
  coerceIntent,
  periodToRange,
  ENTITY_KINDS,
  OPEN_SCREENS,
  REPORT_KINDS,
  type EntityKind,
  type Intent,
  type OpenScreen,
  type Period,
  type ReportKind,
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
export { AGENT_CORE, agentSystemPrompt, billSystemPrompt, confirmationSystemPrompt, narrationSystemPrompt, transcriptionPrompt, type PromptContext, type World } from './prompts';
export { buildWorld } from './context';
export { periodLabel, runIntent, type Answer, type AnswerCalendar, type AnswerChart, type AnswerListItem, type AnswerRow, type AnswerTarget } from './runner';
export { billToMaterialPrefill, billToPurchaseOrderPrefill, coerceBill, type Bill, type BillItem } from './bill';
export { isWhisperNoise, MIN_RECORDING_MS } from './transcript';
export { TOOLS, interpretToolCall, summarizeAnswerForModel, type ToolAction } from './tools';
export { describeDraft, runAgent, splitSuggestions, type AgentDeps, type AgentResult } from './agent';
export {
  arabicShare,
  decideReplyLanguage,
  detectLanguage,
  dominantLanguage,
  dominantScript,
  languageDirective,
  REPLY_LANGUAGE_SETTINGS,
  type LanguageGuess,
  type ReplyLanguage,
  type ReplyLanguageSetting,
} from './language';
export { addFact, emptyMemory, forgetFacts, memoryBlock, noteAccepted, noteLanguage, parseMemory, type UserMemory } from './memory';
export { draftGaps, gapPrompt, type Gap } from './gaps';
export { EVAL_CASES, judge, runEvals, type EvalCase, type EvalDeps, type EvalResult } from './evals';
export { assistantGist, compactHistory, parseExchanges, recordOutcome, type Exchange } from './history';
export { CORE_KNOWLEDGE, KNOWLEDGE_TOPICS, MODULE_KNOWLEDGE, explainTopic, type KnowledgeTopic } from './knowledge';
