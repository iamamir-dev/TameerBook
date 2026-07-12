# TameerBook — Project Module Specification & Fix Plan

This is the complete specification of the **project module**: every use case with its
edge cases, every validation with the layer that enforces it, the UX/UI improvement
plan, and the implementation phases. It is written against the current codebase and
is the contract for the rework.

**The core model (unchanged):** a *project* = an included *plot* + *construction*
(expenses + labor) + a *sale*, funded by *investors* (Musharakah) and the owner.
Accounts are the source of truth for cash; the `transactions` ledger is append-only.

---

## 1. Project lifecycle

```
                       ┌──────────── settle (sale fully received) ────────────┐
                       │                                                      ▼
  create ──► ACTIVE ───┼──── mark completed (manual, confirmed) ─────►  COMPLETED
                       │                                                      │
                       └── everything happens here: plot, investors,          └─ read-only:
                           construction, labor, sale receipts                    summary + ledgers
```

- **ACTIVE** — the only state where money can move: attach plot/investors, record
  expenses, mark attendance, receive sale money.
- **COMPLETED** — reached two ways:
  1. **Settlement** (the full path): sale fully received → profit/loss computed →
     distributed to investors per profit % (loss by capital ratio) → donation taken →
     capital returned → participations `SETTLED` → project `COMPLETED` → plot `SOLD`.
  2. **Manual "Mark completed"** (new): for projects that end without a settlement
     (kept the building, sold outside the app, abandoned). Requires confirmation.
     No capital movement — the summary simply freezes.
- `ON_HOLD` / `CANCELLED` exist in the schema but are **not exposed**; they stay
  reserved for a future release (wiring them now adds states without user demand).
- A COMPLETED project is **read-only**: every mutating action is blocked at the
  repository layer (not just hidden in the UI).

---

## 2. Use cases (with edge cases)

### UC-1 Create a project
**Main flow:** Projects tab → "+" → wizard: (1) name + optional plot → (2) optional
investors → (3) review → Create. Project starts ACTIVE with the 9 default milestones.

| # | Edge case | Behavior |
|---|-----------|----------|
| 1.1 | Empty / whitespace name | Create disabled (exists) |
| 1.2 | No plot chosen | Allowed — plot can be added later (UC-2) |
| 1.3 | No investors chosen | Allowed — owner-funded project; review step says so explicitly |
| 1.4 | Plot got taken by another project while the wizard was open | Repo guard throws typed `PlotUnavailableError`; wizard shows a specific message and refreshes the plot list |
| 1.5 | App killed mid-create | Project + milestones + plot link + investors commit in **one transaction** — either everything exists or nothing does |
| 1.6 | Duplicate project names | Allowed (real businesses reuse names); the card shows the start date to disambiguate |

### UC-2 Include a plot
**Main flow:** at creation (UC-1) or later from Project Detail → "Add plot" → picker
shows **only OWNED plots** → link. Linking backfills the plot's transaction history
into the project (plot cost becomes project cost).

| # | Edge case | Behavior |
|---|-----------|----------|
| 2.1 | Plot already in another project | Never shown in any picker (status filter) **and** blocked by `PlotUnavailableError` at the repo (belt and suspenders) |
| 2.2 | Project already has a plot | "Add plot" hidden; one plot per project |
| 2.3 | No free plots exist | Empty state with a "New plot" button that returns to the picker |
| 2.4 | Plot has prior payments/expenses | They are backfilled onto the project — project cost includes them immediately |
| 2.5 | Removing a plot from a project | **Not supported** (history is entangled); documented limitation |
| 2.6 | Project settles | Plot flips to **SOLD** (new) — it can never be offered again |
| 2.7 | Project completed manually (no sale) | Plot stays IN_PROJECT with its completed project — still never offered |

### UC-3 Include investors (the capacity model — new)
Every investor has a **global pledge** (`committed_amount`). Their **capacity** is:

```
staked(investor)    = net capital across ALL their participations (capital ledger)
remaining(investor) = pledge − staked        (never below 0)
```

Because settlement/exit return capital (EXIT_SETTLEMENT entries), a settled project
**automatically frees the investor's capacity** for the next project.

**Main flow:** wizard step 2 or Project Detail → "Include investors" → sheet lists
only investors with `remaining > 0`, shows *"Invested Rs X · Rs Y left"* per investor
→ enter each stake (pre-filled with remaining, clamped to it) → confirm. One atomic
write: participation + INITIAL capital per investor.

| # | Edge case | Behavior |
|---|-----------|----------|
| 3.1 | Investor has nothing left (`remaining = 0`) | **Not shown** in the include list |
| 3.2 | Investor has no pledge set | Not shown; the empty-state hints to set a pledge on the investor first |
| 3.3 | Stake > remaining | Input clamps live; repo throws `LimitExceededError` as backstop |
| 3.4 | Same investor staked in 2 projects | Fine — as long as Σ stakes ≤ pledge (e.g. pledge 50L: 30L in A leaves 20L max for B) |
| 3.5 | Investor already in THIS project | Filtered from the list **and** silently skipped by the repo (stale-state race) |
| 3.6 | Attach to a COMPLETED project | Blocked at repo (`ProjectClosedError`) |
| 3.7 | Stake of 0 | Participation created, no capital entry (committed-only partner) |
| 3.8 | Project A settles | Capacity returns automatically (see model above) |

### UC-4 Record investment cash received (`addInvestment`)
Money the investor actually hands over, landing in an account.

| # | Edge case | Behavior |
|---|-----------|----------|
| 4.1 | First cash for a project with no participation | Participation auto-created (exists) |
| 4.2 | Cash > commitment | Commitment auto-raises (exists, documented) — the app never blocks real money arriving |
| 4.3 | Transaction not linked to the investor | **Fixed:** the IN transaction now carries `investor_id`, so the investor's global "received" reconciles with reality |
| 4.4 | Project completed | Blocked (`ProjectClosedError`) |

### UC-5 Construction expenses
**Main flow:** Construction screen → "Add expense" → amount + **category (now
required)** + account + note → save (posts an OUT transaction, phase CONSTRUCTION).

| # | Edge case | Behavior |
|---|-----------|----------|
| 5.1 | No category chosen | **Save disabled** (was optional — uncategorized rows silently vanished from the construction total) |
| 5.2 | Amount > account balance | Blocked (`InsufficientFundsError`, exists) |
| 5.3 | Legacy uncategorized rows | Breakdown query now LEFT-JOINs and buckets them as "Other" — construction total always equals project-cost total |
| 5.4 | Material purchases via quick entry | Post with their material category; appear in the same ledger |
| 5.5 | Wrong entry | Void it (reversal row) — ledger is append-only |

### UC-6 Labor (separate section — new)
**The khata belongs to the worker, not the project.** A worker can be attached to
many projects (each with its own daily wage) but can only earn **one dihari per day**
across all of them.

**Main flows:**
- **Labor home** (new screen): every worker with *earned / taken / balance* across
  all projects. Tap → worker khata.
- **Worker khata** (new screen): per-project wage cards, combined attendance +
  payment history, "Pay" action.
- **In a project** (Construction screen, kept): attach worker, mark today's
  attendance, quick-pay — the daily-driver flow stays where the work happens.

| # | Edge case | Behavior |
|---|-----------|----------|
| 6.1 | Worker marked FULL/HALF on project A, then marked on project B same day | **Blocked** — typed `AttendanceConflictError`; UI says which project already has them |
| 6.2 | Marking ABSENT on B while FULL on A | Allowed (absence is a note, not an earning) |
| 6.3 | Re-marking the same day on the same project | Upsert — replaces, never duplicates (exists) |
| 6.4 | Pay more than the balance owed | **Blocked** (`LimitExceededError`) — was previously possible |
| 6.5 | Same worker attached to a project twice | Active row reused (exists); an INACTIVE row is **re-activated** with the new wage instead of inserting a duplicate |
| 6.6 | Wage changed mid-project | Applies to future attendance only; past accruals are snapshots (exists) |
| 6.7 | HALF day on an odd wage (e.g. 1501) | Accrues 750.5 — display rounds, ledger keeps the exact value |
| 6.8 | Worker removed from a project | Soft-deactivated; history and unpaid balance remain visible in their khata |
| 6.9 | Paying from the khata (multi-project worker) | Payment is per project-participation (it books to that project's cost); the khata shows the per-project balances so the user picks where to pay |

### UC-7 Sale
Existing flow (deal → receipts → costs). Relevant edge cases already guarded:
over-receipt beyond agreed price (`LimitExceededError`), receipt+cash atomicity.
**New:** the sale card shows "Rs X remaining from buyer" as the settle-readiness hint.

### UC-8 Investor exit (existing wizard)
Five scenarios (partner buy / new investor / owner buy / partial / committed-unpaid),
math now pure + unit-tested. Capacity: an exit **frees** the leaver's capacity.

### UC-9 Settlement
**Main flow:** Project Detail → Settle (only when sale fully received) →
**confirmation dialog (new)** → profit/loss distributed, donation, capital returned,
project COMPLETED, plot SOLD (new) → PDF offered **after** the commit (decoupled —
a share failure can no longer look like a failed settlement).

| # | Edge case | Behavior |
|---|-----------|----------|
| 9.1 | Loss project | Loss distributed by capital ratio incl. owner (exists, tested) |
| 9.2 | Donation % set | Deducted per party before payout (exists, tested) |
| 9.3 | Settle button conditions unmet | Button visible but **disabled with the reason** ("Buyer still owes Rs X") instead of invisible |
| 9.4 | Double settle | Blocked — project no longer ACTIVE |
| 9.5 | PDF share fails after settle | Settlement stays committed; user sees the summary and can re-share from the detail screen |

### UC-10 Mark completed (new) + completed project
**Main flow:** Project Detail → overflow "Mark completed" → confirm → COMPLETED.

| # | Edge case | Behavior |
|---|-----------|----------|
| 10.1 | Unpaid labor balances exist | Warning listed in the confirm dialog (still allowed — real projects end messy) |
| 10.2 | Sale partially received | Warning in the confirm dialog with the outstanding amount |
| 10.3 | After completion | Read-only project: all mutating repo calls throw `ProjectClosedError`; UI hides the affordances. The detail page shows **only the settlement summary** (the project's final story) plus a **"Show project details"** toggle that reveals the phase cards / investors / gallery again (and "Hide details" to collapse) |
| 10.4 | Un-complete | Not supported in v1 (append-only philosophy); stated in the confirm dialog |

### UC-11 Progress — construction steps removed entirely
The construction "steps" / milestone checklist is **removed from the product**:
no seeding on new projects, no checklist anywhere, and it is **not** repurposed
as progress. The dead `StageFlow` / `StageTracker` / `ProgressCard` /
`MilestoneChecklist` components are deleted. The card progress bar is now a
**lifecycle** indicator derived from real phases — plot secured (25) → building
(50) → listed for sale (75) → sold/awaiting settlement (90) → completed (100) —
so it means something without any manual step-ticking.

### UC-12 Labor is company-level (not per-project)
Workers belong to the **company**, not a project: the Labor section is reached
from a **Home quick-link** (and the Dehari quick-entry tile), never navigated
*from* a project. Inside a project's construction screen only **that project's**
workers show (attach / attendance / quick-pay). Each worker's full **khata**
(the company-level worker detail) shows their per-project participation cards
*and* a unified company-wide history across every project.

### UC-13 Site photo gallery
Project Detail embeds a **styled photo gallery** card: a rounded thumbnail
preview grid with a "+N more" tile, an add-photo capture tile, a tap-to-zoom
lightbox, and a "See all" link into the full day-grouped Photo Diary. Photos are
`site_photo` documents; hidden capture on a completed (read-only) project.

---

## 3. Validation catalog

Layer legend: **R** = repository (throws, the source of truth), **U** = UI
(prevents/limits before the repo is hit), **D** = database constraint.

| ID | Rule | Layer | Error |
|----|------|-------|-------|
| V-1 | Plot in a project never appears in any plot picker | U (status filter) | — |
| V-2 | Linking a plot already in another project is impossible | R | `PlotUnavailableError` (typed, new) |
| V-3 | One plot per project | U + R | `PlotUnavailableError` |
| V-4 | Investor stake ≤ remaining capacity (pledge − staked everywhere) | U (clamp + filter) + R | `LimitExceededError` |
| V-5 | Investors with remaining = 0 hidden from include lists | U | — |
| V-6 | Same investor cannot hold two ACTIVE participations in one project | U (filter) + R (skip) | silently skipped |
| V-7 | No mutation on a COMPLETED project (attach investor/plot, expense, investment, attendance, sale receipt). **Exception:** paying a worker's remaining dues stays allowed — completing with dues is permitted (10.1), so the debt must remain payable | R | `ProjectClosedError` (typed, new) |
| V-8 | Worker earns at most one dihari per calendar day across all projects | R | `AttendanceConflictError` (typed, new) |
| V-9 | Worker payment ≤ balance owed on that participation | U (cap hint) + R | `LimitExceededError` |
| V-10 | Worker cannot be attached to the same project twice | R (reuse/reactivate) | — |
| V-11 | Construction expense requires a category | U (save disabled) | — |
| V-12 | OUT payment ≤ account live balance | R | `InsufficientFundsError` (exists) |
| V-13 | Buyer receipts ≤ agreed sale price | R | `LimitExceededError` (exists) |
| V-14 | Plot payments ≤ deal price | R | `LimitExceededError` (exists) |
| V-15 | Investor cash receipts ≤ global pledge | R | `LimitExceededError` (exists) |
| V-16 | Udhaar return ≤ outstanding | R | `LimitExceededError` (exists) |
| V-17 | Account names unique (case-insensitive) | R | `DuplicateAccountError` (exists) |
| V-18 | Settlement only when sale exists, fully received, project ACTIVE | U (disabled + reason) + R | plain error |
| V-19 | Settlement irreversible → explicit confirmation | U | — |
| V-20 | Manual completion → explicit confirmation listing loose ends (unpaid labor, buyer outstanding) | U | — |
| V-21 | Amounts must be positive everywhere | R (exists) + U (save disabled at 0) | plain error |
| V-22 | Multi-write operations are atomic (project+plot+investors, transfer, receipt+cash, settle) | R (transactions) | — |
| V-23 | Deleting an investor with any participation blocked | R | `InvestorInUseError` (exists) |
| V-24 | Deleting a plot with a project or transactions blocked | R | plain error (exists) |
| V-25 | `addInvestment` cash carries `investor_id` so global received reconciles | R | — (fix) |

---

## 4. UX / UI improvement plan

### Projects list (`ProjectsScreen`)
- Card stays: name, progress bar, cost so far, status badge. **New:** completed cards
  get a subdued "profit / loss" line from the settlement summary, so the list reads
  as a portfolio.
- Section split: **Active** on top, **Completed** collapsed below — active work is
  what the user opens the tab for.

### New-project wizard (`NewProjectWizard`)
- Step 2 (investors) header shows each candidate's *remaining* capacity, not the raw
  pledge; zero-capacity investors are absent (V-4/V-5).
- Review step explicitly states the two optional omissions: *"No plot — add one
  later"* / *"No investors — owner-funded"* so skipping is a visible choice, not an
  accident.
- Typed plot-conflict error (1.4) shows *"This plot was just added to another
  project"* and refreshes the list, instead of a generic failure.

### Project detail (`ProjectDetailScreen`) — the hub
- **Progress card (new placement):** milestone checklist moves here from
  construction, with the % shown in the header (it was invisible on detail before).
- **Status actions (new):** overflow menu → "Mark completed" (confirm dialog, V-20).
- **Settle affordance (changed):** always visible once a sale exists; disabled with
  the concrete reason until ready (V-18) — no more invisible dead-end.
- **Add plot later (new):** the "no plot" card gains an "Add plot" action opening the
  OWNED-plot picker (was a dead link to the Plots tab).
- **Completed mode:** green banner (exists) + summary card pinned to top + all
  mutating affordances hidden.

### Construction (`ConstructionDetailScreen`)
- **Stages removed** — the milestone checklist leaves this screen (UC-11).
- Ledger rows always show a category label; the empty ledger shows a proper empty
  message (was a blank card).
- Category breakdown includes an "Other" bucket for legacy uncategorized rows so the
  bars sum to the hero total (5.3).
- Labor section header gains **"All workers →"** linking to the Labor section.
- Expense sheet: category is required — tiles show a selected state, save stays
  disabled until amount + category + account are set (V-11).

### Labor section (new)
- **Labor home:** worker cards — name, *earned / taken / balance*, projects count.
  Entry points: quick-entry "Dehari" tile + "All workers" from construction.
- **Worker khata:** balance hero, per-project wage cards (with today's attendance
  quick-mark), unified history (attendance accruals + payments), Pay button with
  "owed Rs X" cap (V-9). Conflict alert names the other project (V-8).

### Settlement (`SettlementScreen`)
- **Confirmation dialog before committing** (V-19) — settlement is irreversible.
- **Decouple PDF from the commit:** settle first (one save action), then offer the
  share; a share failure never masks a successful settlement (9.5).
- After settling: return to the project detail in completed mode instead of a stale
  settlement form.

### Feedback everywhere
- Success toasts on the high-frequency saves (expense added, attendance marked,
  payment made) using the existing `useToast` — silence reads as failure.
- All destructive/irreversible actions (settle, mark completed) use explicit
  confirm dialogs; nothing irreversible fires on a single tap.

---

## 5. Implementation phases

- **A — Data layer** (repositories, typed errors, capacity/khata queries,
  plot SOLD on settle, category-total fix, `investor_id` on investments, i18n keys).
- **B1 — Labor section** (Labor home + worker khata screens, navigation, quick-entry
  tile, conflict/overpay wiring in construction sheets).
- **B2 — Project lifecycle UX** (mark completed, settle gating + confirmation +
  PDF decoupling, milestones→detail, stage components deleted, category required,
  empty states, add-plot-later).
- **B3 — Investor capacity UI** (InvestorSheet remaining/filtering, wizard copy).
- **C — Tests & verification** (in-app suite: capacity guard, attendance conflict,
  overpay guard, closed-project guard, plot SOLD; vitest for any pure logic; full
  tsc + suite run).
