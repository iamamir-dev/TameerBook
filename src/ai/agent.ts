import { resolveDraft, type Draft, type ResolvedDraft } from './drafts';
import type { Intent, OpenScreen } from './intents';
import type { ReplyLanguage } from './language';
import { languageName } from './language';
import { agentSystemPrompt, confirmationSystemPrompt, type PromptContext, type World } from './prompts';
import type { Answer } from './runner';
import { interpretToolCall, summarizeAnswerForModel, TOOLS } from './tools';
import { AiError, type AiChatMessage, type AiTransport, type ToolCall } from './types';

/**
 * THE AGENT LOOP. One user utterance → the model may call read tools (we run
 * them and feed the numbers back) until it writes a final answer; write tools
 * become drafts the user confirms; open_screen navigates; remember_fact feeds
 * the user's memory. Max 6 model calls per turn. Transport, world and intent
 * runner are injected so the loop is unit-testable.
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
  /** Tappable follow-ups the model offered. */
  suggestions: string[];
  /** Choices the model asked the user to pick from (rendered as a selectable list). */
  options: string[];
  /** Compact gist of this turn for the conversation history. */
  memory: string;
  /** Tools that ran, with arguments and a one-line result ("get_spend_summary({…}) → …"). */
  toolLog: string[];
  /** One line per proposed write, for the history. */
  draftLines: string[];
  /** Facts the model asked to remember (remember_fact). */
  learned: string[];
  /** How many model calls it took. */
  calls: number;
}

export interface AgentDeps {
  transport: AiTransport;
  world: World;
  runIntent: (intent: Intent, world: World) => Promise<Answer>;
  /** Prior turns (oldest first), already compact. */
  history?: AiChatMessage[];
  /** Reply language, user memory block and older-turns summary for the system prompt. */
  prompt?: PromptContext;
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

/** Devanagari (Hindi script) never belongs in this app's UI; Roman Urdu or Urdu script only. */
const DEVANAGARI = /[ऀ-ॿ]/;

const splitPipes = (raw: string, max: number): string[] =>
  raw
    .split('|')
    .map((x) => cleanDashes(x.trim().replace(/^["'“”]+|["'“”.]+$/g, '')))
    .filter((x) => x.length > 0 && x.length <= 60 && !DEVANAGARI.test(x))
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
  const sug = text.match(/(?:^|\n|\s)\**SUGGEST\**\s*:\s*(.+)\s*$/i);
  if (sug) {
    suggestions = splitPipes(sug[1], 3);
    text = text.slice(0, sug.index).trim();
  }
  const opt = text.match(/(?:^|\n|\s)\**OPTIONS\**\s*:\s*(.+)\s*$/i);
  if (opt) {
    options = splitPipes(opt[1], 8);
    text = text.slice(0, opt.index).trim();
  }
  return { text, suggestions, options };
}

/** "get_spend_summary({"period":{"kind":"month"}})" — compact, for the history. */
const callLabel = (tc: ToolCall): string => {
  const args = JSON.stringify(tc.args ?? {});
  return `${tc.name}(${args === '{}' ? '' : args.slice(0, 120)})`;
};

/** One line describing a proposed write, for the history. */
export function describeDraft(r: ResolvedDraft): string {
  const d = r.draft as Record<string, unknown> & { kind: string };
  const bits: string[] = [];
  for (const [k, v] of Object.entries(d)) {
    if (k === 'kind' || v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    bits.push(`${k}=${typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v)}`);
  }
  const resolved = [r.account && `account→${r.account.name}`, r.project && `project→${r.project.name}`, r.party && `party→${r.party.name}`, r.worker && `worker→${r.worker.name}`]
    .filter(Boolean)
    .join(' ');
  return `${d.kind}: ${bits.join(', ')}${resolved ? ` (${resolved})` : ''}`.slice(0, 220);
}

/**
 * The money a proposed write moves, as the APP computes it. The model must
 * never multiply qty by rate itself: on device it wrote "Rs 1,25,000" for
 * 50 bori at Rs 1,250 while the card correctly showed Rs 62,500.
 */
function draftTotal(d: Draft): number | undefined {
  switch (d.kind) {
    case 'material':
      return d.amount ?? (d.qty !== undefined && d.rate !== undefined ? Math.round(d.qty * d.rate) : undefined);
    case 'createPurchaseOrder':
      return d.items.length ? d.items.reduce((sum, i) => sum + i.qty * i.rate, 0) : undefined;
    case 'setSale':
      return d.price;
    case 'createPlot':
      return d.dealPrice;
    case 'createAccount':
      return d.openingBalance;
    case 'createInvestor':
      return d.amount;
    case 'createProject':
    case 'createWorker':
    case 'createParty':
    case 'attendance':
    case 'receiveDelivery':
    case 'markTransferred':
      return undefined;
    default:
      return d.amount;
  }
}

/** Sampling: exact for the first call (tool choice), warmer once results are in (prose). */
const TEMP_FIRST = 0.2;
const TEMP_COMPOSE = 0.5;

export async function runAgent(text: string, deps: AgentDeps): Promise<AgentResult> {
  const { transport, world, runIntent } = deps;
  const maxCalls = deps.maxCalls ?? 6;
  const lang: ReplyLanguage = deps.prompt?.language ?? (world.language === 'ur' ? 'ur' : 'en');
  const messages: AiChatMessage[] = [
    { role: 'system', content: agentSystemPrompt(world, deps.prompt) },
    ...(deps.history ?? []),
    // The language line rides with the user's own message too: it is the last
    // thing the model reads, and short follow-ups ("aur pichle mahine?") were
    // drifting back to English when it only appeared in the system prompt.
    { role: 'user', content: `${text}\n\n(Answer in ${languageName(lang)}.)`, ...(deps.images?.length ? { images: deps.images } : {}) },
  ];
  const cards: Answer[] = [];
  const toolLog: string[] = [];
  const learned: string[] = [];
  let nudged = false;
  let sawResults = false;
  // Writes proposed so far this turn (a bill: order → delivery → payment). The
  // model is told each one is queued and asked to continue, so every action in
  // the user's message becomes a step before the turn ends.
  const queued: { tc: ToolCall; draft: Draft }[] = [];

  const base = (call: number, extraMemory: string[] = []) => ({
    toolLog,
    learned,
    calls: call,
    memory: [...toolLog.map((l) => `tool ${l}`), ...extraMemory].join('\n'),
  });

  const finishWrites = async (content: string | null, call: number): Promise<AgentResult> => {
    const drafts = queued.map((q) => resolveDraft(q.draft, world));
    let answer = splitSuggestions(content).text;
    if (!answer) {
      // Tool-only replies carry no words. Non-technical users need a plain
      // sentence above the card saying what will be saved, so ask for one.
      deps.onProgress?.('writing', []);
      answer = await confirmationLine(deps.transport, text, drafts, lang);
    }
    const draftLines = drafts.map(describeDraft);
    return {
      text: answer,
      // Read cards fetched on the way (checking a balance, finding the PO) are
      // scaffolding, not the answer: the user asked to record something.
      cards: [],
      drafts,
      suggestions: [],
      options: [],
      draftLines,
      ...base(call, [answer ? `assistant: ${answer}` : '', ...draftLines.map((l) => `assistant proposed ${l} (awaiting user confirmation)`)].filter(Boolean)),
    };
  };

  for (let call = 1; call <= maxCalls; call++) {
    const res = await transport.chatTools(messages, TOOLS, { temperature: sawResults ? TEMP_COMPOSE : TEMP_FIRST });

    if (res.toolCalls.length === 0) {
      if (queued.length > 0) return finishWrites(res.content, call);
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
        return { text: fallback, cards, drafts: [], suggestions, options, draftLines: [], ...base(call, [`assistant: ${fallback}`]) };
      }
      return { text: answer, cards, drafts: [], suggestions, options, draftLines: [], ...base(call, [`assistant: ${answer}`]) };
    }

    const actions = res.toolCalls.map((tc) => ({ tc, action: interpretToolCall(tc) }));
    const open = actions.find((a) => a.action.kind === 'open');
    if (open && open.action.kind === 'open' && queued.length === 0) {
      return {
        text: splitSuggestions(res.content).text,
        cards,
        drafts: [],
        open: open.action.screen,
        suggestions: [],
        options: [],
        draftLines: [],
        ...base(call, [`assistant opened ${open.action.screen}`]),
      };
    }

    // Run every call: reads return data, writes are queued as steps (the user
    // confirms each in the app), then the model continues or wraps up.
    deps.onProgress?.('tools', res.toolCalls.map((c) => c.name));
    messages.push({ role: 'assistant', content: res.content, toolCalls: res.toolCalls });
    for (const { tc, action } of actions) {
      let content: string;
      if (action.kind === 'write') {
        queued.push({ tc, draft: action.draft });
        // The next call only writes the confirmation sentence: let it vary.
        sawResults = true;
        const resolved = resolveDraft(action.draft, world);
        const total = draftTotal(action.draft);
        content = JSON.stringify({
          queued: true,
          step: queued.length,
          // The figures the app will actually save, so the sentence states them
          // rather than arithmetic of the model's own.
          willSave: {
            ...(total !== undefined ? { amount: `Rs ${total.toLocaleString('en-IN')}` } : {}),
            ...(resolved.account ? { account: resolved.account.name } : {}),
            ...(resolved.project ? { project: resolved.project.name } : {}),
            ...(resolved.party ? { party: resolved.party.name } : {}),
            ...(resolved.worker ? { worker: resolved.worker.name } : {}),
            ...(resolved.plot ? { plot: resolved.plot.name } : {}),
            ...(resolved.unresolved.length ? { notSavedYet: resolved.unresolved } : {}),
          },
          note: `Queued for the user to confirm in the app (not saved yet). If the user's message describes more actions (delivery received, payment made, more bill lines), call those tools now, in order; later steps may refer to this order by supplier name. When nothing is left, stop calling tools and write ONE short sentence, in ${languageName(lang)}, saying in your own words what is about to happen. Use ONLY the figures in willSave: never multiply, add or restate an amount yourself. Do not label fields and do not repeat the user's sentence.`,
        });
      } else if (action.kind === 'read') {
        try {
          const answer = await runIntent(action.intent, world);
          if (!answer.notFound) cards.push(answer);
          content = summarizeAnswerForModel(answer);
          toolLog.push(`${callLabel(tc)} → ${answer.notFound ? `no ${answer.notFound.what} "${answer.notFound.query}"` : answer.speak}`.slice(0, 260));
        } catch (e) {
          content = JSON.stringify({ error: e instanceof Error ? e.message : 'failed' });
        }
        sawResults = true;
      } else if (action.kind === 'knowledge') {
        content = action.text;
        toolLog.push(`${callLabel(tc)} → app knowledge`);
        sawResults = true;
      } else if (action.kind === 'remember') {
        learned.push(action.fact);
        content = JSON.stringify({ remembered: true, note: 'Acknowledge in a few words as part of your reply; do not repeat the fact back verbatim.' });
      } else {
        content = JSON.stringify({ error: action.kind === 'invalid' ? action.reason : 'unexpected' });
      }
      messages.push({ role: 'tool', toolCallId: tc.id, name: tc.name, content });
    }
    deps.onProgress?.('writing', []);
    // The last allowed call was spent on writes: wrap up without another round.
    if (queued.length > 0 && call === maxCalls) return finishWrites(res.content, call);
  }

  // Out of calls: fall back to the cards' own sentences.
  const fallback = cards.map((c) => c.speak).join(' ');
  if (!fallback) throw new AiError('unparseable', 'agent loop exhausted');
  return { text: fallback, cards, drafts: [], suggestions: [], options: [], draftLines: [], ...base(maxCalls, [`assistant: ${fallback}`]) };
}

/**
 * One or two sentences, in the reply language, saying what the proposed
 * action will do. Uses a tiny dedicated prompt (not the agent prompt), so it
 * costs a few hundred tokens. Empty on failure; the screen then shows its
 * fixed hint instead.
 */
async function confirmationLine(transport: AiTransport, userText: string, drafts: ResolvedDraft[], lang: ReplyLanguage): Promise<string> {
  const facts = drafts.map((r) => ({
    ...r.draft,
    ...('marks' in r.draft ? { marks: r.marks.map((m) => `${m.worker?.name ?? m.mark.worker}: ${m.mark.status.toLowerCase()} day`) } : {}),
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
    content: `The user said: "${userText.slice(0, 300)}"\nThe app prepared ${facts.length > 1 ? `these ${facts.length} steps, shown one card at a time` : 'this action'}: ${JSON.stringify(facts)}\nWrite the sentence(s) now.`,
  };
  try {
    const out = await transport.chat([{ role: 'system', content: confirmationSystemPrompt(lang) }, ask], { temperature: 0.5 });
    return cleanDashes(splitSuggestions(out).text);
  } catch {
    return '';
  }
}
