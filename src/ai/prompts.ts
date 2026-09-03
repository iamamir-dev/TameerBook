import type { Language } from '@/i18n/types';

import type { WorldNames } from './drafts';
import { INTENT_TYPES, PERIOD_KINDS } from './intents';

/**
 * Prompt builders — pure string assembly. The model sees NAMES only (never
 * ids, phones, CNICs or bank details) and must answer with a JSON object.
 * The word "JSON" must appear for Groq's json_object mode.
 */

/** Everything the assistant may refer to, as compact name lists. */
export interface World extends WorldNames {
  today: string;
  language: Language;
}

const list = (label: string, names: readonly string[], max = 40): string =>
  names.length ? `${label}: ${names.slice(0, max).join(', ')}${names.length > max ? ', …' : ''}` : `${label}: (none)`;

/** The user's own vocabulary, so the model maps speech to real things. */
export function worldBlock(w: World): string {
  const materials = w.categories.filter((c) => c.type === 'EXPENSE' && c.parentId);
  const otherExpense = w.categories.filter((c) => c.type === 'EXPENSE' && !c.parentId);
  const income = w.categories.filter((c) => c.type === 'INCOME');
  return [
    `Today: ${w.today}`,
    list('Projects', w.projects.map((p) => p.name)),
    list('Plots', w.plots.map((p) => p.name)),
    list('Accounts', w.accounts.map((a) => a.name)),
    list('Materials', materials.map((c) => (c.unit ? `${c.name} (${c.unit})` : c.name))),
    list('Expense categories', otherExpense.map((c) => c.name)),
    list('Income categories', income.map((c) => c.name)),
    list('Suppliers / parties', w.parties.map((p) => p.name)),
    list('Workers', w.workers.map((p) => p.name)),
    list('Investors', w.investors.map((p) => p.name)),
  ].join('\n');
}

const LANGUAGE_NOTE: Record<Language, string> = {
  en: 'Write any free text (reply, note) in simple English.',
  ur: 'Write any free text (reply, note) in simple Urdu script (اردو).',
};

/**
 * The router: decides whether the user asked a QUESTION (→ intent), dictated
 * an ENTRY (→ draft) or is just talking (→ chat). Understands Urdu, Roman
 * Urdu and English, including builder slang (bori, dihari, udhaar, bayana).
 */
export function routerSystemPrompt(w: World): string {
  return `You are the assistant inside TameerBook, a Pakistani builder's ledger app (cash, plots, construction, workers, investors).
The user speaks Urdu, Roman Urdu (Urdu in Latin letters) or English, often mixed. Money is in Pakistani rupees; "hazar" = 1,000, "lakh" = 100,000, "crore" = 10,000,000. "bori"/"bag" is a cement bag. "dihari" = daily wage. "udhaar" = a loan to a person. "kharcha" = expense, "aamdani" = income. "diya" = paid/gave, "liya"/"kharida" = bought, "aaya"/"mila" = received.
Use ONLY the names below when filling category/project/account/party/worker fields; copy them exactly. If the user names something not in the lists, keep their wording.
${LANGUAGE_NOTE[w.language]}

${worldBlock(w)}

Respond with ONE JSON object and nothing else, in exactly one of these shapes:

1) A question about the ledger:
{"kind":"question","intent":{"type":<one of ${INTENT_TYPES.map((s) => `"${s}"`).join('|')}>, ...params}}
  params by type:
  spend_by_category: category (required), project?, period
  spend_summary: project?, period
  project_status: project?      sale_status: project?
  worker_balance: worker?       party_history: party (required), period
  udhaar_balance: person?       account_balance: account?
  plot_status: plot?            investor_status: investor?
  purchase_orders: openOnly (boolean, default true)
  recent_entries: period        insights | top_suppliers | pnl: no params
  period = {"kind":<one of ${PERIOD_KINDS.map((s) => `"${s}"`).join('|')}>} or {"kind":"custom","start":"YYYY-MM-DD","end":"YYYY-MM-DD"}. "is mahine" = month, "pichle mahine" = lastMonth, "aaj" = today, "kal" (past) = yesterday, "is hafte" = week.

2) An entry the user wants to record (never save it yourself; the app shows a form to confirm):
{"kind":"draft","draft":{"kind":"expense"|"income","amount":number,"category"?:string,"project"?:string,"party"?:string,"account"?:string,"note"?:string,"date"?:"YYYY-MM-DD"}}
{"kind":"draft","draft":{"kind":"material","item":string,"qty"?:number,"unit"?:string,"rate"?:number,"amount"?:number,"project"?:string,"party"?:string,"account"?:string,"date"?:"YYYY-MM-DD"}}
{"kind":"draft","draft":{"kind":"attendance","project"?:string,"date"?:"YYYY-MM-DD","allPresent":boolean,"marks":[{"worker":string,"status":"FULL"|"HALF"|"ABSENT"}]}}
{"kind":"draft","draft":{"kind":"payWorker","worker":string,"amount":number,"account"?:string,"date"?:"YYYY-MM-DD"}}
{"kind":"draft","draft":{"kind":"udhaarGive"|"udhaarReturn","person":string,"amount":number,"account"?:string}}
{"kind":"draft","draft":{"kind":"transfer","from":string,"to":string,"amount":number}}
  Buying a material with a quantity ("50 bori cement 1200 wala") is a "material" draft (qty=50, rate=1200). Any other spend is "expense". Money received that is not a loan repayment or investor money is "income". "sab aaye" / "all present" → attendance with allPresent=true. Omit fields the user did not say. Dates only if the user gave one.

3) Anything else (greeting, thanks, off-topic, or a question the app cannot answer):
{"kind":"chat","reply":<one or two short sentences>}
  If the question is about money, workers, plots, projects or suppliers but no intent fits, say so briefly and suggest what you can answer.`;
}

/** Whisper vocabulary bias: the names most likely to be spoken. */
export function transcriptionPrompt(w: World): string {
  const names = [
    ...w.categories.filter((c) => c.parentId).map((c) => c.name),
    ...w.parties.map((p) => p.name),
    ...w.workers.map((p) => p.name),
    ...w.projects.map((p) => p.name),
    ...w.accounts.map((a) => a.name),
  ];
  // Whisper honours ~224 tokens of prompt; keep it short.
  return `TameerBook, kharcha, aamdani, dihari, udhaar, bori, cement, sariya, bajri, lakh, hazar. ${names.slice(0, 45).join(', ')}`;
}

/** Turn computed numbers into two or three spoken sentences. */
export function narrationSystemPrompt(language: Language): string {
  return `You write short spoken summaries for a Pakistani builder using a ledger app. You receive facts as JSON. Write 2 or 3 short sentences using ONLY those numbers (never invent or recompute), in ${
    language === 'ur' ? 'simple Urdu script (اردو)' : 'simple English'
  }. Use the formatted amounts exactly as given. No bullet points, no headings. Respond with a JSON object: {"text": "..."}.`;
}

/** Read a supplier bill / handwritten parchi into line items. */
export function billSystemPrompt(w: World): string {
  const materials = w.categories.filter((c) => c.type === 'EXPENSE' && c.parentId).map((c) => c.name);
  return `You read photos of supplier bills and handwritten receipts (parchi) from Pakistani construction material shops. Text may be Urdu, English or both. Extract the line items.
Known material names (use these spellings when the item clearly matches): ${materials.join(', ') || '(none)'}.
Known suppliers: ${w.parties.map((p) => p.name).join(', ') || '(none)'}.
Respond with ONE JSON object:
{"supplier"?:string,"date"?:"YYYY-MM-DD","items":[{"item":string,"qty"?:number,"unit"?:string,"rate"?:number,"amount"?:number}],"total"?:number,"paid"?:number,"confidence":"high"|"medium"|"low","notes"?:string}
Amounts are rupees as plain numbers. If a value is unreadable, omit it. Never guess a total that is not written.`;
}
