/**
 * Shared types for the AI layer. Everything the assistant does goes through
 * an `AiTransport` (proxy or direct provider) and fails with a coded
 * `AiError`, so screens can show one plain sentence per failure instead of
 * a stack trace.
 */

export type AiErrorCode =
  /** Assistant switched off in Settings. */
  | 'disabled'
  /** No network. */
  | 'offline'
  /** Neither a proxy URL nor an API key is configured. */
  | 'noProvider'
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

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  /** Ask for a JSON object (provider-enforced when supported). */
  json?: boolean;
  model?: string;
  maxTokens?: number;
  temperature?: number;
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

/** One provider behind one interface: the proxy, or a direct provider key. */
export interface AiTransport {
  readonly kind: 'proxy' | 'groq';
  chat(messages: AiChatMessage[], opts?: ChatOptions): Promise<string>;
  transcribe(file: AudioFile, opts?: TranscribeOptions): Promise<string>;
  /** Describe / extract from a JPEG (base64, no data-URL prefix). */
  vision(imageBase64: string, prompt: string, opts?: ChatOptions): Promise<string>;
}
