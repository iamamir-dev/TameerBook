import { coerceDraft, type Draft } from './drafts';
import { coerceIntent, ENTITY_FILTERS, ENTITY_KINDS, OPEN_SCREENS, PERIOD_KINDS, PO_STATUS_FILTERS, REPORT_KINDS, type Intent, type OpenScreen } from './intents';
import { KNOWLEDGE_TOPICS, explainTopic } from './knowledge';
import type { Answer } from './runner';
import type { ToolCall, ToolSpec } from './types';

/**
 * THE TOOL CATALOGUE — what the model can do, as function-calling specs.
 *
 *   read tools    → run against the repositories, results go back to the model
 *                   so it can write an exact answer (and the app shows a card)
 *   write tools   → become a Draft; the app shows a confirmation card and only
 *                   saves after the user taps Accept. The model never writes.
 *   explain_app   → module knowledge handed back to the model
 *   remember_fact → a lasting fact about the user, kept across chats
 *   open_screen   → navigation, only when the user asks to open a screen
 *
 * Descriptions are short on purpose: every schema rides in every model call.
 * Judgement (when to call what) lives in the system prompt. Pure; unit-tested.
 */

const str = (description: string) => ({ type: 'string', description });
const STR = { type: 'string' } as const;
const NUM = { type: 'number' } as const;
const num = (description: string) => ({ type: 'number', description });
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required });

const period = {
  type: 'object',
  description: 'is mahine = month, pichle mahine = lastMonth, kal (past) = yesterday',
  properties: { kind: { type: 'string', enum: [...PERIOD_KINDS, 'custom'] }, start: str('YYYY-MM-DD, custom'), end: STR },
  required: ['kind'],
};
const DATE = str('YYYY-MM-DD');
const ACCOUNT = STR;
const PROJECT = STR;
const RS = NUM;

/** Read tools: name → intent type. */
const READ_TOOLS: { name: string; intent: Intent['type']; description: string; parameters: Record<string, unknown> }[] = [
  {
    name: 'get_spend_by_category',
    intent: 'spend_by_category',
    description: 'Total spent on ONE category or material (amount + quantity) in a period, optionally one project.',
    parameters: obj({ category: STR, project: PROJECT, period }, ['category']),
  },
  {
    name: 'get_spend_summary',
    intent: 'spend_summary',
    description: 'Money in vs money out for a period, optionally one project ("is mahine kitna kharcha hua").',
    parameters: obj({ project: PROJECT, period }),
  },
  {
    name: 'get_expense_breakdown',
    intent: 'expense_breakdown',
    description: 'Spend split by category, with a bar chart ("kharcha kis cheez pe hua").',
    parameters: obj({ project: PROJECT, period }),
  },
  {
    name: 'get_cashflow_chart',
    intent: 'cashflow_chart',
    description: 'Monthly money in vs out as a chart (cash flow, trend).',
    parameters: obj({ months: num('Months back, 2-12, default 6') }),
  },
  {
    name: 'get_project_status',
    intent: 'project_status',
    description: 'Cost so far, sale price, received and profit for one project, or all active when no name.',
    parameters: obj({ project: PROJECT }),
  },
  {
    name: 'get_project_details',
    intent: 'project_details',
    description: 'FULL REPORT on one project: cost split, top categories this month, sale + buyer balance, investors, workers, orders, attention items.',
    parameters: obj({ project: PROJECT }, ['project']),
  },
  {
    name: 'get_sale_status',
    intent: 'sale_status',
    description: 'Buyer side of a project: agreed price, received, still to come.',
    parameters: obj({ project: PROJECT }, ['project']),
  },
  {
    name: 'get_worker_balance',
    intent: 'worker_balance',
    description: 'What a worker is still to be paid (with history), or every worker with a balance when no name.',
    parameters: obj({ worker: STR }),
  },
  {
    name: 'get_worker_attendance',
    intent: 'worker_attendance',
    description: 'One worker\'s attendance (hazri) for a month, shown as a calendar.',
    parameters: obj({ worker: STR, month: str('YYYY-MM; omit for this month') }, ['worker']),
  },
  {
    name: 'get_party_history',
    intent: 'party_history',
    description: 'Payments to or from one supplier / contact in a period.',
    parameters: obj({ party: STR, period }, ['party']),
  },
  {
    name: 'get_loan_balance',
    intent: 'udhaar_balance',
    description: 'Udhaar (loans): what a person owes us or we owe them, or all open loans when no name.',
    parameters: obj({ person: str('Person name') }),
  },
  {
    name: 'get_account_balance',
    intent: 'account_balance',
    description: 'Balance of one account, or all accounts when no name ("cash kitna hai").',
    parameters: obj({ account: ACCOUNT }),
  },
  {
    name: 'get_plot_status',
    intent: 'plot_status',
    description: 'Deal price, paid to seller, remaining and expenses for one plot, or all held plots.',
    parameters: obj({ plot: STR }),
  },
  {
    name: 'get_investor_status',
    intent: 'investor_status',
    description: 'Invested, profit, paid out and total for one investor, or all.',
    parameters: obj({ investor: STR }),
  },
  {
    name: 'get_purchase_orders',
    intent: 'purchase_orders',
    description: 'Purchase orders by status. Narrowest wins: pending = not delivered, delivered = all received, unpaid = money still to pay, open = anything unfinished, all.',
    parameters: obj({ status: { type: 'string', enum: [...PO_STATUS_FILTERS] } }, ['status']),
  },
  {
    name: 'list_names',
    intent: 'list_entities',
    description: 'NAMES ONLY (no money) of projects / plots / workers / suppliers / investors / accounts / materials, with an optional subset.',
    parameters: obj(
      {
        entity: { type: 'string', enum: [...ENTITY_KINDS] },
        filter: { type: 'string', enum: [...ENTITY_FILTERS], description: 'projects: active | completed · plots: owned (free) | sold · workers: owed · else all' },
      },
      ['entity']
    ),
  },
  { name: 'get_company_overview', intent: 'company_overview', description: 'The whole business at a glance: cash, assets, projects, plots, dues.', parameters: obj({}) },
  { name: 'get_attention_items', intent: 'insights', description: 'What needs attention today: unpaid wages, deadlines, duplicates, odd rates.', parameters: obj({}) },
  { name: 'get_recent_entries', intent: 'recent_entries', description: 'Recent transactions in a period.', parameters: obj({ period }) },
  { name: 'get_top_suppliers', intent: 'top_suppliers', description: 'Suppliers ranked by total paid.', parameters: obj({}) },
  { name: 'get_profit_loss', intent: 'pnl', description: 'Profit / loss per project.', parameters: obj({}) },
  {
    name: 'open_report',
    intent: 'report',
    description: 'Open a PDF report (the user asked for a report / PDF / statement / printout).',
    parameters: obj({ report: { type: 'string', enum: [...REPORT_KINDS] }, project: str('Project name (report = project)') }, ['report']),
  },
];

/** Write tools: name → draft kind. Arguments mirror the Draft shapes. */
const WRITE_TOOLS: { name: string; kind: Draft['kind']; description: string; parameters: Record<string, unknown> }[] = [
  {
    name: 'record_expense',
    kind: 'expense',
    description: 'Money paid out that is not a material purchase with quantity. Amount may be missing (the app asks).',
    parameters: obj({ amount: RS, category: STR, party: STR, project: PROJECT, account: ACCOUNT, note: str('What it was for, in the user\'s words'), date: DATE }),
  },
  {
    name: 'record_income',
    kind: 'income',
    description: 'Money received that is NOT from an investor, a buyer or a loan return.',
    parameters: obj({ amount: RS, category: STR, party: STR, project: PROJECT, account: ACCOUNT, note: str('What it was for, in the user\'s words'), date: DATE }),
  },
  {
    name: 'record_material',
    kind: 'material',
    description: 'Material bought with a quantity ("50 bori cement 1200 wala Akram se": qty 50, rate 1200).',
    parameters: obj({ item: STR, qty: NUM, unit: str('bori / kg / ft…'), rate: NUM, amount: NUM, party: STR, project: PROJECT, account: ACCOUNT, date: DATE }, ['item']),
  },
  {
    name: 'mark_attendance',
    kind: 'attendance',
    description: 'Daily attendance. "sab aaye" → allPresent true; per worker FULL / HALF (aadha) / ABSENT (chutti).',
    parameters: obj({
      project: PROJECT,
      date: DATE,
      allPresent: { type: 'boolean' },
      marks: { type: 'array', items: obj({ worker: STR, status: { type: 'string', enum: ['FULL', 'HALF', 'ABSENT'] } }, ['worker', 'status']) },
    }),
  },
  {
    name: 'pay_worker',
    kind: 'payWorker',
    description: 'Pay a worker wages ("Bilal ko 2000 diye" when Bilal is a worker).',
    parameters: obj({ worker: STR, amount: RS, account: ACCOUNT, date: DATE, note: STR }, ['worker']),
  },
  {
    name: 'give_loan',
    kind: 'udhaarGive',
    description: 'Lend money to a person (udhaar diya).',
    parameters: obj({ person: STR, amount: RS, account: ACCOUNT, date: DATE }, ['person']),
  },
  {
    name: 'receive_loan_return',
    kind: 'udhaarReturn',
    description: 'A person returned loaned money (udhaar wapas).',
    parameters: obj({ person: STR, amount: RS, account: ACCOUNT, date: DATE }, ['person']),
  },
  {
    name: 'transfer_money',
    kind: 'transfer',
    description: 'Move money between two of the user\'s own accounts ("HBL se cash mein 50 hazar nikale").',
    parameters: obj({ from: STR, to: STR, amount: RS, date: DATE }, ['from', 'to']),
  },
  {
    name: 'add_worker',
    kind: 'createWorker',
    description: 'Add a new worker (mazdoor); optional daily wage + project attaches them.',
    parameters: obj({ name: STR, phone: STR, wage: NUM, project: PROJECT }),
  },
  {
    name: 'add_contact',
    kind: 'createParty',
    description: 'Add a supplier / buyer / seller / contractor / dealer.',
    parameters: obj({ name: STR, partyType: { type: 'string', enum: ['SUPPLIER', 'BUYER', 'SELLER', 'CONTRACTOR', 'DEALER'] }, phone: STR }),
  },
  { name: 'add_investor', kind: 'createInvestor', description: 'Add an investor.', parameters: obj({ name: STR, phone: STR, amount: NUM }) },
  {
    name: 'add_account',
    kind: 'createAccount',
    description: 'Add a bank / cash / wallet account.',
    parameters: obj({ name: str('Account name'), accountType: { type: 'string', enum: ['BANK', 'CASH', 'WALLET'] }, openingBalance: NUM }),
  },
  {
    name: 'add_plot',
    kind: 'createPlot',
    description: 'Record a plot purchase.',
    parameters: obj({ name: STR, society: STR, plotNo: STR, dealPrice: NUM, seller: STR }),
  },
  {
    name: 'add_project',
    kind: 'createProject',
    description: 'Create a project on a FREE plot, optionally with investors. Ask for name / plot / investors first if missing.',
    parameters: obj({
      name: PROJECT,
      plot: str('A plot from "Plots (free)"'),
      investors: { type: 'array', items: obj({ name: STR, amount: NUM }, ['name']) },
    }),
  },
];

const payType = { type: 'string', enum: ['TOKEN', 'BAYANA', 'INSTALLMENT', 'FINAL'], description: 'token / bayana (advance) / instalment / final' };
WRITE_TOOLS.push(
  {
    name: 'create_purchase_order',
    kind: 'createPurchaseOrder',
    description: 'Book material from a supplier for a project (a PO with one or more lines; "PO banao", an unpaid bill).',
    parameters: obj({
      supplier: STR,
      project: PROJECT,
      items: { type: 'array', items: obj({ item: STR, qty: NUM, unit: STR, rate: NUM }, ['item', 'qty', 'rate']) },
    }, ['items']),
  },
  {
    name: 'receive_delivery',
    kind: 'receiveDelivery',
    description: 'Material of a purchase order arrived: all of it (all true) or one item + qty.',
    parameters: obj({ po: str('PO number (PO-0015) or supplier name'), item: STR, qty: NUM, all: { type: 'boolean' }, date: DATE }),
  },
  {
    name: 'pay_purchase_order',
    kind: 'payPurchaseOrder',
    description: 'Pay a supplier against a purchase order.',
    parameters: obj({ po: str('PO number or supplier name'), amount: RS, account: ACCOUNT, date: DATE }),
  },
  {
    name: 'pay_plot_seller',
    kind: 'plotPayment',
    description: 'Pay the SELLER of a plot toward the deal: token, bayana, instalment or final.',
    parameters: obj({ plot: STR, payType, amount: RS, account: ACCOUNT, date: DATE }),
  },
  {
    name: 'record_plot_expense',
    kind: 'plotExpense',
    description: 'A plot-side cost: transfer fee, tax, naqsha / approval, dealer commission on a plot.',
    parameters: obj({ plot: STR, category: STR, amount: RS, account: ACCOUNT, note: STR, date: DATE }),
  },
  {
    name: 'set_sale_deal',
    kind: 'setSale',
    description: 'A project is sold / agreed with a buyer: buyer name + agreed price.',
    parameters: obj({ project: PROJECT, buyer: STR, price: NUM }),
  },
  {
    name: 'record_buyer_payment',
    kind: 'saleReceipt',
    description: 'Money RECEIVED from the buyer of a project (token, bayana, instalment, final).',
    parameters: obj({ project: PROJECT, payType, amount: RS, account: STR, date: DATE }),
  },
  {
    name: 'record_sale_cost',
    kind: 'saleCost',
    description: 'A cost on the sale side of a project: dealer commission, buyer-side tax, paperwork.',
    parameters: obj({ project: PROJECT, note: STR, amount: RS, account: ACCOUNT, date: DATE }),
  },
  {
    name: 'record_investor_payment',
    kind: 'investorPayment',
    description: 'Money RECEIVED from an investor; with a project = staked into it, without = against the pledge.',
    parameters: obj({ investor: STR, project: PROJECT, amount: RS, account: STR, date: DATE }),
  },
  {
    name: 'mark_plot_transferred',
    kind: 'markTransferred',
    description: 'The plot transfer (registry) is complete.',
    parameters: obj({ plot: STR, date: DATE }),
  }
);

const EXPLAIN_TOOL: ToolSpec = {
  name: 'explain_app',
  description: 'Deep knowledge of one TameerBook module (rules, formulas, guards). Call before explaining how something works or why a number is what it is.',
  parameters: obj({ topic: { type: 'string', enum: [...KNOWLEDGE_TOPICS] } }, ['topic']),
};

const REMEMBER_TOOL: ToolSpec = {
  name: 'remember_fact',
  description: 'Keep a lasting fact about the user or their business for future chats (their role, a standing preference, what a name means). Not for numbers or one-off events.',
  parameters: obj({ fact: str('One short sentence, in English, ≤ 140 characters') }, ['fact']),
};

const OPEN_TOOL: ToolSpec = {
  name: 'open_screen',
  description: 'Navigate to an app screen, ONLY when the user literally asks to open / show a page. Never for adding or recording.',
  parameters: obj({ screen: { type: 'string', enum: [...OPEN_SCREENS] } }, ['screen']),
};

/** All tools, in the shape every transport accepts. */
export const TOOLS: ToolSpec[] = [
  ...READ_TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters })),
  ...WRITE_TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters })),
  EXPLAIN_TOOL,
  REMEMBER_TOOL,
  OPEN_TOOL,
];

export type ToolAction =
  | { kind: 'read'; intent: Intent }
  | { kind: 'write'; draft: Draft }
  | { kind: 'open'; screen: OpenScreen }
  /** Module knowledge handed straight back to the model (no card). */
  | { kind: 'knowledge'; text: string }
  /** A fact to keep in the user's memory. */
  | { kind: 'remember'; fact: string }
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
  if (call.name === EXPLAIN_TOOL.name) {
    const text = explainTopic(typeof call.args.topic === 'string' ? call.args.topic : '');
    return text ? { kind: 'knowledge', text } : { kind: 'invalid', reason: `Unknown topic. Use one of: ${KNOWLEDGE_TOPICS.join(', ')}.` };
  }
  if (call.name === REMEMBER_TOOL.name) {
    const fact = typeof call.args.fact === 'string' ? call.args.fact.trim() : '';
    return fact.length >= 3 ? { kind: 'remember', fact } : { kind: 'invalid', reason: 'remember_fact needs a short sentence.' };
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
  if (a.notFound) {
    return JSON.stringify({
      error: `No ${a.notFound.what} named "${a.notFound.query}".`,
      ...(a.notFound.candidates.length ? { didYouMean: a.notFound.candidates, note: 'Ask the user which one they meant, with an OPTIONS line listing these names exactly.' } : { note: 'Tell the user it is not saved and offer to add it.' }),
    });
  }
  const rows: unknown[] = a.list
    ? a.list.slice(0, 20).map((r) => ({ title: r.title, note: r.subtitle }))
    : a.rows.slice(0, 20).map((r) => ({ title: r.title, note: r.subtitle || r.date || undefined, amount: r.amount, direction: r.direction, ...(r.fields ?? {}) }));
  const total = (a.list ?? a.rows).length;
  const sections = a.sections?.map((sec) => ({
    title: sec.title,
    rows: sec.rows.slice(0, 12).map((r) => (r.fields ? { title: r.title, ...r.fields } : { title: r.title, note: r.subtitle || r.date || undefined, amount: r.amount, direction: r.direction })),
  }));
  // `cardRows` tells the model the UI also renders these rows as a card; the
  // text still lists the key ones with figures (see HOW TO WRITE).
  const showsCard = total > 0 || Boolean(a.chart) || Boolean(a.calendar);
  return JSON.stringify({
    title: a.title,
    headline: a.headline,
    sub: a.sub,
    count: total,
    ...(a.calendar ? { calendar: { month: a.calendar.month, full: a.calendar.full, half: a.calendar.half, absent: a.calendar.absent, note: 'The app shows this month as a calendar. Summarise in 1 to 2 sentences (days present, earned); do not list dates.' } } : {}),
    ...(showsCard ? { cardRows: total, note: 'The app also shows these rows as a card under your reply. List up to 8 of them in your text, one per line with the figure, then close with a question.' } : {}),
    rows,
    more: Math.max(0, total - rows.length),
    ...(sections ? { sections } : {}),
  });
}
