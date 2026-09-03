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
  /** Choices the model asked the user to pick from (rendered as a selectable list). */
  options: string[];
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
  /** Progress hook: which tools are running right now (for the thinking bubble). */
  onProgress?: (toolNames: string[]) => void;
}

const splitPipes = (raw: string, max: number): string[] =>
  raw
    .split('|')
    .map((x) => x.trim().replace(/^["'“”]+|["'“”.]+$/g, ''))
    .filter((x) => x.length > 0 && x.length <= 60)
    .slice(0, max);

/**
 * Peel the marker lines off an answer:
 *   "…\nOPTIONS: a | b | c"  → choices the user should pick from (≤ 8)
 *   "…\nSUGGEST: a | b | c"  → follow-ups the user can tap (≤ 3)
 */
export function splitSuggestions(raw: string | null | undefined): { text: string; suggestions: string[]; options: string[] } {
  let text = (raw ?? '').trim();
  if (!text) return { text: '', suggestions: [], options: [] };
  let suggestions: string[] = [];
  let options: string[] = [];
  const sug = text.match(/(?:^|\n)\s*SUGGEST\s*:\s*(.+)\s*$/i);
  if (sug) {
    suggestions = splitPipes(sug[1], 3);
    text = text.slice(0, sug.index).trim();
  }
  const opt = text.match(/(?:^|\n)\s*OPTIONS\s*:\s*(.+)\s*$/i);
  if (opt) {
    options = splitPipes(opt[1], 8);
    text = text.slice(0, opt.index).trim();
  }
  return { text, suggestions, options };
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
      const { text: answer, suggestions, options } = splitSuggestions(res.content);
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
        return { text: fallback, cards, suggestions, options, memory: memoryBits.join('\n'), calls: call };
      }
      return { text: answer, cards, suggestions, options, memory: [...memoryBits, `assistant: ${answer}`].join('\n'), calls: call };
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
          options: [],
          memory: [...memoryBits, `assistant proposed ${tc.name}: ${JSON.stringify(action.draft)} (awaiting user confirmation)`].join('\n'),
          calls: call,
        };
      }
      if (action.kind === 'open') {
        return { text: splitSuggestions(res.content).text, cards, open: action.screen, suggestions: [], options: [], memory: [...memoryBits, `assistant opened ${action.screen}`].join('\n'), calls: call };
      }
    }

    // Read tools: run them all, feed results back, let the model answer.
    deps.onProgress?.(res.toolCalls.map((c) => c.name));
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
  return { text: fallback, cards, suggestions: [], options: [], memory: memoryBits.join('\n'), calls: maxCalls };
}
