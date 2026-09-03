/**
 * Shared types for the AI layer. Everything the assistant does goes through
 * an `AiTransport` (one per provider) and fails with a coded `AiError`, so
 * screens can show one plain sentence per failure instead of a stack trace.
 */

export type AiErrorCode =
  /** Assistant switched off in Settings. */
  | 'disabled'
  /** No network. */
  | 'offline'
  /** No key / URL configured for the chosen provider. */
  | 'noProvider'
  /** The chosen provider cannot transcribe audio and no Groq key is set. */
  | 'noVoice'
  /** Provider rate limit / free quota exhausted. */
  | 'quota'
  /** Key or app token rejected. */
  | 'badkey'
  /** The model answered but not in the shape we asked for. */
  | 'unparseable'
  /** Anything else (5xx, malformed response…). */
  | 'failed';

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    detail?: string
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'AiError';
  }
}

export function isAiError(e: unknown): e is AiError {
  return e instanceof AiError;
}

/** One tool the model may call (OpenAI function-calling shape). */
export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the arguments object. */
  parameters: Record<string, unknown>;
}

/** A call the model made. `args` is already parsed JSON. */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** Conversation message. Tool results reference the call they answer. */
export type AiChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

export interface ChatOptions {
  /** Ask for a JSON object (provider-enforced when supported). */
  json?: boolean;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/** What a tool-enabled turn returns: text, tool calls, or both. */
export interface ChatToolsResult {
  content: string | null;
  toolCalls: ToolCall[];
}

export interface AudioFile {
  uri: string;
  name: string;
  /** e.g. 'audio/m4a'. */
  type: string;
}

export interface TranscribeOptions {
  /** ISO-639-1 hint ('ur' / 'en'); omit to auto-detect. */
  language?: string;
  /** Vocabulary bias — names of materials, suppliers, workers. */
  prompt?: string;
}

/** One provider behind one interface. */
export interface AiTransport {
  readonly kind: string;
  /** Plain completion (used for narration / JSON extraction). */
  chat(messages: AiChatMessage[], opts?: ChatOptions): Promise<string>;
  /** Tool-calling turn — the agent loop. */
  chatTools(messages: AiChatMessage[], tools: ToolSpec[], opts?: ChatOptions): Promise<ChatToolsResult>;
  /** Speech → text. Throws AiError('noVoice') when the provider cannot. */
  transcribe(file: AudioFile, opts?: TranscribeOptions): Promise<string>;
  /** Describe / extract from a JPEG (base64, no data-URL prefix). */
  vision(imageBase64: string, prompt: string, opts?: ChatOptions): Promise<string>;
}
