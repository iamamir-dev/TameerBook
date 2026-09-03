/** Back-compat re-exports; the catalogue now lives in providers.ts. */
export { GROQ_WHISPER, MAX_OUTPUT_TOKENS, PROVIDERS } from './providers';
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
export const GROQ_MODELS = {
  text: 'openai/gpt-oss-120b',
  textFallback: 'qwen/qwen3.6-27b',
  vision: 'qwen/qwen3.6-27b',
  whisper: 'whisper-large-v3-turbo',
} as const;
