# TameerBook v2 — Cash Flow, Standalone Plots, Restructured Projects, Labor, Donation & Reports

## Context

TameerBook is being turned into a real product. Today it models a property flip as a single
"project" with an internal plot and a linear **stage-flowchart** (TOKEN_PAID → … → CLOSED).
The owner wants a different, more real mental model built around **cash**:

1. **Cash flow is the core.** All money lives in **accounts** (multiple banks, cash-in-hand, wallet).
   Every payment/receipt moves money through an account; the dashboard shows real balances. Udhaar
   (money lent to a person — possibly someone not in the app) leaves and later returns to an account.
2. **Plots are standalone.** A plot is purchased on its own (deal price, then token/bayana/other
   payments to the seller, plus expenses like tax/transfer fee, plus documents). Only later is a plot
   **included in a project** to build & sell.
3. **A project = an included plot + construction + sale**, with **no stage-flowchart** — a clean,
   phase-card UX instead. Project total cost = plot total + construction + sale expenses.
4. **Settlement** shows investors + owner (residual), each party's profit/loss, and a **donation**
   (charity) deduction = a % of each party's profit (from Settings), shown per party.
5. **Labor (mazdoor)** are reusable workers; per project they have a daily wage (dihari) and daily
   attendance (full/half/absent) that accrues a balance; payments deduct from that balance and from an account.
   Accrued wages count as construction cost.
6. **Settings** per section (investor %, donation %, accounts, etc.).
7. **Reports & receipts** — beautiful, with transaction lists rendered as a **ledger table** like the
   owner's handwritten notebook (description + date on the left, amount + type on the right, ruled rows).

**Locked decisions (from the owner):** clean schema rebuild + reset dev DB; donation = % of each
party's profit (investors + owner), shown per party, none on loss; labor = reusable worker with
per-project wage + full/half/absent attendance; **accounts are the source of truth** — opening
balances are entered freely (not attributed to any source), every entry picks an account, udhaar
counterparty may be a free-text (unsaved) name.

This is a large build. It ships **domain by domain** (schema → repository/business-logic → quick test
→ frontend), keeping `npx tsc --noEmit` green between steps and reusing the existing engine wherever possible.

---

## What we REUSE (do not rebuild)

- **Settlement engine** `src/db/repositories/settlement.ts` — `computeSettlement`, `settleProject`,
  `getProjectSettlementSummary` already do profit-by-% / loss-by-capital-ratio **and owner-residual**
  math. We extend it with donation, not replace it.
- **Investor/capital subsystem** — `investors.ts`, `investments.ts`, `capital.ts`, `exit.ts`,
  `project_investors`, `capital_ledger`. Kept as-is.
- **Export/receipt infra** — `src/utils/exporter.ts` (`expo-print` → PDF, `expo-sharing`), `ReportPreview.tsx`,
  `ReportScreen.tsx` section model. Powers the new receipts.
- **Money/date utils** — `src/utils/money.ts` (`formatRupees`, `formatPakistaniGrouping`, `toReadableAmount`),
  `src/utils/date.ts` (`todayISO`).
- **UI vocabulary** — `AppCard`, `AppListRow`, `StatCard`, `AmountInput` (incl. `floating` variant),
  `FloatingLabelInput`, `SelectSheet`, `AppToggle`, `AppButton`, `AppHeader`, `AppIcon`/`icons.ts`,
  `EmptyState`, the raw-`Modal` bottom-sheet pattern (`backdrop` + `radius.hero` sheet + grabber), theme tokens.
- **Settings persistence** — `useSettingsStore` + `app_settings` (`loadSettings`/`saveSetting`); add new keys the same way.
- **Docs** — `documents` table + `addDocument`/`listDocuments` (polymorphic `entity_type`/`entity_id`).
- **Migrations mechanism** — `PRAGMA user_version` + `MIGRATIONS` array in `src/db/schema.ts`.

---

## Data model (clean rebuild — fresh `SCHEMA_V1`)

Since we're resetting the dev DB, we author one clean baseline schema. Tables kept unchanged:
`investors`, `project_investors`, `capital_ledger`, `sales`, `sale_receipts`, `documents`,
`categories`, `parties`, `app_settings`, `milestones` (optional/progress only — no longer gates anything).

### New tables

**`accounts`** — the cash-flow source of truth
`id, created_at, created_by, name, type ('BANK'|'CASH'|'WALLET'), opening_balance REAL, icon, color,
sort_order INTEGER, is_archived INTEGER default 0`. Balance = `opening_balance + Σ(IN) − Σ(OUT)` over
non-void transactions on that account. Seed one default `CASH` "Cash in Hand" account.

**`plots`** — standalone plot purchase (replaces properties-inside-project)
`id, created_at, created_by, name, society, block, plot_no, size_value REAL, size_unit,
deal_price REAL, seller_name, seller_cnic, seller_phone, transfer_date, transfer_deadline,
status ('OWNED'|'IN_PROJECT'|'SOLD'), project_id TEXT NULL (set when included in a project)`.

**`laborers`** — reusable worker
`id, created_at, created_by, name, phone, cnic, photo_uri, status ('ACTIVE'|'INACTIVE')`.

**`project_laborers`** — worker attached to a project with a wage
`id, created_at, created_by, project_id, laborer_id, daily_wage REAL, status, joined_at`.

**`labor_attendance`** — one row per worker per day
`id, created_at, created_by, project_laborer_id, date, status ('FULL'|'HALF'|'ABSENT'),
wage_accrued REAL, note`. UNIQUE(`project_laborer_id`,`date`). `wage_accrued` = daily_wage (FULL) /
½ daily_wage (HALF) / 0 (ABSENT). Attendance is an **accrual**, not a cash movement.

**`udhaar`** — one row per lending relationship (person may be unsaved)
`id, created_at, created_by, person_name TEXT, party_id NULL, direction ('GIVEN'|'TAKEN'),
note, status ('OPEN'|'CLEARED')`. Balance = Σ(given/OUT) − Σ(returned/IN) via linked transactions.

### Reworked `transactions` — the universal money primitive

Every cash movement is one append-only transaction (void-by-reversal kept). Columns:
`id, created_at, created_by, direction ('IN'|'OUT'), amount REAL, date,
account_id TEXT NULL (FK accounts — NULL only for pure accruals; every real cash move sets it),
project_id TEXT NULL (was NOT NULL — now optional for global/personal money),
plot_id TEXT NULL (FK plots), phase TEXT NULL ('PLOT'|'CONSTRUCTION'|'SALE'|'GENERAL'),
category_id NULL, party_id NULL, counterparty_name TEXT NULL (free-text, e.g. udhaar person),
pay_type TEXT NULL ('TOKEN'|'BAYANA'|'INSTALLMENT'|'FINAL' for seller/buyer payments),
transfer_id TEXT NULL (links the two rows of an account-to-account transfer),
udhaar_id TEXT NULL (FK udhaar), description, doc_id, is_void, void_of_id`.
**`mode` is removed** — the account (and its `type`) replaces CASH/BANK/JAZZCASH. CREDIT/supplier-udhaar
is modeled via the `udhaar` table, not a mode.

Indices: `account_id`, `project_id`, `plot_id`, `udhaar_id`, `is_void`.

**Note — plot ↔ project cost:** plot transactions carry `plot_id`; when a plot is included in a project,
we backfill `project_id` onto that plot's existing transactions (and set it on future ones), so the
existing project-`project_id`-based settlement/expense sums stay correct without new query paths.

---

## Business logic (repositories)

### `accounts.ts` (new)
- `addAccount({name,type,openingBalance,icon?,color?})`, `listAccounts()`, `getAccount(id)`, `archiveAccount(id)`.
- `getAccountBalance(id)` and `listAccountsWithBalance()` → `opening + ΣIN − ΣOUT`.
- `getTotalBalance()` → sum across accounts (dashboard hero).
- `transferBetween({fromId,toId,amount,date,note})` → two linked transactions (OUT of `from`, IN to `to`)
  sharing a `transfer_id`, category "Transfer", `project_id=NULL`.

### `transactions.ts` (extend)
- `addTransaction` gains `accountId, plotId?, phase?, counterpartyName?, payType?, udhaarId?, transferId?`
  and `projectId?` becomes optional. Keep append-only + `voidTransaction` (reversal mirrors direction, so it restores the account balance).
- New queries: `listAccountTransactions(accountId)`, `listPlotTransactions(plotId)`,
  `listProjectPhaseTransactions(projectId, phase)`.
- Existing `getProjectTotals` reused; `getCashBankBalance` replaced by account balances.

### `plots.ts` (new)
- `createPlot(input)`, `listPlots(status?)`, `getPlot(id)`, `updatePlot`, `deletePlot`.
- `addPlotPayment({plotId, payType, amount, date, accountId, receiptUri?})` → OUT transaction
  (`phase='PLOT'`, category "Plot Payment", `pay_type`, `account_id`), optional receipt doc. (Mirrors old `addAcquisitionPayment`.)
- `addPlotExpense({plotId, categoryId, amount, date, accountId, note?, receiptUri?})` → OUT transaction (`phase='PLOT'`, tax/transfer/fee categories).
- `getPlotSummary(id)` → `{dealPrice, paidToSeller (Σ Plot Payment), remaining (deal−paid),
  expenses (Σ other PLOT OUT), totalCost (paid+expenses)}` — drives the plot card exactly like the owner's example.
- `includePlotInProject(plotId, projectId)` → set `plots.project_id`, `status='IN_PROJECT'`, backfill `project_id` on the plot's transactions.

### `projects.ts` (rework)
- Drop `PROJECT_STAGES`/stage transitions/`project_stage_history` usage (table may remain unused or be dropped).
  `projects` keeps `status ('ACTIVE'|'COMPLETED')` + `plot_id`.
- `createProject({name, plotId, investors[]})` → insert project, `includePlotInProject`, per investor
  `addProjectInvestor` + `addInvestment`. (Milestones optional.)
- **`addInvestment` gains `accountId`** — investor capital flows IN to a chosen account (it's real cash entering
  the business), keeping the ledger and account balances consistent. Same for `addSaleReceipt` (buyer money IN).
- `getProjectPhases(id)` → `{plot: PlotSummary, construction: ConstructionSummary, sale: SaleSummary}` for the phase cards.

### Construction / labor (`labor.ts` new + extend `analytics.ts`)
- `addLaborer`, `listLaborers`, `attachLaborerToProject({projectId, laborerId, dailyWage})`, `listProjectLaborers(projectId)`.
- `markAttendance({projectLaborerId, date, status})` → upsert `labor_attendance`, compute `wage_accrued`.
- `listAttendance(projectLaborerId)`, `getLaborBalance(projectLaborerId)` = `Σ wage_accrued − Σ payments`.
- `payLaborer({projectLaborerId, amount, date, accountId})` → OUT transaction (`phase='CONSTRUCTION'`,
  category "Labor Payment", `party_id`→laborer), reduces account + labor balance. **Not** counted again as construction cost.
- `getConstructionSummary(projectId)` (rework) → `total = Σ(non-labor CONSTRUCTION OUT) + Σ(accrued labor wages)`,
  `byCategory[]` (top categories, e.g. Cement 50, Bajri 10), `laborAccrued`, `laborPaid`, `laborOutstanding`.

### Sale (reuse `sales.ts`)
- Keep `upsertSale`, `addSaleReceipt` (buyer token/bayana via `pay_type`, posts IN to an account),
  `addSaleCost` (sale expense OUT, `phase='SALE'`), `getSaleSummary`. Add `account_id` to receipts/costs
  so they flow through cash.

### Udhaar (rework `udhaar.ts`)
- `createUdhaar({personName, partyId?, direction})`, `listUdhaar(status?)` with balances.
- `giveUdhaar({udhaarId, amount, date, accountId})` → OUT (money leaves account, receivable up).
- `returnUdhaar({udhaarId, amount, date, accountId})` → IN (money back to account, receivable down).
- `getUdhaarBalance(id)`; dashboard total receivable = Σ open GIVEN balances.

### Settlement + donation (extend `settlement.ts` + Settings)
- Add `donationPct` to Settings (default e.g. 0 or a configured %). Optional per-project override on `projects`.
- Extend `SettlementRow`/`SettlementSummaryRow` with `donation` and `payoutAfterDonation`:
  for each party with **positive** profit, `donation = profit * donationPct/100`,
  `netProfit = profit − donation`, `finalPayout = capital + netProfit`. Loss → no donation.
  Owner row gets the same donation on its residual profit. `totalDonation = Σ party donations` (the charity pool).
- **Loss-split fix (calculation bug found):** today `getProjectSettlementSummary` splits a loss only across
  *investor* capital (`net * invested/investorsInvested`), so the investors absorb 100% of the loss and the
  owner ends up at **0** — even though the owner is also a capital provider. Since the locked rule is "loss
  always by capital ratio", fix it to split across **all** capital: `totalCapital = investorsInvested + ownerInvested`
  (ownerInvested = residual = expenses − investorsInvested), each party's loss = `net * (theirCapital / totalCapital)`.
- `settleProject` records `DONATION` alongside `PROFIT_PAYOUT` (new `capital_ledger` entry type for investors;
  owner donation recorded at project level). Existing revenue/expense math otherwise unchanged (all costs are OUT, revenue = sale receipts).

---

## UI / screens

**Design language unchanged** (Soft Modern, all via `useTheme()`, strings via `t()`, Roman Urdu for new `ur`).
New reusable components:
- **`LedgerTable`** — the notebook-style ruled transaction list: left = title + date, right = amount + type,
  hairline-ruled rows; used in plot detail, construction detail, account ledger, sale detail, reports.
- **`AccountCard`** — bank/cash/wallet balance card (icon, name, big balance, tone by type).
- **`PhaseCard`** — a project phase summary card (title, headline number, sub-metrics, chevron → detail).
- **`AttendanceMarker`** — per-day full/half/absent segmented control; **`AttendanceCalendar`** month grid.

### Navigation additions (`src/navigation/`)
- Tabs: consider swapping to **Home / Cash / Projects / Reports** (Investors reachable from Projects & a
  Settings link) — or keep 4 tabs and add **Accounts** + **Plots** as stack routes off Home. (Decide during Phase B; default: add `Accounts`, `AccountDetail`, `Plots`, `PlotDetail`, `Udhaar` (reworked),
  `ConstructionDetail`, `LaborDetail`, `AttendanceScreen` stack routes.)
- Remove stage-flowchart routes/logic from `ProjectDetail`.

### Screens
- **Dashboard (`HomeScreen`)** — rework: total balance across accounts + a rail/list of **AccountCards**;
  udhaar receivable stat; recent cash flow (LedgerTable); projects rail; quick "+" → entry chooser
  (Income / Expense / Transfer / Give-Udhaar / Investment). Beautiful + clear.
- **Accounts** — list (AccountCards + total), add account (name/type/opening balance), **AccountDetail**
  = account LedgerTable + transfer action.
- **Entry (`EntryScreen` rework)** — every income/expense picks an **account** (SelectSheet) instead of mode chips;
  optional project/plot/phase link. Keep fast re-entry.
- **Plots** — list (cards: deal / paid / remaining / expenses / total / status), **PlotCreate** (deal + plot + seller),
  **PlotDetail** — summary card (owner's exact math), seller-payment drawer (token/bayana/… + account + receipt),
  expense drawer (tax/transfer/… + account), documents, transaction LedgerTable, "Include in project" action.
- **Projects** — **ProjectsScreen** (unchanged shell), **NewProject** rework (name + pick an owned plot + investors),
  **ProjectDetail** rework: **no flowchart** — three `PhaseCard`s (Plot → tap navigates to PlotDetail;
  Construction → ConstructionDetail; Sale → SaleDetail) + a Summary/Settlement card + investors section.
- **ConstructionDetail** — expense total + top categories, transaction LedgerTable, **Labor** subsection
  (workers with wage/balance/taken, add worker, mark attendance, pay worker → account).
- **SaleDetail** — sale deal price, buyer receipts (token/bayana → account), sale expenses, outstanding, LedgerTable.
- **Settlement (`SettlementScreen` extend)** — revenue/expenses/profit; per-investor row (capital, profit%,
  profit, **donation**, payout); **owner** row (residual invested, profit, donation, payout); **total donation to charity**; share receipt PDF.
- **Settings (extend)** — Accounts management, donation %, default investor %, existing prefs.
- **Reports (extend)** — add cash-flow-by-account, plot report, labor report; all lists via LedgerTable;
  **receipts**: styled per-payment receipt (HTML→PDF via existing `exporter`).

---

## i18n
Add key groups to `src/i18n/{types.ts,en.ts,ur.ts}` (interface is type-checked, so all three stay in sync;
Roman Urdu for new `ur` values): **accounts** (account, bank, cashInHand, wallet, openingBalance, transfer,
totalBalance, addAccount), **plots** (plot, dealPrice, paidToSeller, remaining, expenses, totalCost,
includeInProject, sellerPayment), **labor** (mazdoor, dailyWage, attendance, present/full, halfDay, absent,
wageBalance, takenSoFar, payWorker, addWorker), **udhaar** (giveUdhaar, returnUdhaar, receivable, personName),
**donation** (donation, charity, donationPct, donationNote), **receipts/ledger** table headers, phase labels
(Plot/Construction/Sale).

---

## Implementation phases (each: schema → repo/logic → quick test in DevTools/`tests.ts` → frontend → `tsc` green)

- **A. Schema foundation** — author fresh `SCHEMA_V1` with all tables above; reset dev DB; seed default Cash account + categories (add "Transfer", "Plot Payment", "Labor Payment", "Sale Cost", "Udhaar" as needed). Update all `*Row` types + enums in `schema.ts`.
- **B. Accounts & cash-flow core** — `accounts.ts`, transaction rework (account posting, transfers, balances), Accounts screens + AccountDetail, dashboard rework, EntryScreen account picker.
- **C. Udhaar** — `udhaar.ts` rework (give/return, free-text person), Udhaar screens, dashboard receivable.
- **D. Plots (standalone)** — `plots.ts`, Plots list/create/detail, seller-payment & expense drawers, docs, LedgerTable.
- **E. Projects restructure** — `projects.ts` rework, NewProject (attach plot + investors), ProjectDetail phase cards, remove flowchart, SaleDetail.
- **F. Labor & attendance** — `labor.ts`, ConstructionDetail labor subsection, AttendanceMarker/Calendar, pay-worker.
- **G. Settlement + donation + Settings** — extend `settlement.ts` + Settings (donationPct, accounts mgmt), SettlementScreen with per-party donation.
- **H. Reports & receipts** — new report types, LedgerTable polish, per-payment receipt PDF.

i18n keys land incrementally within each phase.

---

## Verification (end-to-end, Expo Go, `npx expo start -c`)

Walk the owner's own example:
1. **Accounts:** add a Bank + Cash account with opening balances → dashboard total = sum; add a transfer → both balances move, total unchanged.
2. **Plot:** create a plot, deal **1000**; pay **token 50** → card shows deal 1000 / paid 50 / remaining 950; pay
   **bayana 200** → paid 250 / remaining 750; finish to 1000/1000; add **tax 100** → expenses 100, **total cost 1100**.
   Each payment deducts from the chosen account. Attach a document.
3. **Project:** create a project including that plot + two investors (Amir 200, Amanullah 300). Plot card shows the
   1100 and taps into PlotDetail.
4. **Construction:** add expenses (cement 50, bajri 10 → top categories); add a worker (dihari set), mark a few days
   (incl. a half-day) → balance accrues; pay the worker from an account → balance + account drop; construction total
   includes accrued wages.
5. **Sale:** sale deal **3000**, receive token/bayana from buyer (into an account), add **200** sale expense →
   revenue 3000, costs tracked.
6. **Settlement:** profit = 3000 − (1100 + construction + 200); per-investor profit by %, **donation** deducted per
   party (from Settings %), owner residual row, total charity shown; confirm → payouts recorded, share receipt PDF.
7. **Udhaar:** give 100 to a free-text person (account drops, receivable 100 on dashboard); return 60 (account rises, receivable 40).
8. `npx tsc --noEmit` passes after each phase; balances reconcile everywhere (dashboard = accounts = ledger sums).

## Test cases

Two layers: **(1) business-logic unit tests** — pure DB/repo assertions runnable in `src/db/tests.ts`
(surfaced by the DevTools "run DB self-tests" screen), each starting from a fresh in-memory/temp DB;
and **(2) entry/E2E scenarios** — manual UI walkthroughs in Expo Go. Every test lists Setup → Action →
Expected. Amounts are kept small so the arithmetic is checkable by hand.

Invariant asserted after **every** test: `getTotalBalance()` == `Σ(opening_balance) + Σ(IN) − Σ(OUT)`
over non-void transactions, and each `getAccountBalance(a)` matches its own rows.

### 1. Accounts & cash flow (`accounts.ts`, `transactions.ts`)
- **T-ACC-01 open balance:** add BANK "HBL" opening 100000 → balance 100000; total 100000.
- **T-ACC-02 expense:** OUT 5000 from HBL → HBL 95000.
- **T-ACC-03 income:** IN 20000 to HBL → HBL 115000.
- **T-ACC-04 transfer:** add CASH opening 0; `transferBetween(HBL→CASH, 10000)` → HBL 105000, CASH 10000,
  **total unchanged**; two rows share one `transfer_id`, category "Transfer", `project_id` NULL.
- **T-ACC-05 multi-account total:** `getTotalBalance` == sum of all `listAccountsWithBalance`.
- **T-ACC-06 void restores:** void the T-ACC-02 expense → HBL back to 100000; reversal row present, original `is_void=1`, excluded from sums.
- **T-ACC-07 wrong account isolation:** an OUT on CASH does not change HBL.

### 2. Entry-type coverage (each asserts row fields + account effect + correct ledger membership)
For every entry type, assert: `direction`, `account_id` set, correct `phase`/`plot_id`/`project_id`/`category`,
balance moved by the right sign, and the row appears in the right query (`listAccountTransactions` /
`listPlotTransactions` / `listProjectPhaseTransactions`).
- **T-ENT-01 income** (IN, GENERAL) • **T-ENT-02 expense** (OUT, GENERAL)
- **T-ENT-03 transfer** (see T-ACC-04)
- **T-ENT-04 plot payment TOKEN** (OUT, phase PLOT, pay_type TOKEN, category "Plot Payment", plot_id set)
- **T-ENT-05 plot payment BAYANA / INSTALLMENT / FINAL** (same, varying pay_type)
- **T-ENT-06 plot expense** (OUT, phase PLOT, category "Transfer Fees & Tax")
- **T-ENT-07 construction expense** (OUT, phase CONSTRUCTION, e.g. "Cement", project_id set)
- **T-ENT-08 labor payment** (OUT, phase CONSTRUCTION, category "Labor Payment", party_id→laborer)
- **T-ENT-09 sale receipt** (IN, phase SALE, pay_type from buyer, account_id set)
- **T-ENT-10 sale cost** (OUT, phase SALE)
- **T-ENT-11 udhaar give** (OUT, udhaar_id set, counterparty_name free-text)
- **T-ENT-12 udhaar return** (IN, udhaar_id set)
- **T-ENT-13 investment** (IN, category "Investor Investment", account_id set, + capital_ledger INITIAL)
- **T-ENT-14 receipt doc:** any entry with a receipt image writes a `documents` row (`entity_type='transaction'`).
- **T-ENT-15 void any type:** voiding restores the account balance and drops it from all summaries.

### 3. Plot summary math (`plots.ts` `getPlotSummary`) — mirrors the owner's example
- **T-PLOT-01:** create plot, deal **1000** → `{deal 1000, paid 0, remaining 1000, expenses 0, total 0}`.
- **T-PLOT-02:** token **50** → `{paid 50, remaining 950, expenses 0, total 50}`.
- **T-PLOT-03:** bayana **200** → `{paid 250, remaining 750, expenses 0, total 250}`.
- **T-PLOT-04:** final **750** → `{paid 1000, remaining 0, expenses 0, total 1000}`.
- **T-PLOT-05 expense before full pay:** on a plot paid 250, add tax **100** → `{paid 250, remaining 750, expenses 100, total 350}` (expense adds on top; remaining is seller-only).
- **T-PLOT-06 fully paid + expense:** paid 1000 + tax 100 → `{remaining 0, expenses 100, total 1100}`.
- **T-PLOT-07 overpay guard:** paying more than `remaining` is warned/blocked (decide: block vs allow with negative remaining) — assert chosen behavior.
- **T-PLOT-08 include in project:** `includePlotInProject` sets `plots.project_id`, status IN_PROJECT, and backfills `project_id` on all 4 plot transactions.

### 4. Construction + labor (`labor.ts`, `getConstructionSummary`)
- **T-LAB-01 accrual full:** worker wage **1000**, mark **FULL** → attendance `wage_accrued=1000`; `getLaborBalance` 1000.
- **T-LAB-02 half day:** mark **HALF** → `wage_accrued=500`.
- **T-LAB-03 absent:** mark **ABSENT** → `wage_accrued=0`.
- **T-LAB-04 upsert same day:** re-mark the same date FULL→HALF → single row, accrued 500 (no duplicate).
- **T-LAB-05 balance:** 2×FULL + 1×HALF (wage 1000) → accrued 2500; balance 2500.
- **T-LAB-06 pay worker:** `payLaborer(1000)` from CASH → CASH −1000, `laborPaid=1000`, balance 1500.
- **T-LAB-07 construction total incl. accrual:** cement 50 + bajri 10 + accrued 2500 → **total 2560**; `byCategory` top = Cement 50.
- **T-LAB-08 no double count:** after T-LAB-06 the construction total is **still 2560** (labor payment settles balance, is not re-added as cost); `laborOutstanding=1500`.
- **T-LAB-09 reusable worker:** same laborer attached to two projects with different `daily_wage`; balances are independent per `project_laborer`.

### 5. Sale (`sales.ts`)
- **T-SALE-01:** `upsertSale` deal **3000** → `{agreed 3000, receipts 0, outstanding 3000}`.
- **T-SALE-02:** buyer token **500** IN to account → `{receipts 500, outstanding 2500}`, account +500.
- **T-SALE-03:** receipts reach 3000 → outstanding 0.
- **T-SALE-04 sale cost:** add **200** → OUT phase SALE; does not change receipts/outstanding.

### 6. Project total cost (`getProjectPhases`)
- **T-PROJ-01:** plot total 1100 + construction 2560 + sale cost 200 → **project total cost 3860**.
- **T-PROJ-02:** plot transactions appear under the project after `includePlotInProject` (feeds settlement expenses).

### 7. Settlement + donation (`settlement.ts`)
Scenario: investors **Amir 200 @ 20%**, **Amanullah 300 @ 30%**; expenses **1000**, `donationPct` **10%**.
- **T-SET-01 profit split:** revenue **1500** → net **+500**. Amir 500×20%=**100**, Amanullah 500×30%=**150**,
  owner residual **250**; owner invested = 1000−500=**500**.
- **T-SET-02 donation per party:** donations Amir **10**, Amanullah **15**, owner **25**; `totalDonation` **50**.
  Net profits Amir 90 / Amanullah 135 / owner 225; payouts Amir 200+90=**290**, Amanullah 300+135=**435**.
- **T-SET-03 loss by capital ratio (incl. owner, the fix):** revenue **800** → net **−200**.
  totalCapital = 500 investors + 500 owner = 1000. Amir −200×200/1000=**−40**, Amanullah **−60**, owner **−100**;
  Σ = −200. **No donation on loss.** (Assert owner is NOT 0 — guards against the current bug.)
- **T-SET-04 zero-profit edge:** net 0 → all profitOrLoss 0, donation 0, payout = capital.
- **T-SET-05 settle writes:** `settleProject` appends PROFIT_PAYOUT/LOSS_ADJ + DONATION + EXIT_SETTLEMENT per
  investor, marks participations SETTLED, project COMPLETED; re-running `getProjectSettlementSummary` post-settle still reconciles.
- **T-SET-06 no investors:** owner takes 100% of profit/loss; donation applies to owner only.

### 8. Udhaar (`udhaar.ts`)
- **T-UDH-01 give:** create "Bilal" GIVEN; give **100** from CASH → CASH −100, receivable(Bilal) **100**, dashboard total receivable 100.
- **T-UDH-02 return partial:** return **60** to CASH → CASH +60, receivable **40**.
- **T-UDH-03 clear:** return **40** → receivable 0, status CLEARED.
- **T-UDH-04 unsaved person:** counterparty stored as free-text `person_name` with `party_id` NULL (no party row required).
- **T-UDH-05 void give:** voiding a give restores CASH and the receivable.

### 9. Regression / integrity
- **T-REG-01 append-only:** no UPDATE/DELETE on `transactions` except the `is_void` flag; corrections are reversals.
- **T-REG-02 FK integrity:** deleting a plot with transactions is blocked or cascades per chosen rule (assert).
- **T-REG-03 reconciliation:** in the full E2E scenario (§Verification), dashboard total == accounts sum == Σ ledger; project cost == plot+construction+sale; settlement payouts + donations + returned capital == revenue.

Implementation note: §1–8 business-logic tests live in `src/db/tests.ts` as assertion functions (extend the
existing self-test harness); §2 entry field-assertions and §Verification double as the manual QA checklist.

## Notes / risks
- Reworking `transactions` (nullable `project_id`, drop `mode`, add account/plot/phase) touches every writer/reader —
  do it in Phase A/B with `tsc` as the guardrail; it's a clean-rebuild so no data migration needed.
- Labor double-count: accrued wage is the construction cost; the cash **payment** to a worker must be excluded from
  construction-cost sums (settle it against the labor balance only).
- Donation only on positive profit; loss → capital-ratio split, no donation (matches the Musharakah loss rule already locked).
- Keep append-only ledger + void-by-reversal; account balances are always derived (never stored), so corrections stay consistent.
