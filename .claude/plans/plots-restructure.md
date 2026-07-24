# Plots Module — Restructure + Feature Plan

Module-by-module restructure (after Investors / Labor / Purchase Orders). Applies
all 8 restructure rules, folds in the features gated with the user, and optimizes
the module. Each phase is independently `tsc + vitest`-green and one commit.

## Current state (verified)

- `src/screens/PlotDetailScreen.tsx` **888 lines**, ~30 `useState`, two hand-rolled
  `Modal` bottom-sheets inline (seller-payment + expense).
- `src/screens/PlotsScreen.tsx` (list), `NewPlotScreen.tsx` / `EditPlotScreen.tsx`
  (near-identical 243-line forms — duplicated), `src/components/plot/SellPlotSheet.tsx`.
- Repo `src/db/repositories/plots.ts` (append-only; NO edit/delete of plot txns).
- All styles inline. None of it lives under `src/modules/`.

### Relationships (schema)
- `plots.project_id → projects.id` and reverse `projects.plot_id → plots.id`
  (`linkPlotToProject` also backfills `transactions.project_id`).
- `transactions.plot_id → plots.id`: seller payments (`PLOT`/OUT, cat "Plot Payment"),
  expenses (`PLOT`/OUT), standalone sale receipts (`SALE`/IN, cat "Plot Sale").
- `documents(entity_type='plot')` = plot docs; `documents(entity_type='transaction')` = receipts.
- `plots.stage_id → stages(module='PLOT')`.
- Standalone sale uses `plots.sale_price` + `plots.buyer_name` (NOT the `sales`/`sale_receipts`
  tables — those are project-only).
- Settlement/investor engine keys entirely off `project_id`
  (`project_investors.project_id NOT NULL`, `capital_ledger.project_investor_id`,
  `transactions.project_id`). `src/utils/settlementMath.ts` is pure/entity-agnostic.

### Rule violations to fix
1. Not in `modules/`; 888-line screen (rules 1). 2. Hand-rolled sheets + duplicated
account/receipt/pay-type UI instead of shared `AppSheet`/`MoneyEntrySheet`/`AccountPickerRow`;
inline category filter instead of the existing `useModuleCategories('plot')` (rule 2).
3. ~30 scattered `useState`; New/Edit form duplicated (rule 3). 4. Inline styles (rule 4).
8. Plot payments/expenses/receipts NOT editable/deletable (rule 8).

### Bugs / gaps found
- Voiding/deleting a standalone sale receipt does NOT revert `SOLD` → phantom SOLD.
- `seller_cnic` written by `createPlot` but no form field sets it (dead column).
- `PlotPaymentInput.note` supported by repo, never sent from UI.
- No way to mark a transfer complete → `listTransferDeadlines` (excludes `transfer_date IS NOT NULL`)
  never clears, so Home deadline reminders never dismiss.
- `listPlotSummaries` is N+1 (per-plot 3-query summary).

---

## Phase 0 — Module scaffold + lift-and-shift (no behavior change)
- Create `src/modules/plots/{screens,components,hooks,utils,styled}` + `index.ts` barrel.
- Move the 4 screens + `SellPlotSheet` into the module (paths only; no logic change).
- Update `RootNavigator.tsx` imports to `@/modules/plots` (screens already registered in `types.ts`).
- `tsc + vitest` → commit.

## Phase 1 — Thin screens: hooks + components + styled (rules 1, 3, 4, 2)
Hooks (`useFocusData`/`useSaveAction`):
- `usePlotsList.ts` (list + PLOT stages, fixes N+1 with one aggregate summary query).
- `usePlotDetail.ts` — consolidates the ~30 `useState`: one `useFocusData` for page data +
  one `useReducer` for sheet/form state.
- `usePlotForm.ts` — shared New/Edit form state (kills the 243-line duplication).

Components (each with `styled/<Name>.styles.ts`):
- `PlotCard`, `PlotHeroCard`, `PlotSellerCard`, `PlotSaleCard`, `PlotDocsGrid`, `PlotFormFields`.
- `SellerPaymentSheet` + `PlotExpenseSheet` rebuilt on shared `AppSheet` + `MoneyEntrySheet` /
  `AccountPickerRow` (replaces the two inline `Modal`s and dedupes with `SellPlotSheet`).
- Category picker → `useModuleCategories('plot')`; delete the inline `expenseCategories` filter.
- `tsc + vitest` → commit.

## Phase 2 — Edit / delete-in-place for every entry (rule 8)
Repo (mirror `updateBookingPayment` / `updateLaborPayment` → re-check cap, then
`applyTransactionPatch`; delete via `voidTransaction`):
- `updatePlotPayment` / `deletePlotPayment` (re-check `remaining`, freeing the row's own amount).
- `updatePlotExpense` / `deletePlotExpense`.
- `updatePlotSaleReceipt` / `deletePlotSaleReceipt` — re-check `saleOutstanding` **and**
  re-evaluate the SOLD flip, reverting `SOLD → OWNED` when it drops below full
  (fixes the phantom-SOLD bug).
UI: `TransactionDetailSheet` footer Edit/Delete → reopen the matching sheet in `editing` mode
(mirror `LaborerDetailScreen`). Add repo tests in `src/db/tests.ts`. → commit.

## Phase 3 — Settings-managed Plot categories (user requirement)
- "Plot" heading is already seeded (`cat-plot`) with leaves Plot Payment (system),
  Transfer Fees & Tax, Naqsha/Approval. Confirm Settings → Categories renders the Plot
  section and its leaves are the ONLY ones offered on the plot expense sheet
  (via `useModuleCategories('plot')` from Phase 1). Add module-heading grouping to
  `CategoriesScreen` if missing. No inline category lists remain. → commit.

## Phase 4 — Mark transfer complete + Seller CNIC + payment note (features)
- Repo `markPlotTransferred(plotId, date)` sets `transfer_date` → deadline reminder clears.
- Wire the unused `seller_cnic` into `updatePlot` + New/Edit form; expose the payment `note`
  field in `SellerPaymentSheet`.
- UI: "Mark transferred" action + a Transferred state pill on the detail hero. → commit.

## Phase 5 — Detailed Plot PDF report (feature)
- `hooks/usePlotReport.ts` builds a `ReportDoc` via `renderReportHtml` + native
  `Print.printAsync` (mirror `usePurchaseOrder` / the project report; A4, repeating
  thead pagination, signature footer — all provided by the shared engine).
- Sections: Plot info + size + seller; **Purchase** (deal price + seller-payment ledger);
  **Expenses** (by category); and — only for a **standalone** plot — **Sale** (buyer, price,
  receipts, profit) and **Investors & Settlement** (distribution table).
- A plot **inside a project** → PDF shows Purchase + Expenses only (sale/settlement belong
  to the project report), per the user's spec. → commit.

## Phase 6 — Investors + Settlement for standalone plot flips (largest feature)
Only for standalone plots (hidden once `project_id` is set — a plot in a project settles at
the project level, unchanged). **Design: make the participant layer polymorphic over a
"venture" (project OR plot)** — maximum reuse and, critically, a SINGLE investor capital
ledger so an investor's house balance / capacity / statement span projects AND plot flips as
one identity. This is why it beats parallel `plot_investors` tables (which would split every
investor rollup across two ledgers).

### 6a — Schema (migration v28)
- Rebuild `project_investors`: `project_id` nullable, add `plot_id TEXT`, CHECK
  exactly-one-of(project_id, plot_id), FK to plots; indexes on both.
  `capital_ledger` untouched (keyed by `project_investor_id`; ids preserved on copy).
- Add `settle_rule` / `settle_params` / `settled_at` to `plots` (mirror `projects`).
- One shared SQL helper for venture identity, used everywhere a name/status was read from
  projects: `LEFT JOIN projects pr ON pr.id = pi.project_id LEFT JOIN plots pl ON pl.id =
  pi.plot_id` → `COALESCE(pr.name, pl.name) AS ventureName`, `pi.plot_id IS NOT NULL AS isPlot`.

### 6b — Plot-side repos
- `investments.ts`: `addInvestment` / `investFromBalance` accept a discriminated target
  (`{projectId}` | `{plotId}`); the IN cash txn is tagged `plot_id` for a plot venture.
- `settlement.ts`: add `getPlotPnl` (revenue = Plot Sale receipts; expenses = paidToSeller +
  plot expenses; NO labor/Other-Income), `computePlotSettlement`, `settlePlot`,
  `getPlotSettlementSummary`, `getSettledPlotSettlement`. `settlementMath.ts` unchanged.
- `investors.ts`: add `attachInvestorsToPlot` (or generalize `attachInvestorsTo*`),
  `listPlotInvestors`, `getPlotInvestor`.
- Guards: investing/settling blocked once the plot joins a project; `settlePlot` marks it SOLD.

### 6c — Investor-module SYNC (so plot ventures aren't silently dropped)
Every INNER `JOIN projects` below currently EXCLUDES plot-linked participations — switch each
to the LEFT-LEFT venture-name pattern from 6a:
- `capital.ts` → `getInvestorProjectReturns` (feeds `ProjectReturnsCard` on the profile) and
  `listInvestorActivity` (the activity feed + investor statement/PDF): LEFT-join plots,
  coalesce `ventureName`, carry an `isPlot` flag. Also resolve the plot name for plot-tagged
  cash txns (its LEFT JOIN projects yields no name for `plot_id` rows).
- `investors.ts` → `listInvestorParticipations` (feeds the exit wizard + profile): LEFT-join
  plots + coalesce, so plot participations appear.
- Capacity rollups (`STAKED_SQL`, `getInvestorSummary` profit, `getInvestorTotalCapital`,
  `listInvestorsWithCapacity`, `listInvestorsWithCapital`) already key off `pi.investor_id`
  only → auto-include plot ventures, verify with a test.
- **Exit flow** (`exit.ts` / `useExitWizard`): once a plot participation shows in the wizard,
  the buyout must resolve co-investors by SAME venture — generalize its
  `WHERE project_id = ?` (exit.ts:179) to (project_id OR plot_id) of the leaver's `pi`.
- **Allocation** (`useAllocation` / `AllocationScreen`): add standalone plot ventures (open to
  investment, not yet settled) as deploy targets alongside projects.
- UI/i18n: `ProjectReturnsCard`, `investorActivity.ts` (line ~51 label), `useInvestorStatement`
  read a generic `ventureName`; add a plot glyph/label so a row reads as a plot, not a project.

### 6d — Plot-side UI
On standalone PlotDetail add an Investors (Musharakah) section + live settlement summary +
Settle action, **reusing** the shared `InvestorSheet` and settle-wizard components.

Repo tests for 6a–6c (incl. a mixed project+plot investor rollup). → commit(s).

---
Risk note: Phases 0–5 are low-risk and self-contained. Phase 6 carries a schema migration
(table rebuild) on the shipped offline DB and TOUCHES THE INVESTOR MODULE'S shared repos —
review most carefully; ship as its own PR after 0–5 land, and split 6a–6c / 6d if large.
