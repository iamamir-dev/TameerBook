import { coerceDraft, type Draft } from './drafts';
import { coerceIntent, ENTITY_FILTERS, ENTITY_KINDS, OPEN_SCREENS, PERIOD_KINDS, PO_STATUS_FILTERS, REPORT_KINDS, type Intent, type OpenScreen } from './intents';
import type { Answer } from './runner';
import type { ToolCall, ToolSpec } from './types';

/**
 * THE TOOL CATALOGUE — what the model can do, as function-calling specs.
 *
 *   read tools   → run against the repositories, results go back to the model
 *                  so it can write an exact answer (and the app shows a card)
 *   write tools  → become a Draft; the app shows a confirmation sheet and only
 *                  saves after the user taps Save. The model never writes.
 *   open_screen  → navigation, only when the user asks to open a screen
 *
 * Pure: no store, no native modules — unit-tested.
 */

const period = {
  type: 'object',
  description: 'Time window. "is mahine" = month, "pichle mahine" = lastMonth, "aaj" = today, "kal" (past) = yesterday, "is hafte" = week.',
  properties: {
    kind: { type: 'string', enum: [...PERIOD_KINDS, 'custom'] },
    start: { type: 'string', description: 'YYYY-MM-DD (custom only)' },
    end: { type: 'string', description: 'YYYY-MM-DD (custom only)' },
  },
  required: ['kind'],
};
const str = (description: string) => ({ type: 'string', description });
const num = (description: string) => ({ type: 'number', description });
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required });

/** Read tools: name → intent type. */
const READ_TOOLS: { name: string; intent: Intent['type']; description: string; parameters: Record<string, unknown> }[] = [
  {
    name: 'get_spend_by_category',
    intent: 'spend_by_category',
    description: 'Total spent on ONE category/material (amount + quantity) in a period, optionally for one project. "is mahine kitna cement liya".',
    parameters: obj({ category: str('Category or material name from the lists'), project: str('Project name'), period }, ['category']),
  },
  {
    name: 'get_spend_summary',
    intent: 'spend_summary',
    description: 'Money in vs money out for a period, optionally one project. "is mahine kitna kharcha hua".',
    parameters: obj({ project: str('Project name'), period }),
  },
  {
    name: 'get_expense_breakdown',
    intent: 'expense_breakdown',
    description: 'Spend split by category with a bar chart. "kharcha kis cheez pe hua", "where did the money go".',
    parameters: obj({ project: str('Project name'), period }),
  },
  {
    name: 'get_cashflow_chart',
    intent: 'cashflow_chart',
    description: 'Monthly money in vs out as a chart. "cash flow dikhao", "trend".',
    parameters: obj({ months: num('How many months back (2-12), default 6') }),
  },
  {
    name: 'get_project_status',
    intent: 'project_status',
    description: 'Cost so far, sale price, received and profit for one project (or all active when no name).',
    parameters: obj({ project: str('Project name') }),
  },
  {
    name: 'get_sale_status',
    intent: 'sale_status',
    description: 'Buyer side of a project: agreed price, received, outstanding.',
    parameters: obj({ project: str('Project name') }, ['project']),
  },
  {
    name: 'get_worker_balance',
    intent: 'worker_balance',
    description: 'What a worker is owed (with history), or every worker with a balance when no name.',
    parameters: obj({ worker: str('Worker name') }),
  },
  {
    name: 'get_party_history',
    intent: 'party_history',
    description: 'Payments to/from one supplier or contact in a period.',
    parameters: obj({ party: str('Supplier / contact name'), period }, ['party']),
  },
  {
    name: 'get_loan_balance',
    intent: 'udhaar_balance',
    description: 'Udhaar (loans): what a person owes / we owe, or all open loans when no name.',
    parameters: obj({ person: str('Person name') }),
  },
  {
    name: 'get_account_balance',
    intent: 'account_balance',
    description: 'Balance of one account, or all accounts when no name. "cash kitna hai".',
    parameters: obj({ account: str('Account name') }),
  },
  {
    name: 'get_plot_status',
    intent: 'plot_status',
    description: 'Deal price, paid to seller, remaining, expenses for one plot (or all held plots).',
    parameters: obj({ plot: str('Plot name') }),
  },
  {
    name: 'get_investor_status',
    intent: 'investor_status',
    description: 'Invested, profit, paid out, total for one investor (or all).',
    parameters: obj({ investor: str('Investor name') }),
  },
  {
    name: 'get_purchase_orders',
    intent: 'purchase_orders',
    description:
      'Purchase orders filtered by status. Pick the NARROWEST: "pending" = material not delivered yet, "delivered" = all received, "unpaid" = money owed, "open" = anything unfinished, "all".',
    parameters: obj({ status: { type: 'string', enum: [...PO_STATUS_FILTERS] } }, ['status']),
  },
  {
    name: 'list_names',
    intent: 'list_entities',
    description: 'NAMES ONLY (no money) of projects / plots / workers / suppliers / investors / accounts / materials, with an optional subset filter.',
    parameters: obj(
      {
        entity: { type: 'string', enum: [...ENTITY_KINDS] },
        filter: { type: 'string', enum: [...ENTITY_FILTERS], description: 'projects: active|completed · plots: owned|sold · workers: owed · else all' },
      },
      ['entity']
    ),
  },
  { name: 'get_company_overview', intent: 'company_overview', description: 'The whole business at a glance: cash, assets, projects, plots, dues.', parameters: obj({}) },
  { name: 'get_attention_items', intent: 'insights', description: 'What needs attention today: overdue wages, deadlines, duplicates, odd rates.', parameters: obj({}) },
  { name: 'get_recent_entries', intent: 'recent_entries', description: 'Recent transactions in a period.', parameters: obj({ period }) },
  { name: 'get_top_suppliers', intent: 'top_suppliers', description: 'Suppliers ranked by total paid.', parameters: obj({}) },
  { name: 'get_profit_loss', intent: 'pnl', description: 'Profit / loss per project.', parameters: obj({}) },
  {
    name: 'open_report',
    intent: 'report',
    description: 'Open one of the PDF reports (the user asked for a report / PDF / statement / printout).',
    parameters: obj({ report: { type: 'string', enum: [...REPORT_KINDS] }, project: str('Project name (report = project)') }, ['report']),
  },
];

/** Write tools: name → draft kind. Arguments mirror the Draft shapes. */
const WRITE_TOOLS: { name: string; kind: Draft['kind']; description: string; parameters: Record<string, unknown> }[] = [
  {
    name: 'record_expense',
    kind: 'expense',
    description: 'Money paid out (not a material purchase with quantity). Amount may be missing — the app asks.',
    parameters: obj({ amount: num('Rupees'), category: str('Expense category from the lists'), party: str('Who was paid'), project: str('Project'), account: str('Account paid from'), note: str('Short note'), date: str('YYYY-MM-DD only if the user said a date') }),
  },
  {
    name: 'record_income',
    kind: 'income',
    description: 'Money received that is NOT an investor payment, buyer payment or loan return.',
    parameters: obj({ amount: num('Rupees'), category: str('Income category'), party: str('Who paid'), project: str('Project'), account: str('Account received into'), note: str('Short note'), date: str('YYYY-MM-DD') }),
  },
  {
    name: 'record_material',
    kind: 'material',
    description: 'Material bought with a quantity: "50 bori cement 1200 wala Akram se". qty=50, rate=1200.',
    parameters: obj({ item: str('Material name'), qty: num('Quantity'), unit: str('bori / kg / ft…'), rate: num('Rate per unit'), amount: num('Total if stated'), party: str('Supplier'), project: str('Project'), account: str('Account'), date: str('YYYY-MM-DD') }, ['item']),
  },
  {
    name: 'mark_attendance',
    kind: 'attendance',
    description: 'Daily attendance. "sab aaye" → allPresent=true; per-worker marks FULL / HALF (aadha) / ABSENT (chutti).',
    parameters: obj({
      project: str('Project'),
      date: str('YYYY-MM-DD'),
      allPresent: { type: 'boolean' },
      marks: { type: 'array', items: obj({ worker: str('Worker name'), status: { type: 'string', enum: ['FULL', 'HALF', 'ABSENT'] } }, ['worker', 'status']) },
    }),
  },
  {
    name: 'pay_worker',
    kind: 'payWorker',
    description: 'Pay a worker wages. "Bilal ko 2000 diye" when Bilal is a worker.',
    parameters: obj({ worker: str('Worker name'), amount: num('Rupees'), account: str('Account'), date: str('YYYY-MM-DD'), note: str('Note') }, ['worker']),
  },
  {
    name: 'give_loan',
    kind: 'udhaarGive',
    description: 'Lend money to a person (udhaar diya).',
    parameters: obj({ person: str('Person'), amount: num('Rupees'), account: str('Account'), date: str('YYYY-MM-DD') }, ['person']),
  },
  {
    name: 'receive_loan_return',
    kind: 'udhaarReturn',
    description: 'A person returned loaned money (udhaar wapas).',
    parameters: obj({ person: str('Person'), amount: num('Rupees'), account: str('Account'), date: str('YYYY-MM-DD') }, ['person']),
  },
  {
    name: 'transfer_money',
    kind: 'transfer',
    description: 'Move money between two of the user\'s accounts. "HBL se cash mein 50 hazar nikale".',
    parameters: obj({ from: str('From account'), to: str('To account'), amount: num('Rupees'), date: str('YYYY-MM-DD') }, ['from', 'to']),
  },
  {
    name: 'add_worker',
    kind: 'createWorker',
    description: 'Add a new worker (mazdoor). Optional daily wage + project attaches him.',
    parameters: obj({ name: str('Worker name'), phone: str('Phone'), wage: num('Daily wage'), project: str('Project') }, ['name']),
  },
  {
    name: 'add_contact',
    kind: 'createParty',
    description: 'Add a supplier / buyer / seller / contractor / dealer.',
    parameters: obj({ name: str('Name'), partyType: { type: 'string', enum: ['SUPPLIER', 'BUYER', 'SELLER', 'CONTRACTOR', 'DEALER'] }, phone: str('Phone') }, ['name']),
  },
  { name: 'add_investor', kind: 'createInvestor', description: 'Add an investor.', parameters: obj({ name: str('Name'), phone: str('Phone'), amount: num('Pledged amount') }, ['name']) },
  {
    name: 'add_account',
    kind: 'createAccount',
    description: 'Add a bank / cash / wallet account.',
    parameters: obj({ name: str('Account name'), accountType: { type: 'string', enum: ['BANK', 'CASH', 'WALLET'] }, openingBalance: num('Opening balance') }, ['name']),
  },
  {
    name: 'add_plot',
    kind: 'createPlot',
    description: 'Record a plot purchase.',
    parameters: obj({ name: str('Plot name'), society: str('Society'), plotNo: str('Plot number'), dealPrice: num('Agreed price'), seller: str('Seller name') }),
  },
  { name: 'add_project', kind: 'createProject', description: 'Create a project, optionally on a plot.', parameters: obj({ name: str('Project name'), plot: str('Plot name') }, ['name']) },
];

const OPEN_TOOL: ToolSpec = {
  name: 'open_screen',
  description:
    'Open an app screen. ONLY when the user explicitly asks to open / show a page, or wants to add something but gave no details at all. Never instead of a record_* / add_* tool.',
  parameters: obj({ screen: { type: 'string', enum: [...OPEN_SCREENS] } }, ['screen']),
};

/** All tools, in the shape every transport accepts. */
export const TOOLS: ToolSpec[] = [
  ...READ_TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters })),
  ...WRITE_TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters })),
  OPEN_TOOL,
];

export type ToolAction =
  | { kind: 'read'; intent: Intent }
  | { kind: 'write'; draft: Draft }
  | { kind: 'open'; screen: OpenScreen }
  | { kind: 'invalid'; reason: string };

/** Validate a model tool call into something the app can run. */
export function interpretToolCall(call: ToolCall): ToolAction {
  const read = READ_TOOLS.find((t) => t.name === call.name);
  if (read) {
    const intent = coerceIntent({ ...call.args, type: read.intent });
    return intent ? { kind: 'read', intent } : { kind: 'invalid', reason: `Missing or invalid arguments for ${call.name}.` };
  }
  const write = WRITE_TOOLS.find((t) => t.name === call.name);
  if (write) {
    const draft = coerceDraft({ ...call.args, kind: write.kind });
    return draft ? { kind: 'write', draft } : { kind: 'invalid', reason: `Missing required details for ${call.name} (e.g. a name).` };
  }
  if (call.name === OPEN_TOOL.name) {
    const screen = typeof call.args.screen === 'string' ? call.args.screen : '';
    return (OPEN_SCREENS as readonly string[]).includes(screen)
      ? { kind: 'open', screen: screen as OpenScreen }
      : { kind: 'invalid', reason: `Unknown screen. Use one of: ${OPEN_SCREENS.join(', ')}.` };
  }
  return { kind: 'invalid', reason: `Unknown tool ${call.name}.` };
}

/**
 * What the model sees after a read tool ran: the answer's numbers as compact
 * JSON (title, headline, sub, up to 12 rows) so it can write an exact reply
 * without inventing anything. Cards render the full data in the UI.
 */
export function summarizeAnswerForModel(a: Answer): string {
  const rows: unknown[] = a.list
    ? a.list.slice(0, 12).map((r) => ({ title: r.title, note: r.subtitle }))
    : a.rows.slice(0, 12).map((r) => ({ title: r.title, note: r.subtitle || r.date || undefined, amount: r.amount, direction: r.direction }));
  const total = (a.list ?? a.rows).length;
  return JSON.stringify({ title: a.title, headline: a.headline, sub: a.sub, count: total, rows, more: Math.max(0, total - rows.length) });
}
