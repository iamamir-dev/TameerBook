import { runAgent, type AgentDeps, type AgentResult } from './agent';
import { arabicShare, decideReplyLanguage, detectLanguage, dominantScript, type ReplyLanguage } from './language';
import type { World } from './prompts';
import { isAiError } from './types';

/**
 * BEHAVIOUR EVALS — scripted utterances run through the REAL agent against
 * the configured provider (Dev Tools → Assistant eval), each checked for the
 * tool it should reach for, the language it should answer in, and phrasing it
 * must never use. This is how prompt or model changes are judged: not by one
 * lucky reply, but by a table of PASS / FAIL. Pure apart from `runAgent`.
 */

export interface EvalCase {
  id: string;
  /** What the user types. */
  text: string;
  /** Any of these tools must have run (read or write). */
  tools?: string[];
  /** No tool may run (greetings, general questions). */
  noTool?: boolean;
  /** A write draft must be proposed (kind from the Draft union). */
  draft?: string;
  /** Expected reply language. */
  lang?: ReplyLanguage;
  /** Regexes the reply text must match (case-insensitive). */
  must?: string[];
  /** Regexes the reply text must NOT match. */
  mustNot?: string[];
  /** The reply should ask a question (a counter-question turn). */
  asks?: boolean;
  /** Exchanges to seed as history before this case (a follow-up test). */
  after?: { user: string; assistant: string; tools?: string[] }[];
}

/** Words the builder never wants to read, in any language. */
const BANNED = [
  '\\brecord(ed|ing)?\\b',
  '\\btransaction\\b',
  '\\bdebit\\b',
  '\\bcredit\\b',
  'Great question',
  '^Sure',
  '!',
  '[\\u0900-\\u097F]',
  'SUGGEST:',
  'OPTIONS:',
];

/** Extra bans for a turn that proposes a write: raw field names must never surface. */
const BANNED_ON_WRITE = ['\\b(note|payType|qty|party)\\s*[:=]', '(نوٹ)\\s*[:：]'];

/**
 * Scenarios reference the DEMO dataset (Dev Tools → Load demo data):
 * project "Gulberg House"-style names differ per install, so cases refer to
 * things by role and check tool choice + language, not specific figures.
 */
export const EVAL_CASES: EvalCase[] = [
  // Quick facts, three languages
  { id: 'spend-roman', text: 'is mahine kitna kharcha hua', tools: ['get_spend_summary', 'get_expense_breakdown'], lang: 'roman', must: ['Rs|nahi|koi'] },
  { id: 'spend-urdu', text: 'اس مہینے کتنا خرچ ہوا؟', tools: ['get_spend_summary', 'get_expense_breakdown'], lang: 'ur' },
  { id: 'cash-en', text: 'How much cash do I have?', tools: ['get_account_balance'], lang: 'en', must: ['Rs'] },
  { id: 'cash-mixed', text: 'cash balance kitna hai', tools: ['get_account_balance'], lang: 'roman' },
  // Subsets, not everything
  { id: 'po-pending', text: 'kon se orders abhi tak deliver nahi hue', tools: ['get_purchase_orders'], lang: 'roman' },
  // The tool says WHAT IS STILL TO PAY; it names no account and no date, so the reply must not either.
  { id: 'workers-owed', text: 'kin mazdooron ke paise dene hain', tools: ['get_worker_balance', 'list_names'], lang: 'roman', mustNot: ['\\bowed\\b', 'outstanding', 'Cash in Hand', 'Meezan', '\\baaj\\b'] },
  { id: 'names-projects', text: 'which projects do I have', tools: ['list_names', 'get_project_status'], lang: 'en', mustNot: ['\\bscreen\\b', '\\btab\\b', '\\bmenu\\b'] },
  // Writes
  { id: 'expense-roman', text: 'aaj generator ke diesel pe 3 hazar kharch hue', draft: 'expense', lang: 'roman', mustNot: ['record', 'entry'] },
  // 50 x 1250 = 62,500. On device the model wrote "Rs 1,25,000" here, so the
  // reply must carry the app's figure or no figure at all, never its own sum.
  { id: 'material-roman', text: '50 bori cement 1250 wala Akram se liya', draft: 'material', lang: 'roman', mustNot: ['1,25,000', '125000', '\\b62,?500 ?x', '\\b1,?25,?000'] },
  { id: 'pay-worker-urdu', text: 'بلال کو دو ہزار دیے', draft: 'payWorker', lang: 'ur' },
  { id: 'attendance-roman', text: 'aaj sab mazdoor aaye', draft: 'attendance', lang: 'roman' },
  { id: 'transfer-en', text: 'moved 50 thousand from bank to cash', draft: 'transfer', lang: 'en' },
  // Clarification only when essential
  { id: 'add-worker-noname', text: 'worker add karo', asks: true, lang: 'roman' },
  { id: 'project-new', text: 'naya project banao', asks: true, lang: 'roman' },
  // Unknown name → did you mean
  // A name nobody has: the tool answers didYouMean, so the reply must ask, not guess.
  { id: 'unknown-worker', text: 'Shahbaz Butt ki hazri dikhao', tools: ['get_worker_attendance', 'list_names'], lang: 'roman', asks: true },
  // A near-miss spelling must be matched silently, not questioned.
  { id: 'fuzzy-worker', text: 'Zulfiqarr ki hazri dikhao', tools: ['get_worker_attendance'], lang: 'roman' },
  // Knowledge
  { id: 'how-settlement', text: 'settlement mein profit kaise divide hota hai', tools: ['explain_app'], lang: 'roman' },
  // Small talk: no tool, warm, short, no SUGGEST needed
  { id: 'greet-roman', text: 'salam, kaise ho', noTool: true, lang: 'roman' },
  { id: 'thanks-en', text: 'thanks, that helps', noTool: true, lang: 'en' },
  // Follow-up using history
  {
    id: 'followup-lastmonth',
    text: 'aur pichle mahine?',
    tools: ['get_spend_summary', 'get_expense_breakdown'],
    lang: 'roman',
    after: [{ user: 'is mahine kitna kharcha hua', assistant: 'Is mahine Rs 5,52,500 kharcha hua.', tools: ['get_spend_summary({"period":{"kind":"month"}}) → Rs 5,52,500 out'] }],
  },
  // Memory
  { id: 'remember', text: 'yaad rakho, main Gulberg site ka supervisor hoon', tools: ['remember_fact'], lang: 'roman' },
  // Report
  { id: 'details-en', text: 'tell me everything about Gulberg Greens G-508', tools: ['get_project_details'], lang: 'en' },
];

export interface EvalResult {
  id: string;
  passed: boolean;
  /** What went wrong, or a short excerpt of the reply. */
  detail: string;
  ms: number;
  calls: number;
}

export interface EvalDeps extends Omit<AgentDeps, 'history' | 'prompt'> {
  world: World;
  /** Called after every case (for a progress bar). */
  onCase?: (r: EvalResult, index: number, total: number) => void;
  /** Pause between cases (free tiers meter tokens per minute). */
  pauseMs?: number;
  /** Run a subset. */
  only?: string[];
}

/**
 * Grade the language of a REPLY. Script is judged by weight (a Roman Urdu
 * answer that quotes the user's Urdu is still Roman Urdu), and only once the
 * script is Latin do the word lists decide Roman Urdu vs English.
 */
function replyLanguage(text: string): ReplyLanguage | null {
  const script = dominantScript(text);
  if (script === null) return null;
  if (script === 'arabic') return 'ur';
  // Latin script with more than a quoted word of Urdu in it: the reply drifted.
  if (arabicShare(text) > 0.15) return null;
  const guess = detectLanguage(text.replace(/[\u0600-\u06FF\u0750-\u077F]+/g, ' '));
  return guess.language === 'ur' ? null : guess.language;
}

/** A question mark, a choice list, or an imperative ask ("naam batao", "tell me"). */
const ASKS = /[?؟]|\b(batao|bataiye|bata dein|batayen|likho|chahiye|kaunsa|konsa|kis |kitn|tell me|give me|let me know|which|what|need)\b|بتائ|بتا|کون|کتن/i;

/** Judge one reply against its case. */
export function judge(c: EvalCase, r: AgentResult): { passed: boolean; detail: string } {
  const problems: string[] = [];
  const ran = r.toolLog.map((l) => l.split('(')[0]);
  const draftKinds = r.drafts.map((d) => d.draft.kind as string);
  if (c.tools && !c.tools.some((t) => ran.includes(t)) && !(c.tools.includes('remember_fact') && r.learned.length > 0)) problems.push(`tools ran: ${ran.join(', ') || 'none'}; expected one of ${c.tools.join(' / ')}`);
  if (c.noTool && (ran.length > 0 || draftKinds.length > 0)) problems.push(`unexpected tool: ${[...ran, ...draftKinds].join(', ')}`);
  if (c.draft && !draftKinds.includes(c.draft)) problems.push(`drafts: ${draftKinds.join(', ') || 'none'}; expected ${c.draft}`);
  if (c.asks && !ASKS.test(r.text) && r.options.length === 0) problems.push('expected a question');
  if (!r.text && r.drafts.length === 0 && !r.open) problems.push('empty reply');
  if (c.lang && r.text) {
    const got = replyLanguage(r.text);
    // Short confirmations full of names can be undetectable; only a clear mismatch fails.
    if (got && got !== c.lang) problems.push(`language ${got}, expected ${c.lang}`);
  }
  for (const m of c.must ?? []) if (!new RegExp(m, 'i').test(r.text)) problems.push(`missing /${m}/`);
  const bans = [...BANNED, ...(r.drafts.length ? BANNED_ON_WRITE : []), ...(c.mustNot ?? [])];
  for (const m of bans) if (new RegExp(m, 'im').test(r.text)) problems.push(`banned /${m}/`);
  return problems.length ? { passed: false, detail: `${problems.join('; ')} | "${r.text.slice(0, 120)}"` } : { passed: true, detail: r.text.slice(0, 140) || `[${draftKinds.join(', ') || r.open}]` };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run every case (or `only`), pacing for rate limits; never throws. */
export async function runEvals(deps: EvalDeps): Promise<EvalResult[]> {
  const cases = deps.only?.length ? EVAL_CASES.filter((c) => deps.only!.includes(c.id)) : EVAL_CASES;
  const out: EvalResult[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const started = Date.now();
    let result: EvalResult;
    const history = (c.after ?? []).flatMap((e) => [
      { role: 'user' as const, content: e.user },
      { role: 'assistant' as const, content: `${e.assistant}${e.tools?.length ? ` [ran: ${e.tools.join('; ')}]` : ''}` },
    ]);
    const language = decideReplyLanguage({ text: c.text, setting: 'auto', appLanguage: deps.world.language, recent: [] });
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await runAgent(c.text, { ...deps, history, prompt: { language } });
        const j = judge(c, r);
        result = { id: c.id, ...j, ms: Date.now() - started, calls: r.calls };
        break;
      } catch (e) {
        // A rate limit or a flaky connection is not a model failure: wait and retry.
        const code = isAiError(e) ? e.code : 'failed';
        if (attempt < 2 && (code === 'quota' || code === 'offline' || code === 'timeout' || /fetch failed|network/i.test(String(e)))) {
          await sleep(code === 'quota' ? 25_000 : 5_000);
          continue;
        }
        result = { id: c.id, passed: false, detail: `error: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`, ms: Date.now() - started, calls: 0 };
        break;
      }
    }
    out.push(result);
    deps.onCase?.(result, i, cases.length);
    if (i < cases.length - 1) await sleep(deps.pauseMs ?? 4_000);
  }
  return out;
}
