import { resolveDraft, type Draft, type ResolvedDraft } from './drafts';
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
  /** Writes the user still has to confirm (an image can yield several). */
  drafts: ResolvedDraft[];
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
  /** Progress hook for the thinking bubble: 'tools' while tools run (with their names), 'writing' while the model composes from results. */
  onProgress?: (phase: 'tools' | 'writing', toolNames: string[]) => void;
  /** Base64 JPEGs attached to the user's message. */
  images?: string[];
}

/** The UI never shows em/en dashes: " — " reads as a comma, a bare "—" as a hyphen. */
export function cleanDashes(s: string): string {
  return s.replace(/\s+[—–]\s+/g, ', ').replace(/[—–]/g, '-');
}

const splitPipes = (raw: string, max: number): string[] =>
  raw
    .split('|')
    .map((x) => cleanDashes(x.trim().replace(/^["'“”]+|["'“”.]+$/g, '')))
    .filter((x) => x.length > 0 && x.length <= 60)
    .slice(0, max);

/**
 * Peel the marker lines off an answer:
 *   "…\nOPTIONS: a | b | c"  → choices the user should pick from (≤ 8)
 *   "…\nSUGGEST: a | b | c"  → follow-ups the user can tap (≤ 3)
 */
export function splitSuggestions(raw: string | null | undefined): { text: string; suggestions: string[]; options: string[] } {
  let text = cleanDashes((raw ?? '').trim());
  if (!text) return { text: '', suggestions: [], options: [] };
  let suggestions: string[] = [];
  let options: string[] = [];
  // Markers may land mid-line ("…kya tha? OPTIONS: a | b"); accept them anywhere.
  const sug = text.match(/(?:^|\n|\s)SUGGEST\s*:\s*(.+)\s*$/i);
  if (sug) {
    suggestions = splitPipes(sug[1], 3);
    text = text.slice(0, sug.index).trim();
  }
  const opt = text.match(/(?:^|\n|\s)OPTIONS\s*:\s*(.+)\s*$/i);
  if (opt) {
    options = splitPipes(opt[1], 8);
    text = text.slice(0, opt.index).trim();
  }
  return { text, suggestions, options };
}

export async function runAgent(text: string, deps: AgentDeps): Promise<AgentResult> {
  const { transport, world, runIntent } = deps;
  const maxCalls = deps.maxCalls ?? 6;
  const messages: AiChatMessage[] = [
    { role: 'system', content: agentSystemPrompt(world) },
    ...(deps.history ?? []),
    { role: 'user', content: text, ...(deps.images?.length ? { images: deps.images } : {}) },
  ];
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
        return { text: fallback, cards, drafts: [], suggestions, options, memory: memoryBits.join('\n'), calls: call };
      }
      return { text: answer, cards, drafts: [], suggestions, options, memory: [...memoryBits, `assistant: ${answer}`].join('\n'), calls: call };
    }

    // Writes and opens end the turn: the user decides next. Several writes in
    // one reply (a bill with three lines, a list of workers) all become cards.
    const actions = res.toolCalls.map((tc) => ({ tc, action: interpretToolCall(tc) }));
    const writes = actions.filter((a) => a.action.kind === 'write');
    if (writes.length > 0) {
      const drafts = writes.map((a) => resolveDraft((a.action as { kind: 'write'; draft: Draft }).draft, world));
      let text = splitSuggestions(res.content).text;
      if (!text) {
        // Tool-only replies carry no words. Non-technical users need a plain
        // sentence above the card saying what will be saved, so ask for one.
        deps.onProgress?.('writing', []);
        text = await confirmationLine(deps.transport, messages, drafts);
      }
      return {
        text,
        // Read cards fetched on the way (checking a balance, finding the PO) are
        // scaffolding, not the answer: the user asked to record something.
        cards: [],
        drafts,
        suggestions: [],
        options: [],
        memory: [...memoryBits, ...writes.map((a) => `assistant proposed ${a.tc.name}: ${JSON.stringify((a.action as { kind: 'write'; draft: Draft }).draft)} (awaiting user confirmation)`)].join('\n'),
        calls: call,
      };
    }
    const open = actions.find((a) => a.action.kind === 'open');
    if (open && open.action.kind === 'open') {
      return { text: splitSuggestions(res.content).text, cards, drafts: [], open: open.action.screen, suggestions: [], options: [], memory: [...memoryBits, `assistant opened ${open.action.screen}`].join('\n'), calls: call };
    }

    // Read tools: run them all, feed results back, let the model answer.
    deps.onProgress?.('tools', res.toolCalls.map((c) => c.name));
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
    deps.onProgress?.('writing', []);
  }

  // Out of calls: fall back to the cards' own sentences.
  const fallback = cards.map((c) => c.speak).join(' ');
  if (!fallback) throw new AiError('unparseable', 'agent loop exhausted');
  return { text: fallback, cards, drafts: [], suggestions: [], options: [], memory: memoryBits.join('\n'), calls: maxCalls };
}

/**
 * One or two sentences, in the user's language, restating what the proposed
 * action will save and asking them to accept or reject. Empty on failure; the
 * screen then shows its fixed hint instead.
 */
async function confirmationLine(transport: AiTransport, messages: AiChatMessage[], drafts: ResolvedDraft[]): Promise<string> {
  const facts = drafts.map((r) => ({
    ...r.draft,
    ...(r.account ? { account: r.account.name } : {}),
    ...(r.accountTo ? { accountTo: r.accountTo.name } : {}),
    ...(r.project ? { project: r.project.name } : {}),
    ...(r.plot ? { plot: r.plot.name } : {}),
    ...(r.party ? { party: r.party.name } : {}),
    ...(r.worker ? { worker: r.worker.name } : {}),
    ...(r.investor ? { investor: r.investor.name } : {}),
  }));
  const ask: AiChatMessage = {
    role: 'user',
    content:
      `[app] You proposed this action and the app is showing it as a card with Accept and Reject buttons: ${JSON.stringify(facts)}. ` +
      'Write 1 to 2 short sentences in the same language the user wrote in (Roman Urdu stays Roman Urdu), restating in plain words exactly what will be saved: who, how much, from which account, for which project or plot, and the date if not today. ' +
      'Mention only details that are present; never say what is missing or not used. End by telling them to tap Accept if this is right or Reject if not. No lists, no headings, no tool calls, no markdown except **bold** for the amount.',
  };
  try {
    // Tool-call turns cannot be replayed without the tools list, so restate
    // from a clean context: system prompt, the user's own words, this ask.
    const clean = messages.filter((m) => m.role === 'system' || m.role === 'user').map((m) => (m.role === 'user' ? { role: 'user' as const, content: m.content } : m));
    const out = await transport.chat([...clean, ask], { temperature: 0.2 });
    return cleanDashes(splitSuggestions(out).text);
  } catch {
    return '';
  }
}
