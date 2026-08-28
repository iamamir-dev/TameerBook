# Projects Module — Restructure + Audit Plan

The central module (plot + construction + sale + settlement). Follows all 8
restructure rules + DESIGN_GUIDELINES (theme tokens only, AppText/t(), ≥56px
targets, ≤6 fields/step, one primary action, color=direction, light/dark by
tokens). Each phase is `tsc + vitest` green and one commit. Ticked as completed.

## Gate decisions (from the user)
- **Settlement stays owner-first** (builder % off the top → remaining profit by
  ownership → charity deducted per person). Keep the math; **redesign the wizard**
  so inputs = Builder work % + Charity %, ownership split shown derived. Remove
  the misleading editable "investors pool %".
- **Auto-derive project status** (like Plots) → remove user-managed stages.
- Features: full **project PDF report**, remove **dead milestones + fields**,
  **On-hold/Cancel** lifecycle, **optimize the projects list**.
- **Audit** design/validation/logic across the module and fix.

## Working method
Screen-by-screen (touch each file once) rather than concern-by-concern, so a
screen gets its hook + styled + shared-sheet + logic/design/validation fixes in
one pass. Shared foundations first.

---

## Phase 0 — Scaffold + lift-and-shift  ✅
- [x] `src/modules/projects/{screens,components,hooks,utils,styled}` + index barrel
- [x] git mv 8 screens + `components/project/*` + `components/construction/*`
- [x] Rewire RootNavigator + internal imports; tsc + vitest green; commit

## Phase 1 — Foundations (shared utils + repos)
- [x] `projectStatusMeta(summary)` pure deriver + unit tests (8)
- [x] Optimize `listProjectSummaries` → aggregate queries (killed the N+1)
- [ ] Shared `AddPartySheet` (AppSheet) + `ImageLightbox` → built in Phase 4 with consumers

## Phase 2 — Projects list + New-project wizard
- [x] ProjectsScreen thin + styled; auto-status card (dropped stage props);
      store `loaded` skeleton; ProjectCard + ProjectCardSkeleton components
- [ ] NewProjectWizard: `useNewProject` hook + styled; reuse AddPlotSheet

## Phase 3 — Project detail (god component)
- [ ] `useProjectDetail` (useFocusData, drains 15 useState) + styled
- [ ] Remove stage pill + stage sheet (auto status); section components
- [ ] Full **project PDF report** (`useProjectReport`) via shared engine
- [ ] **On-hold / Cancel** lifecycle UI + guards

## Phase 4 — Construction + Sale phases
- [ ] ConstructionDetail: `useConstructionDetail` + styled; worker card
      component; edit/delete-in-place for expenses
- [ ] SaleDetail: `useSaleDetail` + styled; extract SaleReceiptSheet /
      SaleCostSheet / EditDealSheet onto AppSheet; edit/delete-in-place
- [ ] MaterialEntry: styled + shared AddPartySheet + shared Toast; edit-in-place
- [ ] PhotoDiary: styled + shared ImageLightbox

## Phase 5 — Settlement redesign
- [ ] Rebuild SettlementScreen: Builder work % + Charity % inputs, ownership
      split shown derived, remove dead investors-pool field + no-op lines
- [ ] `useSettlement` hook + styled; RuleInfoSheet → AppSheet
- [ ] DB tests for the settle path

## Phase 6 — Schema cleanup + full audit
- [ ] Drop dead `milestones` table (migration) + MilestoneRow + DEFAULT_MILESTONES
- [ ] Drop `stages` table + Statuses screen + `stages.ts` + Settings entry + nav
- [ ] Remove `sale_receipts.doc_id`, `sales.completed_at` / `completeSale`
- [ ] Theme-token sweep (no hardcoded colors/px); validation guards; logic audit
- [ ] Update demo/tests/stress for removed tables

Risk: Phase 6 migrations (drop stages/milestones) are FK-safe via the runner's
FK-off; Phase 5 touches the money-critical settle path — most careful + DB tests.
