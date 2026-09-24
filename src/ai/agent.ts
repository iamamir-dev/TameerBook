import { resolveDraft, type Draft, type ResolvedDraft } from './drafts';
import { draftGaps, gapPrompt, groundNames } from './gaps';
import type { Intent, OpenScreen } from './intents';
import type { ReplyLanguage } from './language';
import { languageName } from './language';
import { AGENT_CORE, agentSystemPrompt, confirmationSystemPrompt, type PromptContext, type World } from './prompts';
import type { Answer } from './runner';
import { interpretToolCall, summarizeAnswerForModel, TOOLS } from './tools';
import { addUsage, AiError, type AiChatMessage, type AiTransport, type AiUsage, type ToolCall } from './types';

/**
 * THE AGENT LOOP. One user utterance → the model may call read tools (we run
 * them and feed the numbers back) until it writes a final answer; write tools
 * become drafts the user confirms; open_screen navigates; remember_fact feeds
 * the user's memory. Max 8 model calls per turn. Transport, world and intent
 * runner are injected so the loop is unit-testable.
 *
 * Built for Claude: the static head of the system prompt is flagged as a
 * cacheable prefix, tool results for one turn go back together, and no
 * synthetic turns are ever appended (an empty assistant message is rejected).
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
  /** Tokens the turn cost, summed over its calls (when the provider reports them). */
  usage?: AiUsage;
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

/**
 * A spaced em dash is the separator the reply style uses ("**Kharcha** — is mahine");
 * it stays. An unspaced dash glued to words reads as a hyphen, an en dash likewise.
 */
export function cleanDashes(s: string): string {
  return s.replace(/\s+–\s+/g, ' — ').replace(/(\S)[—–](\S)/g, '$1-$2').replace(/–/g, '-');
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
  // Safety net: the model sometimes tucks the marker mid-sentence, often in
  // brackets ("plot choose karo (OPTIONS: A | B) aur…"). The user must never
  // read the word OPTIONS, so lift those choices out and heal the sentence.
  text = text.replace(/[([]\s*\**OPTIONS\**\s*:\s*([^)\]]+)[)\]]/gi, (_m, list: string) => {
    if (options.length === 0) options = splitPipes(list, 8);
    return '';
  });
  text = text
    .replace(/(?:^|\n)\s*\**(?:OPTIONS|SUGGEST)\**\s*:.*$/gim, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.:;?!])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
 * The facts of a proposed write, in words, for the confirmation message: what
 * the app will actually save, with matched names (never the user's spelling)
 * and the app's own arithmetic. Only present facts are listed, so the model
 * has nothing to invent and nothing to call missing.
 */
export function willSaveFacts(r: ResolvedDraft, total: number | undefined): Record<string, string> {
  const d = r.draft as Record<string, unknown> & { kind: string };
  const out: Record<string, string> = {};
  const put = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === '' || v === false) return;
    out[k] = typeof v === 'number' ? (k === 'amount' || k === 'rate' || k === 'wage' || k === 'price' ? `Rs ${v.toLocaleString('en-IN')}` : String(v)) : String(v);
  };
  put('amount', total !== undefined ? total : typeof d.amount === 'number' ? d.amount : undefined);
  if (d.kind === 'material') put('item', `${r.category?.name ?? String(d.item)}${d.qty ? ` ${d.qty}${d.unit ? ` ${String(d.unit)}` : ''}` : ''}${d.rate ? ` @ Rs ${Number(d.rate).toLocaleString('en-IN')}` : ''}`);
  if (Array.isArray(d.items)) put('items', (d.items as { item: string; qty: number; unit?: string; rate: number }[]).map((i) => `${i.item} ${i.qty}${i.unit ? ` ${i.unit}` : ''} @ Rs ${i.rate.toLocaleString('en-IN')}`).join('; '));
  put('category', r.category?.name ?? (d.kind !== 'material' ? d.category : undefined));
  put('name', d.name);
  put('phone', d.phone);
  put('wage', d.wage);
  put('price', d.price ?? d.dealPrice ?? d.openingBalance);
  put('party', r.party?.name ?? d.party ?? d.supplier ?? d.buyer ?? d.seller ?? d.person);
  put('worker', r.worker?.name);
  put('investor', r.investor?.name);
  put('project', r.project?.name);
  put('plot', r.plot?.name);
  put('account', r.accountTo && r.account ? `${r.account.name} → ${r.accountTo.name}` : r.account?.name);
  put('order', d.po);
  put('paymentType', d.payType);
  put('date', typeof d.date === 'string' ? d.date : 'today');
  put('note', d.note);
  if (d.kind === 'attendance') put('attendance', d.allPresent ? 'everyone present' : r.marks.map((m) => `${m.worker?.name ?? m.mark.worker}: ${m.mark.status.toLowerCase()}`).join(', '));
  return out;
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
// Warm enough that the wording varies between turns, tight enough that the
// reply language and the style rules are actually followed.
const TEMP_COMPOSE = 0.35;

export async function runAgent(text: string, deps: AgentDeps): Promise<AgentResult> {
  const { transport, world, runIntent } = deps;
  const maxCalls = deps.maxCalls ?? 8;
  const lang: ReplyLanguage = deps.prompt?.language ?? (world.language === 'ur' ? 'ur' : 'en');
  const system = agentSystemPrompt(world, deps.prompt);
  const messages: AiChatMessage[] = [
    // The core never changes between turns: providers that cache a prefix cache it (and the tools ahead of it).
    { role: 'system', content: system, ...(system.startsWith(AGENT_CORE) ? { cachePrefixChars: AGENT_CORE.length } : {}) },
    ...(deps.history ?? []),
    // The language line rides with the user's own message too: it is the last
    // thing the model reads, and short follow-ups ("aur pichle mahine?") were
    // drifting back to English when it only appeared in the system prompt.
    { role: 'user', content: `${text}\n\n(Answer in ${languageName(lang)}.)`, ...(deps.images?.length ? { images: deps.images } : {}) },
  ];
  // Everything the user has actually said that the model can still see: this
  // message plus the recent turns, so an answer to "which project?" still
  // grounds the name it supplies next.
  const heardFromUser = [...(deps.history ?? []).filter((m) => m.role === 'user').map((m) => m.content), text].join(' ');
  const cards: Answer[] = [];
  const toolLog: string[] = [];
  const learned: string[] = [];
  let nudged = false;
  let sawResults = false;
  let usage: AiUsage | undefined;
  // Writes proposed so far this turn (a bill: order → delivery → payment). The
  // model is told each one is queued and asked to continue, so every action in
  // the user's message becomes a step before the turn ends.
  const queued: { tc: ToolCall; draft: Draft }[] = [];

  const base = (call: number, extraMemory: string[] = []) => ({
    toolLog,
    learned,
    calls: call,
    usage,
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
    usage = addUsage(usage, res.usage);

    if (res.toolCalls.length === 0) {
      if (queued.length > 0) return finishWrites(res.content, call);
      const { text: answer, suggestions, options } = splitSuggestions(res.content);
      if (!answer && cards.length === 0) {
        // An empty turn: the MWAPI gateway has been seen returning `content: []`
        // with stop_reason tool_use, and the same request repeats it. A user
        // nudge changes the request (never an empty assistant turn, which
        // Claude rejects), so the retry actually differs.
        if (!nudged && call < maxCalls) {
          nudged = true;
          messages.push({ role: 'user', content: 'Your reply was empty. Call the right tool now, or answer in text (1 to 3 sentences).' });
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
        // A name the user never said is a guess, not an argument: drop it so
        // the gap check below turns it into a question.
        const draft = groundNames(action.draft, heardFromUser);
        const resolved = resolveDraft(draft, world);
        // A card is a receipt, not a form. If anything essential is still
        // unknown, nothing is shown: the model asks in the chat instead, and
        // offers to create what the user does not have yet.
        const gaps = draftGaps(resolved, world);
        if (gaps.length > 0) {
          sawResults = true;
          // The gap instruction is the last thing the model reads before it
          // writes, so it has to carry the language too, or the reply comes
          // back in the language of the instruction rather than the user's.
          content = JSON.stringify({ notReady: true, ask: `${gapPrompt(gaps)} Write it in ${languageName(lang)}.` });
          messages.push({ role: 'tool', toolCallId: tc.id, name: tc.name, content });
          continue;
        }
        queued.push({ tc, draft });
        // The next call only writes the confirmation sentence: let it vary.
        sawResults = true;
        const total = draftTotal(draft);
        content = JSON.stringify({
          prepared: true,
          step: queued.length,
          // The figures the app will actually save, so the sentence states them
          // rather than arithmetic of the model's own.
          willSave: willSaveFacts(resolved, total),
          note: `Ready for the user to confirm, not saved yet. If the user's message describes more actions (delivery received, payment made, more bill lines), call those tools now, in order; later steps may refer to this order by supplier name. When nothing is left, stop calling tools and write the confirmation, in ${languageName(lang)}: a lead line asking them to check, then one line per fact in willSave (emoji, label, value in bold), then one question asking whether to save. Use ONLY the facts in willSave, copied exactly: never multiply, add or restate an amount, never add a fact that is not there, never say what is missing.`,
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
