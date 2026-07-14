# TameerBook — Improvements & Validation Plan

A single, ordered plan covering (a) the ease-of-use findings from the full UX
audit and (b) new **validation checkpoints** that stop bad/duplicate data and
make the app safer to use. Implemented **step by step**; each item is checked
off as it lands and verified (`tsc` + `vitest` + drive the flow).

**Legend:** effort **S**/**M**/**L** · status ⬜ todo · ✅ done · ⏸ deferred
· 🟢 already exists in code (no work).

> **Deferred at user's request:** the "6 quick wins" batch (Home expenses
> tile, mark-all-present, remember last account/category, tap-recent-to-edit,
> Reports tile, amount quick-chips) is **not** implemented now. Listed at the
> bottom so nothing is lost — can be switched on anytime.

---

## Phase 1 — Validation checkpoints (data safety) ← START HERE

Follows the existing pattern: a typed error in the repo → an `is<Error>()`
helper → a branch in `useSaveAction` → a translated alert (en + ur). Repo-pure
rules get a `vitest` test.

### 1.1 One-time payments (the token/bayana rule)
- ✅ **V-8 Token payable once per plot** — — a plot deal can have exactly one
  TOKEN payment; a second is blocked. `addPlotPayment` in
  [plots.ts:155](src/db/repositories/plots.ts#L155).
- ✅ **V-9 Bayana payable once per plot** — same rule for BAYANA (`assertPayTypeUnused`).
- ✅ **V-10 Buyer-side token/bayana once** — — on a plot *sale*, the buyer's
  TOKEN/BAYANA receipt is also one-time. `addPlotSaleReceipt`
  [plots.ts:334](src/db/repositories/plots.ts#L334).
- ✅ **V-11 Project-sale token/bayana once** — guard in `addSaleReceipt` + the
  used pay-type chips are hidden on SaleDetail (like the plot sheets).
- Decision: FINAL treated as one-time too? (Recommended yes; INSTALLMENT stays
  unlimited.) → default **TOKEN + BAYANA once** now; FINAL optional.

### 1.2 Amounts & money limits (mostly already present — fill gaps)
- 🟢 Seller never overpaid beyond deal remaining (`LimitExceededError`).
- 🟢 Buyer never pays more than sale outstanding.
- 🟢 Delivery qty ≤ booked remaining; supplier paid ≤ pay-remaining.
- 🟢 Investor received ≤ pledge; project stake ≤ cap.
- 🟢 Insufficient account funds blocked (`isInsufficientFunds`).
- ✅ **V-12 Every amount must be > 0** — audited; `giveUdhaar` guard added (the
  last gap); all other writers already threw on amount ≤ 0.
- 🟢 **V-13 Transfer: from ≠ to account, amount ≤ source balance** — already
  enforced (`transferBetween` guards from≠to & amount>0; OUT leg throws
  `InsufficientFundsError` on overdraw).
- 🟢 **V-14 Udhaar repayment ≤ outstanding; can't repay a CLEARED udhaar** —
  already enforced (`returnUdhaar` → `LimitExceededError`; a cleared udhaar has
  balance 0 so any repayment is blocked).

### 1.3 Labor
- 🟢 One attendance row per worker per day (`UNIQUE`, `isAttendanceConflict`).
- ✅ **V-15 Dihari rate must be > 0 before marking FULL/HALF** — `WageNotSetError`
  in `markAttendance`; alert `setWageFirst` (en+ur); DB test added.
- ✅ **V-16 No future dates** — the shared calendar disables days after
  `maxDate` (default today) everywhere, so future-dated entries can't be picked.
- ✅ **V-17 Can't mark attendance for a worker removed from the project** —
  `WorkerInactiveError` in `markAttendance`; alert `workerInactive`. (Paying an
  inactive worker stays allowed — you may still owe them.)

### 1.4 Bookings / material
- 🟢 **V-18 Can't add delivery/payment to a CLOSED booking** — implicit: a
  booking is CLOSED only when qty-remaining AND pay-remaining are both 0, so any
  further delivery/payment already trips `LimitExceededError`.
- ✅ **V-19 Booking qty > 0 and rate ≥ 0 on create** — already enforced in
  `createBooking`.

### 1.5 Investors / projects
- 🟢 Closed/cancelled project is read-only (`ProjectClosedError`).
- ✅ **V-20 Can't exit an already-EXITED/SETTLED investor** — `InvestorAlreadyExitedError`
  in `exitInvestor`; alert `investorAlreadyExited`.
- 🟢 **V-21 Can't add the same investor to a project twice** — already handled:
  `attachInvestorsToProject` drops investors already ACTIVE on the project.
- ✅ **V-22 Profit % between 0 and 100** — range guard in
  `setProjectInvestorProfitPct`; alert `profitPctRange`. (Sum-of-stakes ≤ 100%
  is left to the exit engine, which redistributes to keep the pool at 100%;
  hard-blocking mid-edit would be too aggressive.)

### 1.6 Plots / dates / names (global)
- 🟢 Can't sell a plot in a project standalone; SOLD is terminal; plot in a
  project can't be re-offered.
- ✅ **V-23 Deal price ≥ 0 / sale price > 0** — `createPlot` rejects a negative
  deal price; `setPlotSale` already requires a positive sale price.
- ⏸ **V-24 Transfer deadline after purchase date** — deferred: there's no stored
  purchase date to compare against, and the deadline is already surfaced as a
  Home warning when near/overdue. Revisit if a purchase-date field is added.
- ✅ **V-25 Names required & trimmed** — now enforced in `createCompany` &
  `addAccount` (existing) plus `addInvestor`, `addParty`, `addLaborer`,
  `createPlot` (trimmed before insert, empty rejected).
- 🟢 Double-submit blocked (`saving` disables the button in `useSaveAction`).

---

## Phase 2 — Labor UX
- ✅ Today's status pill on each worker card (FULL/HALF/ABSENT or "Not marked
  today"); `listProjectLaborers` now returns `todayStatus`.
- ✅ Pay a worker from the Labor home — "Pay" button in the accordion opens the
  shared `PayWorkerSheet` (hoisted to `LaborScreen`).
- ✅ Sort workers you owe to the top (largest balance first).
- ✅ Payment account defaults to the first/only account (`PayWorkerSheet`).
- ⏸ Consolidate the two worker UIs onto one pattern (M) — deferred: large
  refactor, high risk, low direct user value.

## Phase 3 — Material UX
- ✅ "Total owed to suppliers" + "Open bookings" summary cards on BookingsScreen.
- ✅ Unit quick-chips (bori/bag/ft/kg/truck/adad) on New Booking.
- ✅ Back-dating deliveries + supplier payments (DateField, capped at today).
- ✅ Pay-booking account defaults to the first/only account.
- ✅ Rapid-log: Material entry stays open after save (item fields reset, project/supplier/account kept, saved toast).
- ✅ "Also paid now" toggle on Add-Delivery — one sheet records receive + pay (amount capped, account default, live validation).
- ✅ Direct total: the Material total is now an editable amount (auto from qty×rate, typed override allowed; editing qty/rate recomputes).

## Phase 4 — Navigation & Home (excl. deferred items)
- ✅ Long-press "+" FAB → straight to the expense form.
- ✅ Company name/avatar opens the switcher (when there's more than one firm).
- ✅ Distinct icon for Udhaar (ledger) vs Investor tile.
- ❌ "+ Add account" card in Home rail — **skipped per user**: accounts are added
  from Settings only.
- ❌ Show Labor/Udhaar summaries by default — **reverted per user**: extras stay
  off by default.
- ✅ Lateral shortcut row — `HubShortcuts` pills under the header on Cash /
  Labor / Bookings jump between the hubs in one tap (`replace`, shallow stack).

## Phase 5 — Projects / plots / investors clarity
- ✅ Relabel cost-card "Sale" → "Sale costs" (gold, not green) + hide when 0.
- ✅ New investor with 0 pledge now shows a hint instead of silently vanishing.
- ✅ Wizard "profit share" guidance is now accurate — the per-investor profit %
  field exists (Phase 8B), so the copy matches reality.
- ✅ "New plot" from the wizard now returns to the wizard and **auto-selects**
  the just-created plot (`returnAfterCreate` param + known-ids diff on focus).
- ✅ Cost card shows **Received** (buyer money) + **Net so far** (green/red)
  once any sale receipt exists — answers "did I make money" at a glance.
- ✅ Plainer investor labels: "Total they will invest (pledge)" · "Paid now
  (cash received)" · "Amount in this project" (en + ur).

## Phase 6 — Settings / onboarding
- ❌ Label under the Home Settings gear — **reverted per user** (icon only).
- ✅ Distinct icons for Language / Font (type) / Text size (A-large-small).
- ✅ EN / اردو toggle in the onboarding top bar — switches language live
  (reloads for the RTL flip when picking Urdu).
- ✅ Settings split into **Go to** (Company/Accounts/Reports/Categories) and
  **Preferences** (Language/Dark/Font/Text size/Version) cards with headers.

## Phase 7 — App-wide
- ✅/⏸ Search: a `SearchBar` filters Workers / Plots / Investors (shows only when
  the list grows past 5). Transactions search **skipped per user** for now.
- ✅ **Empty states centre in the visible page** — `EmptyState` + `LoadErrorState`
  take a `bottomInset`; the tab screens (Projects/Plots/Investors) pass the
  floating tab-bar clearance so content sits in the middle of
  (page − header − tab bar), not behind the bar. Stack screens (no tab bar) were
  already centred by header-only layout.

## Phase 8 — Form data completeness (fields missing from forms)
The data model often supports fields the form never asks for (e.g. New Plot
doesn't capture **plot size**, though `plots.size_value/size_unit` exist and
`createPlot` accepts them). A full per-form audit (every input vs schema/repo)
is running; this section is filled from its results. Fix = add the missing
inputs so users can record the full picture.
- ✅ **Plot size now shown** — the New Plot form already *collected* size; the
  gap was display. Size (value + unit) now appears on the Plots card, the plot
  detail header ([PlotDetailScreen:247](src/screens/PlotDetailScreen.tsx#L247)),
  and the Home plot rows. Added shared `SIZE_UNIT_LABEL_KEYS` in schema.

### 8A — Data captured but never shown (fix the display) ✅ DONE
Phone numbers are shown via a new **`PhoneChip`** — tap dials (`tel:` via core
`Linking`, no new dep), long-press confirms. Used everywhere a phone appears.
- ✅ **Worker phone** — clickable chip on the worker khata (`LaborerDetailScreen`)
  and the Labor-home accordion (`WorkerAccordion`).
- ✅ **Investor phone + CNIC** — clickable phone on the profile + the list card;
  CNIC in the profile header subtitle.
- ✅ **Plot seller name / phone** — shown on the plot detail; phone is clickable.
- ✅ **Booking's project** — `BookingSummary.projectName` added; shown on the
  booking card and detail subtitle.

### 8B — Model supports the field, form doesn't collect it
- ✅ **Edit Plot screen** ⭐ — new [EditPlotScreen](src/screens/EditPlotScreen.tsx)
  on top of the existing `updatePlot`; reached via a pencil action on the plot
  detail header (hidden when the plot is sold / project closed). Plots are no
  longer immutable after creation.
- ✅ **Plot transfer deadline** ⭐ — the Edit Plot screen sets/clears the
  transfer deadline, which drives `listTransferDeadlines` → the Home reminder.
  Previously nothing wrote it, so the reminder never fired. (Follow-up: a "mark
  transfer complete" action to set `transfer_date`; for now clearing the
  deadline removes the reminder.)
- ✅ **Per-investor profit %** ⭐ — the stake sheet now has an editable "Profit
  share %" per investor (defaults to the Settings %, shows the capital-share as
  a hint), replacing the old behaviour where the shown % and the saved % didn't
  match. Flows through the New Project wizard and Project Detail attach flows.
  (Follow-up: also editable later via `setProjectInvestorProfitPct`, still
  unused from any screen.)
- ✅ **Investor bank details** — input in the person sheet, `UpdateInvestor` now
  accepts `bankInfo`, shown on the investor profile.
- ✅ **Project start date in the wizard** — DateField on step 1, fed to
  `createProject`.
- ✅ **Worker CNIC + photo** — optional CNIC in both add-worker forms; tappable
  avatar with camera badge on Add Worker; photo shows on the khata.
- ✅ **Udhaar note + party link** — note on the form; person can be picked from
  saved parties (links `party_id`; typing a custom name unlinks).
- ✅ **Booking notes + supplier party link** — notes on Add-Delivery/Pay-Booking;
  New Booking can pick a saved supplier (links `party_id`).
- ✅ **Entry phase/section picker** — when a project is chosen, a Plot /
  Construction / Sale / General chip row sets the phase (defaults Construction),
  so project expenses land in the right cost bucket. Shared `PHASE_LABEL_KEYS`.
- ✅ **Account color** — optional color dots on the add-account form; the
  account card's icon chip wears the chosen color. (Icon picker skipped — the
  type icon already communicates bank/cash/wallet.)

### 8C — Not in the model yet, worth adding
- ✅ **Sale receipt proof photo** — BOTH sides: standalone plot sale (Sell sheet)
  and project sale (SaleDetail receipt modal) capture a proof photo.
- ✅/⏸ **Buyer party link** — project-sale deal can pick a saved BUYER party
  (links `sales.buyer_party_id`). Plot-buyer phone/CNIC ⏸ (needs a plots-table
  migration; buyer stays free text there).

---

## Review corrections (from user feedback on the batch)
- ✅ **Per-investor profit % reverted** — profit share is one project-wide %
  from Settings, applied to all investors (not per-investor). *(Future: let
  Settings set it project-wise — noted in Phase 9 territory.)*
- ✅ **Transfer deadline on the New Plot screen too** (was edit-only).
- ✅ **Attendance chips show the tapped choice instantly** (optimistic state,
  reverts if the write is blocked).
- ✅ **Investor edit via a pencil** on the profile header (not long-press).
- ✅ CNIC has no "optional" label (already just the field; stays optional).

### Design polish — ✅ DONE
- ✅ New **ContactRow** (full-width): phone + CNIC on one row with a **Call**
  button; used on investor profile, worker khata, plot seller.
- ✅ Plot **seller** shown under a divider + "Seller" label (separated from cost).
- ✅ Plot **size** shown as its own gold pill on the Plots card.
- ✅ Investor **bank = pick from existing accounts** (SelectSheet, no typing).
- ✅ Investor **photo = tappable avatar** with a camera badge (no separate button).

### Validation UX rework — ✅ DONE
- ✅ **Hide disallowed pay types**: once Token/Bayana is paid it's removed from
  the pay-type choices (seller side on the plot, buyer side on the sale).
- ✅ **Inline real-time errors, not popups**: `AmountInput` gained an `error`
  prop (red border + message below). Wired live across **every** money-limit
  input — plot pay/expense, sale receipt, pay-booking, pay-worker,
  entry (expense), transfer, udhaar give/return, investor payment/received,
  exit portion. Errors update as you type; the popup only remains as a
  last-resort backstop.

## Phase 9 — Settings-managed categories (✅ Phase 1+2 BUILT)
**Unified model (per user):** materials ARE categories. "Materials" is a main
heading; Cement/Sariya… are its sub-categories. Same for "Home Expense" etc.
No separate materials table — one category tree. Units = a **default unit per
material** sub-category (no units manager).

- ✅ **Migration 14** — `categories` gains `is_system` (locks business cats) +
  `default_unit`; parent index; system backfill; existing installs get material
  categories grouped under a new "Materials" heading with default units. Fresh
  installs seed the full tree (`DEFAULT_CATEGORIES` now hierarchical).
- ✅ **Repo** — `addCategory`/`updateCategory`/`deleteCategory` (with
  `CategoryInUseError`: blocked if it has entries or sub-categories, or is
  system) + `listCategoryTree` + `listSubcategories`.
- ✅ **Settings → Categories** manager screen: Expense/Income segments, main
  headings each with add-sub, edit/delete (system rows locked 🔒), default-unit
  field for material subs.
- ✅ **Entry grid** now shows only bookable **leaf** categories (headings hidden).
- ✅ **New Booking** picks the material from the managed list (sub-categories of
  "Materials") and auto-fills its default unit.
- ✅ In-app DB test `T-CAT` covers create/tree/in-use guard/rename/system-lock.
- ✅ **Suggestions per section** — each heading shows tap-to-add preset chips
  (Materials → Cement/Sariya/Gravel/Steel…, Home Expense → Groceries/Rent/School
  Fees…, etc.) for options it doesn't have yet.
- ✅ **Drag-to-reorder** (long-press + drag, like moving app icons):
  - Quick Entry tiles — replaced the ‹ › arrows with a reanimated sortable grid.
  - Category sub-lists — a reusable `SortableList`; order persists via a new
    `sort_order` column (migration 15) + `reorderCategories`.
- ✅ MaterialEntry now picks from the managed Materials list (done in Phase 10).
- ⏸ Per-category usage sort + a managed units list — deferred by design
  (default unit per material covers the need).

### Original research plan (reference)
Full grounded plan captured (schema already has `parent_id`; needs `is_system`
+ index via migration 14; new `materials`/`units` tables via migration 15;
delete guards mirror the investor "in use" pattern; a Settings "Categories &
Materials" manager screen; entry screens switch to managed pickers).
**Recommended build order:** Phase 1 = category add/delete from Settings
(smallest, additive migration) → Phase 2 = main/sub hierarchy → Phase 3 =
materials + units tables and pickers. Categories are currently **global** (no
`company_id`) — per-company would be a bigger change. *Awaiting your go-ahead
to build Phase 1.*

## Phase 10 — Unified Quick Entry (every entry type, one page, Settings-driven)

**Goal.** Quick Entry covers ALL entry types; every category anywhere comes from
Settings → Categories; each entry modal is simple and consistent. One
write-path per money type (no duplicate ways to record the same rupee).

**Research base:** the full flow map (§ agent audit) found — income grid shows
only "Other Income" (real income categories are system-locked); investor money
has 3 inconsistent paths; buyer money 2 paths; "Plot Sale" leaks unlocked;
Ghar-ka-Kharcha prefills a heading the grid can't show.

### 10.1 Foundation — lock business categories ✅ DONE
- `categoryIdByName(..., system)` marks lazily-created business categories
  `is_system=1`; all 9 business callers pass `true`.
- Migration **16**: backfills `is_system=1` for `Plot Sale` + the two structural
  headings `Materials` / `Home Expense` (their exact names are looked up by the
  material picker and the Ghar tile — renaming would break flows).
- `SYSTEM_CATEGORY_NAMES` += `Plot Sale`, `Material Booking` (name-filter safety
  net for the entry grid).

### 10.2 Quick Entry — Payment In hub (replaces "Aamdani") ✅ DONE
Tile keeps key `aamdani` (order persistence) but label becomes **Payment In**.
Tap → a chooser sheet (SelectSheet): "Where is this money from?"
1. **Investor** → `Investment` screen (writes capital ledger correctly).
2. **Project sale (buyer)** → project picker (ACTIVE, has/creates sale) →
   `SaleDetail { projectId }` (sale_receipts + Buyer Receipt txn).
3. **Plot sale (buyer)** → plot picker (standalone, not SOLD, no project) →
   `PlotDetail { plotId }` (sell/receipt actions live there).
4. **Udhaar return** → `Udhaar` list (pick the person → return).
5. **Other income** → `Entry { direction:'IN' }` (managed INCOME leaves;
   user can add their own income categories in Settings — suggestions exist).
Design: reuse `SelectSheet` with icons + subtitles; back returns to the chooser
page (tiles push).

### 10.3 Quick Entry — Booking tile ✅ DONE
New tile `booking` → `Bookings` (order-ahead flow), alongside `material`
(buy-now). Added to `TILES` + `DEFAULT_QUICK_ORDER` (merge logic auto-appends
for existing users). Distinct icons (material vs ledger/truck).

### 10.4 Ghar-ka-Kharcha scoping fix ✅ DONE
The tile currently prefills the **heading** id, which the leaf-only grid never
shows (mismatch). Fix in `EntryScreen`: when the prefilled category is a
parent, **scope the grid to its children** and leave selection empty (title
stays "Ghar ka Kharcha" context); when it's a leaf, preselect as today. This
makes the tile = "home expense entry with home sub-categories only".

### 10.5 Modal consistency pass ✅ DONE (audited; fixed the two holdouts — project-sale receipt & investor payment now have back-datable DateFields; all other modals already complied)
Every money modal follows one layout, top→bottom:
**target (project/plot/investor if any) → category/type chips → amount
(inline validation) → account (default) → date (back-datable) → note/photo →
Save.** Verify each against this: Entry, MaterialEntry, NewBooking,
Pay sheets, SellPlot, SaleDetail, Investment, Udhaar. Fix deviations (most
already comply from earlier batches; this is an audit + small nudges).

### 10.6 Consistency notes (follow-ups, not this build)
- Investor `addInvestorPayment` writes no capital-ledger row (pledge top-ups) —
  intentional difference from `addInvestment`; revisit if reports need it.
- Udhaar/Transfer stay category-less (excluded from income/expense reports by
  design).

## Phase 11 — Context-correct categories + Settings-managed statuses ✅
- ✅ **Category scoping fixed** — plot expense = Plot-heading subs + stand-alone
  leaves; construction = Materials + Labor subs + stand-alone leaves; Home
  Expense subs (Groceries…) never leak into other pages. Migration **18**
  completes the tree on existing installs (Labor/Plot/Sale headings, locked).
- ✅ **Verified**: every picker keeps the Settings drag-order (sort_order, no
  re-sorts) and Material entry / New Booking / Construction share the same
  managed Materials list.
- ✅ **Statuses from Settings** (migration **19**): a `stages` table (PROJECT /
  PLOT modules, seeded: Planning, Under Construction, Finishing, Ready for
  Sale · Transfer Pending, Possession, Ready to Sell). Settings → **Statuses**
  manager (add/rename/delete-with-in-use-guard, drag-reorder). Tap the status
  pill on Project detail / Plot detail to set it; the label shows on the
  project & plot cards (falls back to the lifecycle badge when unset).

## Deferred (the "6 quick wins" — user opted out for now)
1. ⏸ Expenses-by-category tile on Home.
2. ⏸ "Mark all present" bulk attendance.
3. ⏸ Remember last account + category on entry.
4. ⏸ Tap a Recent-Activity row to edit it.
5. ⏸ Reports tile on Home.
6. ⏸ Amount quick-chips (10k/50k/1 Lakh).
