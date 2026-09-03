import { MAX_OUTPUT_TOKENS } from './models';
import { AiError, type AiChatMessage, type AiTransport, type ChatOptions } from './types';

/**
 * JSON helpers shared by the client and the router. PURE (no store, no
 * native modules) so the routing logic can be unit-tested with a fake
 * transport.
 */

/** Pull the first JSON object out of a model reply (tolerates ```json fences). */
export function extractJson(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AiError('unparseable', stripped.slice(0, 120));
  try {
    return JSON.parse(stripped.slice(start, end + 1)) as unknown;
  } catch {
    throw new AiError('unparseable', stripped.slice(0, 120));
  }
}

/** Ask for a JSON object (temperature 0 — precision over variety) and parse it. */
export async function chatJson(
  transport: AiTransport,
  system: string,
  user: string,
  opts?: ChatOptions,
  /** Earlier turns (oldest first) so follow-ups like "aur pichle mahine?" resolve. */
  history: AiChatMessage[] = []
): Promise<unknown> {
  const raw = await transport.chat(
    [{ role: 'system', content: system }, ...history, { role: 'user', content: user }],
    { json: true, temperature: 0, maxTokens: MAX_OUTPUT_TOKENS, ...opts }
  );
  return extractJson(raw);
}
