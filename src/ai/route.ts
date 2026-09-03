import { chatJson } from './json';
import { resolveDraft, type ResolvedDraft } from './drafts';
import { parseRouterOutput, type RouterResult } from './intents';
import { routerSystemPrompt, type World } from './prompts';
import { AiError, type AiTransport } from './types';

/**
 * Route one utterance with a VALIDATE-AND-REPAIR loop: the model's first JSON
 * is checked (shape, intent catalogue, names against the user's own data); if
 * it fails, ONE second call tells the model exactly what was wrong and asks
 * for corrected JSON. This is how we get "no correction needed" answers out
 * of a hosted model without fine-tuning. Transport-injected → unit-tested.
 */

export interface Routed {
  result: RouterResult;
  /** Set when the result is a draft, already resolved against the world. */
  resolved?: ResolvedDraft;
  /** How many model calls it took (1 or 2). */
  attempts: number;
}

function problems(raw: unknown, parsed: RouterResult | null, world: World): { ok: boolean; note: string; resolved?: ResolvedDraft } {
  if (!parsed) return { ok: false, note: 'The JSON did not match any allowed shape (kind must be "question", "draft" or "chat").' };
  if (parsed.kind !== 'draft') return { ok: true, note: '' };
  const resolved = resolveDraft(parsed.draft, world);
  if (resolved.unresolved.length === 0) return { ok: true, note: '', resolved };
  return {
    ok: false,
    resolved,
    note: `These names are not in the lists: ${resolved.unresolved.join(', ')}. Use the closest name from the lists, or if the user clearly meant a new person, keep their wording but move it to "note".`,
  };
}

export async function routeUtterance(transport: AiTransport, world: World, text: string): Promise<Routed> {
  const system = routerSystemPrompt(world);
  const first = await chatJson(transport, system, text);
  const parsed = parseRouterOutput(first);
  const check = problems(first, parsed, world);
  if (check.ok && parsed) return { result: parsed, resolved: check.resolved, attempts: 1 };

  // One repair pass: show the model its own output and the exact problem.
  const repairUser = `User said: "${text}"\nYour JSON was: ${JSON.stringify(first).slice(0, 1500)}\nProblem: ${check.note}\nReturn the corrected JSON object only.`;
  let second: unknown = null;
  try {
    second = await chatJson(transport, system, repairUser);
  } catch (e) {
    if (!(e instanceof AiError && e.code === 'unparseable')) throw e;
  }
  const parsed2 = second === null ? null : parseRouterOutput(second);
  if (!parsed2) {
    // Fall back to the first parse if it existed (a draft with an unknown
    // name is still useful — the card shows what was not found).
    if (parsed) return { result: parsed, resolved: check.resolved, attempts: 2 };
    throw new AiError('unparseable');
  }
  const check2 = problems(second, parsed2, world);
  return { result: parsed2, resolved: check2.resolved, attempts: 2 };
}
