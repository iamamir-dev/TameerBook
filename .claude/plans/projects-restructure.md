# Projects Module — Restructure + Audit Plan

The central module (plot + construction + sale + settlement). Follows all 8
restructure rules + DESIGN_GUIDELINES (theme tokens only, AppText/t(), ≥56px
targets, ≤6 fields/step, one primary action, color=direction, light/dark by
tokens). Each phase is `tsc + vitest` green and one commit.

## Gate decisions (from the user)
- **Settlement stays owner-first** (builder % off the top → remaining profit by
  ownership → charity deducted per person). Keep the math; **redesign the wizard**
  so inputs = Builder work % + Charity %, with the ownership split shown derived.
  Remove the misleading editable "investors pool %".
- **Auto-derive project status** (like Plots) → remove user-managed stages
  entirely (Statuses screen, stages repo, Settings entry; stages table becomes
  dead — drop it; leave `stage_id` columns as harmless vestige).
- Features: full **project PDF report**, remove **dead milestones + fields**,
  **On-hold/Cancel** lifecycle, **optimize the projects list** (N+1 → aggregate).
- **Audit** design/validation/logic across the module and fix.

## Current state (verified via full map)
- 9 screens in `src/screens/`, none in modules; inline makeStyles; scattered
  useState + useFocusReload/useEffect (not useFocusData).
- God components: ProjectDetail (597/15 useState), SaleDetail (598/~25 + 3
  hand-rolled Modals), Settlement (664/~13 + hand-rolled Modal), Entry (577/~14).
- Shared already: `components/project/*` (Add-plot, PhaseCards, CostCard,
  Gallery, SummaryCard) + `components/construction/*` (AddExpenseSheet on
  AppSheet ✓, CategoryBars).
- Dead: `milestones` table (+ MilestoneRow, DEFAULT_MILESTONES, index),
  `sale_receipts.doc_id`, `sales.completed_at`/`completeSale`, Settlement no-op
  trailing lines.
- Perf: `listProjectSummaries` ~6 queries/project, called on every focus.

---

## Phase 0 — Scaffold + lift-and-shift (no behaviour change)
- `src/modules/projects/{screens,components,hooks,utils,styled}` + index.ts.
- git mv: ProjectsScreen, ProjectDetailScreen, ConstructionDetailScreen,
  SaleDetailScreen, SettlementScreen, NewProjectWizard, PhotoDiaryScreen,
  MaterialEntryScreen → screens/; `components/project/*` + `components/
  construction/*` → components/.
- (EntryScreen stays shared-entry in `src/screens/` — it's generic income/
  expense too — but its dup'd party-modal/toast get the shared components below.)
- Rewire RootNavigator + fix internal imports. tsc → commit.

## Phase 1 — Thin screens: hooks + styled + section components
- Hooks (useFocusData/useSaveAction): useProjectsList, useProjectDetail,
  useConstructionDetail, useSaleDetail, useSettlement, useNewProject.
- Move the 7 existing shared components into components/ + styled/*.styles.ts.
- Split god components into section components (e.g. ProjectInvestorsCard,
  SaleReceiptsCard, worker-card, wizard steps). Collapse useState → one struct.
- tsc + vitest → commit.

## Phase 2 — Shared kit / dedup (rule 2)
- SaleReceiptSheet / SaleCostSheet / EditDealSheet on MoneyEntrySheet/AppSheet
  (replace SaleDetail's 3 hand-rolled Modals).
- RuleInfoSheet on AppSheet (Settlement).
- Shared `AddPartySheet` (replace Entry + MaterialEntry hand-rolled party
  Modals) + use shared `Toast`; shared `ImageLightbox` (PhotoDiary +
  ProjectGalleryCard); `AccountPickerRow` for inline account chips.
- tsc → commit.

## Phase 3 — Auto status + remove the stages system
- Pure `projectStatusMeta(summary)` (Planning / Construction / For sale / Sold /
  Settled / On-hold / Cancelled) + unit tests.
- Remove stage pill + stage SelectSheet from ProjectDetail; auto badge on the
  project card. Delete StatusesScreen + `stages.ts` + nav route + Settings entry;
  drop the `stages` table (migration; no FKs). Update demo/tests/stress.
- tsc + vitest → commit.

## Phase 4 — Settlement redesign + edit/delete-in-place (rule 8)
- Rebuild SettlementScreen as clear steps: Builder work % + Charity % (the only
  inputs) → ownership split shown derived → payout account → confirm → report.
  Keep `ownerFirst` math; delete the dead investors-pool field + no-op lines.
- Edit/delete-in-place for sale receipts, construction expenses, material
  entries (repos + detail-sheet Edit/Delete like Plots/Bookings).
- Add DB tests. tsc + vitest → commit.

## Phase 5 — Features
- On-hold / Cancel lifecycle: wire ON_HOLD/CANCELLED (guards: settle blocked on
  cancelled; reactivate). UI on ProjectDetail.
- Optimize `listProjectSummaries` → one aggregate query.
- Full project PDF via shared engine (`useProjectReport`): plot + construction
  by category + labor + sale + investors/settlement, pagination + signature.
- Remove dead code: drop `milestones` table (migration) + MilestoneRow +
  DEFAULT_MILESTONES; drop `sale_receipts.doc_id`; remove completeSale/
  completed_at. Update demo/tests.
- tsc + vitest → commit.

## Phase 6 — Audit pass (design / validation / logic)
- Theme-token sweep: no hardcoded colors/px in any project screen/component
  (found e.g. ProjectDetail stage-pill raw 4/10/999).
- Validation: guard every money write (amounts > 0, ≤ caps, insufficient funds),
  required fields, date defaults = today, ≤6 fields/step.
- Logic: reconcile plot vs project settlement paths (one engine), phase totals,
  completion/settlement guards, stale-state reloads; fix anything found.
- tsc + vitest → commit.

Risk notes: Phase 3 (drop stages) + Phase 5 (drop milestones) carry migrations —
FK-safe via the runner's FK-off; low risk (no FKs on those). Phase 4 touches the
money-critical settle path — most careful review + DB tests.
