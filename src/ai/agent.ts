import { resolveDraft, type ResolvedDraft } from './drafts';
import type { Intent, OpenScreen } from './intents';
import { agentSystemPrompt, type World } from './prompts';
import type { Answer } from './runner';
import { interpretToolCall, summarizeAnswerForModel, TOOLS } from './tools';
import { AiError, type AiChatMessage, type AiTransport } from './types';

/**
 * THE AGENT LOOP. One user utterance → the model may call read tools (we run
 * them and feed the numbers back) until it writes a final answer; or it calls
 * a write tool (→ a draft the user confirms) or open_screen. Max 4 model
 * calls per turn. Transport + intent runner are injected so this is testable.
 */

export interface AgentResult {
  /** The model's natural-language answer (may be empty when a draft/open follows). */
  text: string;
  /** Data cards from read tools, in call order. */
  cards: Answer[];
  /** A write the user still has to confirm. */
  draft?: ResolvedDraft;
  /** A screen the user asked to open. */
  open?: OpenScreen;
  /** Tappable follow-ups the model offered ("you can also…"). */
  suggestions: string[];
  /** Compact memory of this turn for the next one. */
  memory: string;
  /** How many model calls it took. */
  calls: number;
}

export interface AgentDeps {
  transport: AiTransport;
  world: World;
  runIntent: (intent: Intent, world: World) => Promise<Answer>;
  /** Prior turns (oldest first), already compact. */
  history?: AiChatMessage[];
  maxCalls?: number;
}

/** Split "…\nSUGGEST: a | b | c" into the answer and up to three follow-ups. */
export function splitSuggestions(raw: string | null | undefined): { text: string; suggestions: string[] } {
  const src = (raw ?? '').trim();
  if (!src) return { text: '', suggestions: [] };
  const m = src.match(/(?:^|\n)\s*SUGGEST\s*:\s*(.+)\s*$/i);
  if (!m) return { text: src, suggestions: [] };
  const suggestions = m[1]
    .split('|')
    .map((x) => x.trim().replace(/^["'“”]+|["'“”.]+$/g, ''))
    .filter((x) => x.length > 0 && x.length <= 60)
    .slice(0, 3);
  return { text: src.slice(0, m.index).trim(), suggestions };
}

export async function runAgent(text: string, deps: AgentDeps): Promise<AgentResult> {
  const { transport, world, runIntent } = deps;
  const maxCalls = deps.maxCalls ?? 6;
  const messages: AiChatMessage[] = [{ role: 'system', content: agentSystemPrompt(world) }, ...(deps.history ?? []), { role: 'user', content: text }];
  const cards: Answer[] = [];
  const memoryBits: string[] = [];
  let nudged = false;

  for (let call = 1; call <= maxCalls; call++) {
    const res = await transport.chatTools(messages, TOOLS);

    if (res.toolCalls.length === 0) {
      const { text: answer, suggestions } = splitSuggestions(res.content);
      if (!answer && cards.length === 0) {
        // An empty turn (reasoning-only output, truncated completion): nudge once.
        if (!nudged && call < maxCalls) {
          nudged = true;
          messages.push({ role: 'assistant', content: '' });
          messages.push({ role: 'user', content: 'Your reply was empty. Either call the right tool now or answer in text (1–3 sentences).' });
          continue;
        }
        throw new AiError('unparseable', 'no text and no tool call');
      }
      if (!answer) {
        // Tools ran but the model added nothing: use the cards' own sentences.
        const fallback = cards.map((c) => c.speak).join(' ');
        return { text: fallback, cards, suggestions, memory: memoryBits.join('\n'), calls: call };
      }
      return { text: answer, cards, suggestions, memory: [...memoryBits, `assistant: ${answer}`].join('\n'), calls: call };
    }

    // Writes and opens end the turn: the user decides next.
    for (const tc of res.toolCalls) {
      const action = interpretToolCall(tc);
      if (action.kind === 'write') {
        const draft = resolveDraft(action.draft, world);
        return {
          text: splitSuggestions(res.content).text,
          cards,
          draft,
          suggestions: [],
          memory: [...memoryBits, `assistant proposed ${tc.name}: ${JSON.stringify(action.draft)} (awaiting user confirmation)`].join('\n'),
          calls: call,
        };
      }
      if (action.kind === 'open') {
        return { text: splitSuggestions(res.content).text, cards, open: action.screen, suggestions: [], memory: [...memoryBits, `assistant opened ${action.screen}`].join('\n'), calls: call };
      }
    }

    // Read tools: run them all, feed results back, let the model answer.
    messages.push({ role: 'assistant', content: res.content, toolCalls: res.toolCalls });
    for (const tc of res.toolCalls) {
      const action = interpretToolCall(tc);
      let content: string;
      if (action.kind === 'read') {
        try {
          const answer = await runIntent(action.intent, world);
          cards.push(answer);
          content = summarizeAnswerForModel(answer);
          memoryBits.push(`tool ${tc.name}: ${answer.speak}`);
        } catch (e) {
          content = JSON.stringify({ error: e instanceof Error ? e.message : 'failed' });
        }
      } else if (action.kind === 'knowledge') {
        content = action.text;
      } else {
        content = JSON.stringify({ error: action.kind === 'invalid' ? action.reason : 'unexpected' });
      }
      messages.push({ role: 'tool', toolCallId: tc.id, name: tc.name, content });
    }
  }

  // Out of calls: fall back to the cards' own sentences.
  const fallback = cards.map((c) => c.speak).join(' ');
  if (!fallback) throw new AiError('unparseable', 'agent loop exhausted');
  return { text: fallback, cards, suggestions: [], memory: memoryBits.join('\n'), calls: maxCalls };
}
