/**
 * Provider model ids — ONE place to bump when a free model is renamed or
 * retired (Groq rotates preview models). Chosen for the free tier + no
 * training on customer data (Groq Services Agreement §4.2).
 */
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

export const GROQ_MODELS = {
  /** Router / extraction / narration. Strong JSON + instruction following. */
  text: 'openai/gpt-oss-120b',
  /** Used when the primary hits its per-model daily cap. Fair Urdu. */
  textFallback: 'qwen/qwen3.6-27b',
  /** The only free vision family on Groq (2048 tokens per image). */
  vision: 'qwen/qwen3.6-27b',
  /** Speech to text; turbo is cheaper per second and accurate enough here. */
  whisper: 'whisper-large-v3-turbo',
} as const;

/** Keep prompts + answers small: Groq free tier is 8K tokens per minute. */
export const MAX_OUTPUT_TOKENS = 700;
