/**
 * DOMAIN KNOWLEDGE — what the assistant knows about TameerBook itself.
 *
 * Two layers, because every model call re-sends the system prompt and Groq's
 * free tier allows ~8K tokens per minute:
 *   CORE     — the formulas, rules and vocabulary that matter on every turn
 *              (compact, always in the system prompt)
 *   MODULES  — one deep section per module, fetched on demand through the
 *              `explain_app` tool when a question needs it
 *
 * Everything here mirrors the repositories (src/db/repositories) — when a
 * rule changes there, change it here.
 */

export const CORE_KNOWLEDGE = `APP MODEL (how TameerBook keeps the books; explain_app has the detail per module)
- Accounts (bank / cash / wallet) hold the money; balance = opening + in − out. Every rupee that moves is one IN or OUT on an account, tagged with what it is for: plot, project phase (PLOT / CONSTRUCTION / SALE / GENERAL), category, party, worker, loan, order. Mistakes are reversed, never deleted.
- Plot = land bought from a seller: deal price → payments (token, bayana, instalments, final) → remaining; plus plot expenses. Plot cost = paid + expenses. A plot is free, in a project, or sold.
- Project = plot + construction + sale. Cost = plot cost + construction (cash spend + wages earned but unpaid) + sale costs. Profit so far = sale received − cost.
- Workers earn a daily wage (dihari) per project: FULL / HALF / ABSENT; still to pay = earned − paid. Paying wages moves cash but adds no cost.
- Purchase order = material booked from a supplier: qty booked vs delivered, total vs paid; closed when both settle.
- Udhaar = money lent (GIVEN) or borrowed (TAKEN); balance = given − returned.
- Investors (Musharakah): pledge → received → staked in projects. Profit splits by the rule chosen at settlement; loss always by capital ratio. Standing = invested + profit − paid out.
- Rupees are grouped Pakistani style: 25,00,000 = 25 lakh; 1 crore = 100 lakh.`;

export const KNOWLEDGE_TOPICS = [
  'accounts',
  'transactions',
  'plots',
  'projects',
  'construction',
  'labor',
  'purchase_orders',
  'udhaar',
  'investors',
  'settlement',
  'reports',
  'categories',
  'settings',
  'assistant',
] as const;
export type KnowledgeTopic = (typeof KNOWLEDGE_TOPICS)[number];

export const MODULE_KNOWLEDGE: Record<KnowledgeTopic, string> = {
  accounts: `ACCOUNTS (Home → Cash)
- Types: BANK (e.g. HBL, Meezan), CASH (cash in hand), WALLET (JazzCash, Easypaisa). Each has an opening balance entered freely when created.
- Balance is derived live: opening + Σ IN − Σ OUT over non-void transactions on that account. Total balance = all accounts. Total assets = cash + money sunk into unsold plots + construction cost of active projects + loans receivable.
- Transfer = two linked transactions (OUT of one account, IN to another); it is neither income nor expense and is excluded from spend totals.
- Guard: an account can never go below zero — a payment larger than the balance is refused ("insufficient funds").
- Archive hides an account; its history stays.`,

  transactions: `TRANSACTIONS (the ledger)
- Fields: direction IN/OUT, amount, date, account, optional project + phase, category, party, quantity (for materials), note, receipt photo, and links (plot, worker, loan, order, investor, transfer pair).
- Phases: PLOT (seller payments, plot expenses), CONSTRUCTION (materials, labour, site costs), SALE (dealer commission, buyer-side costs), GENERAL (personal / office money not tied to a project).
- Void = append a mirror reversal and flag the original; balances self-correct. Linked rows (transfers, loans, wages, orders, sale receipts) are edited from their own module so both sides stay consistent.
- Search covers description, counterparty and category; filters: period (today / week / month / quarter / year / custom), in/out, category, account, project.
- Quick Entry (+ button): Expense, Payment In (investor / project sale / plot sale / loan return / other), Material, PO, Transfer, Loans, Investor, Daily wage, Home expense, Assistant.`,

  plots: `PLOTS
- Identity: society/area, block, plot number (name is composed from these), size (marla / kanal / sq yd), seller name + phone + CNIC, transfer deadline.
- Buying: deal price; payments to the seller are named instalments — Token (once), Bayana/advance (once), then instalments / final. Paid can never exceed the deal ("exceeds remaining"). Remaining = deal − paid.
- Expenses on the plot (tax, transfer fee, naqsha/approval) are PLOT-phase OUT rows; plot cost = paid to seller + expenses.
- Transfer: a deadline drives reminders (7 and 2 days before); "Mark transferred" records the transfer date and clears the reminder.
- Standalone flip: a plot can be sold without a project — buyer name, sale price, buyer receipts; profit = received − plot cost; investors can be attached to a plot flip and settled like a project.
- Including a plot in a project moves its cost history under that project; a plot in a project cannot be reused; a settled project marks its plot SOLD.
- Documents: fard, registry, agreement, NDC etc. attached as photos.`,

  projects: `PROJECTS
- A project is created on a free plot (optional) with initial investors (each with a stake; capacity = pledge − already staked). Creating writes project + plot link + participations + INITIAL capital atomically.
- Lifecycle % is derived: plot secured 25 → building 50 → listed for sale 75 → sold 90 → completed 100. Status: ACTIVE (money can move), ON_HOLD, CANCELLED, COMPLETED (read-only).
- Cost = plot + construction + sale costs. Construction = cash materials/site spend + accrued wages (unpaid wages count!). Profit so far = sale received − total cost.
- Completion: via Settle Up (sale fully received → distribute → investors SETTLED → project COMPLETED → plot SOLD), or manual "mark completed" (no money moves; warns about unpaid wages / buyer outstanding).
- Pages: Project detail (phases, investors, docs, PDF report), Construction (expenses, materials by category, workers, attendance), Sale (deal, buyer receipts token/bayana/…, sale costs), Settle Up, Photo diary.`,

  construction: `CONSTRUCTION (inside a project)
- Materials are categories with a unit (cement in bori/bags, sariya in kg, bajri/sand in ft or trolley). A material purchase records qty, rate and total (= qty × rate unless overridden), the supplier and the account paid from. The last rate paid for that material (same supplier first) is offered as a default.
- Construction summary: total = Σ non-labour CONSTRUCTION OUT + Σ accrued wages; "this month" slice; top categories with quantities; labour accrued / paid / outstanding.
- Cross-project material transfer: delivering a booked material to another project posts a cost transfer (OUT on the receiver, netting IN on the source) so both project costs stay right.
- Guard: a closed (COMPLETED / CANCELLED) project accepts no new entries.`,

  labor: `LABOR (workers / mazdoor)
- A worker is reusable across projects. Attaching to a project sets that project's daily wage (dihari). Wage can be changed later; past days keep the wage they were marked at.
- Attendance per day: FULL (full wage), HALF (aadha, half wage), ABSENT (0). Marking again the same day replaces. Bulk "mark all present" skips workers who already earned elsewhere that day.
- Rules: a paid day needs a wage set; one worker earns on only ONE project per date; a removed worker can't be marked.
- Balance per project = Σ accrued − Σ payments; the worker's khata adds this across projects (earned / taken / owed). Payment can't exceed what is owed.
- Paying wages is an OUT transaction tagged to the worker and project; it settles the accrual and is NOT added to construction cost again.
- PDF: worker khata statement.`,

  purchase_orders: `PURCHASE ORDERS (PO / bookings)
- A PO groups line items from one supplier for one project: item, qty, unit, rate, total; auto number PO-0001….
- Each item tracks two balances: material (booked − delivered = still to receive) and money (total − paid = still to pay). Deliveries are dated rows; payments are OUT transactions tagged to the item; "receive and pay" does both atomically.
- Status per order: pending delivery (nothing received), partly delivered, delivered (all items received); money: unpaid / paid. Closed when both material and money are settled; can be cancelled.
- Guards: can't receive more than booked, can't pay more than owed, delivery/payment can't predate the order; editing can't drop qty below received or total below paid.
- PDF: purchase order document with the company signature.`,

  udhaar: `UDHAAR (loans)
- One record per person and direction: GIVEN (we lent; they owe us → receivable) or TAKEN (we borrowed → payable). The person can be free-text or a saved party.
- Give = OUT of an account (receivable up); Return = IN to an account (receivable down). Balance = given − returned; the record clears at zero.
- Home shows total receivable and payable; a weekly reminder nudges about open loans; a loan quiet for 60 days is flagged as needing attention.`,

  investors: `INVESTORS (Musharakah partners)
- Profile: name, phone, CNIC, bank details, photo, pledge (committed amount).
- Money: received (cash they actually paid in, IN to an account), staked (net capital in projects/plots), available (returned capital + profit not yet re-deployed), paid out, realized profit. Standing = invested + profit − paid out.
- Capacity: a new stake can't exceed pledge − already staked; a payment can't exceed the remaining pledge.
- Exit wizard scenarios: full exit at a valuation, partial exit, transfer of stake to another partner or a new investor, etc. — all append-only in the capital ledger.
- Per-participation profit % can be set for the "agreed percentages" rule. Statement PDF per investor; exit receipt PDF.`,

  settlement: `SETTLEMENT (Settle Up) — Shariah-based, decided at settle time
- Ownership is computed FIRST from real capital; the owner/builder is the residual financier (whatever capital investors did not cover).
- Profit = revenue (sale receipts + other income) − expenses (all OUT + unpaid wages). Charity % (from Settings, or per project) is taken off profit first; each party can opt out of their charity slice.
- Rules for splitting PROFIT: by ownership share (default), agreed percentages (must total 100), owner's work share % first then by ownership, investor's return first (flat % or % per month) then owner keeps the rest, or manual rupee amounts.
- LOSS always splits by capital ratio — no rule applies (Shariah).
- Settling records payouts + capital return, marks participations SETTLED, the project COMPLETED and its plot SOLD. Double settlement is blocked. Settlement receipt PDF per party.`,

  reports: `REPORTS (Settings → Reports; all PDFs share one house style, shareable via WhatsApp)
- Project Summary (invested / spent per project), Profit & Loss (revenue, expenses, net per project), Cash Flow (monthly in vs out), Expenses by category, Investment matrix (investor × project), ROI, Accounts (flows per account). Each also exports CSV.
- Module PDFs: project report, plot purchase→sale report, worker khata, investor statement, settlement receipt, purchase order.
- Allocation screen shows cost split across projects.`,

  categories: `CATEGORIES (Settings → Categories)
- Fixed sections: Materials (with units and sub-units, e.g. kg → g ×1000), Seller Payment (Token, Bayana, Instalment…), Buyer Payment, Plot expenses (Transfer fees & tax, Naqsha/approval), Sale costs, Home Expense. Users add categories only inside a section.
- System categories (Plot Payment, Labor Payment, Transfer, Material Booking, Other Income…) are created by the app and can't be renamed or deleted; a category in use can't be deleted.
- Each module's entry form shows only its own section's categories.`,

  settings: `SETTINGS
- Company (multiple companies/workspaces; every list is scoped to the active one), Accounts, Reports, Categories, Signature (draw or photo; used on PDFs), remove.bg key for signature background.
- Preferences: language English / Urdu (RTL), dark mode, font family (incl. Urdu faces), text size, Home sections (plots / labour / loans), Quick Entry tile order, reminders (daily 8 pm, transfer deadlines, loans weekly, buyer dues weekly), charity %.
- Assistant (AI): provider (Groq / Gemini / OpenAI / OpenRouter / own server / custom), key, model, voice, connection test. Off by default.`,

  assistant: `ASSISTANT (this chat)
- Reads the ledger through tools and answers with real figures; prepares entries that the user confirms on an inline card (Accept / Reject); opens screens or PDF reports on request. Voice via hold-to-talk; receipts can be read from a photo on the Material entry form.
- It never saves anything without the user's Accept, never invents numbers, and uses the user's own names for projects, plots, accounts, materials, suppliers, workers and investors.`,
};

/** The deep section for one topic, or null when the topic is unknown. */
export function explainTopic(topic: string): string | null {
  return (KNOWLEDGE_TOPICS as readonly string[]).includes(topic) ? MODULE_KNOWLEDGE[topic as KnowledgeTopic] : null;
}
