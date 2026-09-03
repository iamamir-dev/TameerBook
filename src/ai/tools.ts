import { coerceDraft, type Draft } from './drafts';
import { coerceIntent, ENTITY_FILTERS, ENTITY_KINDS, OPEN_SCREENS, PERIOD_KINDS, PO_STATUS_FILTERS, REPORT_KINDS, type Intent, type OpenScreen } from './intents';
import { KNOWLEDGE_TOPICS, explainTopic } from './knowledge';
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
    name: 'get_project_details',
    intent: 'project_details',
    description:
      'FULL REPORT on one project in one call: cost split (plot / construction / sale), top expense categories this month, sale + buyer outstanding, investors with ownership %, workers with wages owed, purchase orders, and what needs attention. Use for "details / sab kuch batao / full report / tell me about project X".',
    parameters: obj({ project: str('Project name') }, ['project']),
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
        filter: { type: 'string', enum: [...ENTITY_FILTERS], description: 'projects: active|completed · plots: owned (= free, not in any project) | sold · workers: owed · else all' },
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
    description: 'Add a new worker (mazdoor). Call it even with no name — the app asks. Optional daily wage + project attaches him.',
    parameters: obj({ name: str('Worker name'), phone: str('Phone'), wage: num('Daily wage'), project: str('Project') }),
  },
  {
    name: 'add_contact',
    kind: 'createParty',
    description: 'Add a supplier / buyer / seller / contractor / dealer.',
    parameters: obj({ name: str('Name'), partyType: { type: 'string', enum: ['SUPPLIER', 'BUYER', 'SELLER', 'CONTRACTOR', 'DEALER'] }, phone: str('Phone') }),
  },
  { name: 'add_investor', kind: 'createInvestor', description: 'Add an investor.', parameters: obj({ name: str('Name'), phone: str('Phone'), amount: num('Pledged amount') }) },
  {
    name: 'add_account',
    kind: 'createAccount',
    description: 'Add a bank / cash / wallet account.',
    parameters: obj({ name: str('Account name'), accountType: { type: 'string', enum: ['BANK', 'CASH', 'WALLET'] }, openingBalance: num('Opening balance') }),
  },
  {
    name: 'add_plot',
    kind: 'createPlot',
    description: 'Record a plot purchase.',
    parameters: obj({ name: str('Plot name'), society: str('Society'), plotNo: str('Plot number'), dealPrice: num('Agreed price'), seller: str('Seller name') }),
  },
  {
    name: 'add_project',
    kind: 'createProject',
    description: 'Create a project on a FREE plot, optionally with investors. Ask for name / plot / investors first if missing; then call with everything.',
    parameters: obj({
      name: str('Project name'),
      plot: str('A plot from "Plots (free)"'),
      investors: { type: 'array', description: 'Investors to attach with their stake', items: obj({ name: str('Investor name'), amount: num('Amount invested (rupees)') }, ['name']) },
    }),
  },
];

const payType = { type: 'string', enum: ['TOKEN', 'BAYANA', 'INSTALLMENT', 'FINAL'], description: 'token / bayana (advance) / instalment / final' };
WRITE_TOOLS.push(
  {
    name: 'create_purchase_order',
    kind: 'createPurchaseOrder',
    description: 'Book material from a supplier for a project (a PO with one or more lines). Use for "order 500 bricks from Rafiq", "PO banao", a bill photo with several lines that is an ORDER (not yet paid).',
    parameters: obj({
      supplier: str('Supplier name'),
      project: str('Project name'),
      items: { type: 'array', items: obj({ item: str('Material name'), qty: num('Quantity'), unit: str('Unit'), rate: num('Rate per unit') }, ['item', 'qty', 'rate']) },
    }, ['items']),
  },
  {
    name: 'receive_delivery',
    kind: 'receiveDelivery',
    description: 'Material of a purchase order arrived. "PO-0015 ka saman aa gaya" (all=true) or "500 bricks aa gaye Rafiq ke order mein" (item + qty).',
    parameters: obj({ po: str('PO number (PO-0015) or supplier name'), item: str('Material name'), qty: num('Delivered quantity'), all: { type: 'boolean', description: 'true = everything remaining arrived' }, date: str('YYYY-MM-DD') }),
  },
  {
    name: 'pay_purchase_order',
    kind: 'payPurchaseOrder',
    description: 'Pay a supplier against a purchase order. "Rafiq ko PO ke 50 hazar diye".',
    parameters: obj({ po: str('PO number or supplier name'), amount: num('Rupees'), account: str('Account paid from'), date: str('YYYY-MM-DD') }),
  },
  {
    name: 'pay_plot_seller',
    kind: 'plotPayment',
    description: 'Pay the SELLER of a plot toward the deal: token, bayana/advance, instalment or final. "Plot 14 ka token 5 lakh diya".',
    parameters: obj({ plot: str('Plot name'), payType, amount: num('Rupees'), account: str('Account paid from'), date: str('YYYY-MM-DD') }),
  },
  {
    name: 'record_plot_expense',
    kind: 'plotExpense',
    description: 'A plot-side expense: transfer fee, tax, naqsha/approval, dealer commission on a plot.',
    parameters: obj({ plot: str('Plot name'), category: str('Plot expense category'), amount: num('Rupees'), account: str('Account'), note: str('Note'), date: str('YYYY-MM-DD') }),
  },
  {
    name: 'set_sale_deal',
    kind: 'setSale',
    description: 'Record that a project is sold / agreed with a buyer: buyer name + agreed price. "Gulberg 2 crore mein Ahmed ko bech diya".',
    parameters: obj({ project: str('Project name'), buyer: str('Buyer name'), price: num('Agreed price') }),
  },
  {
    name: 'record_buyer_payment',
    kind: 'saleReceipt',
    description: 'Money RECEIVED from the buyer of a project (token, bayana, instalment, final). "buyer ne 20 lakh diye Gulberg ke".',
    parameters: obj({ project: str('Project name'), payType, amount: num('Rupees'), account: str('Account received into'), date: str('YYYY-MM-DD') }),
  },
  {
    name: 'record_sale_cost',
    kind: 'saleCost',
    description: 'A cost on the sale side of a project: dealer commission, buyer-side tax, paperwork.',
    parameters: obj({ project: str('Project name'), note: str('What for (e.g. dealer commission)'), amount: num('Rupees'), account: str('Account'), date: str('YYYY-MM-DD') }),
  },
  {
    name: 'record_investor_payment',
    kind: 'investorPayment',
    description: 'Money RECEIVED from an investor. With a project = staked into that project; without = general payment against the pledge. "Umar ne 5 lakh diye Gulberg ke liye".',
    parameters: obj({ investor: str('Investor name'), project: str('Project name (optional)'), amount: num('Rupees'), account: str('Account received into'), date: str('YYYY-MM-DD') }),
  },
  {
    name: 'mark_plot_transferred',
    kind: 'markTransferred',
    description: 'The plot transfer (registry) is complete. "Plot 14 transfer ho gaya".',
    parameters: obj({ plot: str('Plot name'), date: str('YYYY-MM-DD') }),
  }
);

const EXPLAIN_TOOL: ToolSpec = {
  name: 'explain_app',
  description:
    'Deep knowledge of one TameerBook module (rules, formulas, guards, screens). Call it BEFORE answering how something works, why a number is what it is, or what a rule means (e.g. how settlement splits profit, how worker balance is computed, what PO statuses mean).',
  parameters: obj({ topic: { type: 'string', enum: [...KNOWLEDGE_TOPICS] } }, ['topic']),
};

const OPEN_TOOL: ToolSpec = {
  name: 'open_screen',
  description:
    'Navigate to an app screen. ONLY when the user literally says open / show / go to a page (e.g. "open reports", "cash page dikhao"). NEVER for adding or recording anything — use add_* / record_* even when details are missing.',
  parameters: obj({ screen: { type: 'string', enum: [...OPEN_SCREENS] } }, ['screen']),
};

/** All tools, in the shape every transport accepts. */
export const TOOLS: ToolSpec[] = [
  ...READ_TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters })),
  ...WRITE_TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters })),
  EXPLAIN_TOOL,
  OPEN_TOOL,
];

export type ToolAction =
  | { kind: 'read'; intent: Intent }
  | { kind: 'write'; draft: Draft }
  | { kind: 'open'; screen: OpenScreen }
  /** Module knowledge handed straight back to the model (no card). */
  | { kind: 'knowledge'; text: string }
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
  const sections = a.sections?.map((sec) => ({
    title: sec.title,
    rows: sec.rows.slice(0, 12).map((r) => ({ title: r.title, note: r.subtitle || r.date || undefined, amount: r.amount, direction: r.direction })),
  }));
  return JSON.stringify({ title: a.title, headline: a.headline, sub: a.sub, count: total, rows, more: Math.max(0, total - rows.length), ...(sections ? { sections } : {}) });
}
