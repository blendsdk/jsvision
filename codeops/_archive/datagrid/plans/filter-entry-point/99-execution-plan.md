# Execution Plan: Filter Entry Point

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Tracks**: GitHub issue #92
> **Last Updated**: 2026-07-16 09:49
> **Progress**: 30/30 tasks (100%) ✅ COMPLETE
> **CodeOps Skills Version**: 3.8.0

## Overview

Make the condition popup / value-list reachable on an unfiltered column, phased **gate-first**: the
filterability flag, then the always-visible funnel (mouse), then the `Alt+Down` opener (keyboard),
then the showcase + hardening. Every phase follows spec-first ordering (spec tests →
red → implement → green → impl tests → verify). No core/ui change. The RD-06 text/AC funnel revision and
the `ST-19` re-spec are explicit tasks **both in Phase 2** (preflight PF-006 — the requirement changes
*with* the spec that depends on it), executed with the code — not assumed.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks | FRs |
| ----- | ----- | ----- | --- |
| 1 | `GridColumn.filterable` flag + propagation | 8 | FR-4 |
| 2 | Always-visible funnel (`SortHeader` draw + hit-test) + ST-19 re-spec + RD-06 funnel revision | 10 | FR-1, FR-2, FR-5, FR-7 |
| 3 | `Alt+Down` keyboard opener + container wiring | 8 | FR-3 |
| 4 | Showcase stories + hardening | 4 | FR-6 |

**Total: 30 tasks across 4 phases.**

> **⚠️ EXECUTION RULE:** the checkboxes below are the single source of truth. Each task appears once.
> On implementation → `[~]` + `(implemented: YYYY-MM-DD HH:MM)`; on verify pass → `[x]` +
> `(completed: …)`. Update the Progress header after every task; only `[x]` counts. Resume by scanning
> top-to-bottom: first `[~]`, else first `[ ]`. Timestamps from `date '+%Y-%m-%d %H:%M'`.

---

## Phase 1: `GridColumn.filterable` flag + propagation

**Reference**: `03-03` · `07 §Filterability propagation` (ST-13) · AR-3/AR-8

### Step 1.1: Specification tests (red)
- [x] 1.1.1 Add ST-13 to `quick-filter-row.spec.test.ts`: a `filterable: false` column renders **no** `Input`; the other inputs keep their positions/widths (geometry unchanged) — `packages/datagrid/test/quick-filter-row.spec.test.ts` *(completed 2026-07-16 09:05 — added as `ST-EP-13`, PF-008 prefix)*
- [x] 1.1.2 Verify **red** — `filterable` does not exist yet *(completed 2026-07-16 09:05 — `variant.length` 3≠2; ST-17/18 still green)*

### Step 1.2: Implement (green)
- [x] 1.2.1 Add `readonly filterable?: boolean;` to `GridColumn` (default true), with JSDoc + an `@example` showing a `filterable: false` column — `packages/datagrid/src/column.ts` *(completed 2026-07-16 09:10)*
- [x] 1.2.2 Container: thread a `filterableOf(id) => col.filterable !== false` predicate through `GridBodyDeps`; each header/quick-filter derives its own `filterable[]` from its `ids` slice (headers use per-panel `ids`, the quick-filter band uses `fullVisible`) — `packages/datagrid/src/grid.ts`, `grid-panels.ts` *(PF-005: a single container-level `boolean[]` is ambiguous across the per-panel vs full-visible slices)* *(completed 2026-07-16 09:10 — realized as a `sliceFilterable(ids)` helper in `grid-panels.ts` derived from the existing `columnMap` dep, mirroring `sliceTyped`; no redundant `filterableOf` dep and `grid.ts` untouched. Header wiring deferred to Phase 2 (SortHeader gains `filterable` in 2.2.1). See register AR-13 (runtime).)*
- [x] 1.2.3 `QuickFilterRow`: add a `filterable?: boolean[]` config and **skip the `Input` for a non-filterable column using a nullable slot** (`Input | null`) so `inputs` stays index-parallel to `columns` — `reposition()` + the `columnIds[c]` wiring both index by position; preserve column geometry/alignment — `packages/datagrid/src/quick-filter-row.ts` *(PF-005)* *(completed 2026-07-16 09:10)*
- [x] 1.2.4 Verify **green** — ST-13 passes *(completed 2026-07-16 09:08 — ST-EP-13 green, ST-17/18 unchanged)*

### Step 1.3: Impl tests & verify
- [x] 1.3.1 Impl tests: default (`undefined`) ⇒ filterable; explicit `false` ⇒ omitted; multiple non-filterable columns — `packages/datagrid/test/quick-filter-row.impl.test.ts` *(completed 2026-07-16 09:10 — 2 cases: default/single-false; 3-col multi-false index-alignment)*
- [x] 1.3.2 Full `yarn verify` *(completed 2026-07-16 09:10 — turbo 26/26; datagrid 292 tests, examples 222 tests green)*

**Deliverables**: `filterable` flag live; quick-filter row honors it. **Verify**: `yarn verify`

---

## Phase 2: Always-visible funnel + ST-19 re-spec

**Reference**: `03-01` · `07 §Funnel states / §Funnel hit-test` (ST-1…ST-7) · AR-3/AR-6/AR-7/AR-8

### Step 2.1: Specification tests (red)
- [x] 2.1.1 In `sort-header.spec.test.ts`: **replace `ST-19 (filter)`** with ST-1 (muted `▽` when unfiltered), ST-2 (emphasized when filtered), ST-3 (clear ⇒ stays muted), ST-4 (`filterable:false` ⇒ no `▽`); prefix the new cases (e.g. `ST-EP-*`) so they don't blur with the RD-05 `ST-13…ST-20` already in the file, and leave `ST-20 (filter)` in place (PF-008) — `packages/datagrid/test/sort-header.spec.test.ts` *(completed 2026-07-16 09:24 — added `ST-EP-1..4`, replaced old `ST-19 (filter)`, kept `ST-20 (filter)`; tone asserted via `defaultTheme.listDivider/tableHeader.fg`)*
- [x] 2.1.2 Add ST-5 (funnel click on an unfiltered column fires `onFunnelClick`, not `onSort`), ST-6 (funnel-cell routing), ST-7 (narrow ⇒ drop funnel, keep arrow) — same file *(completed 2026-07-16 09:24 — `ST-EP-5..7`)*
- [x] 2.1.3 Verify **red** — funnel is still filtered-only *(completed 2026-07-16 09:12 — 5 of 7 new cases red; ST-EP-2/7 codify pre-existing invariants, green)*

### Step 2.2: Implement (green)
- [x] 2.2.1 `SortHeader`: accept an **optional** `filterable[]` config (default all-`true`, PF-004); in `draw`, reserve + paint `▽` on every filterable column — `listDivider` when unfiltered, `tableHeader` when filtered; keep narrow-column drop-first — `packages/datagrid/src/sort-header.ts` *(completed 2026-07-16 09:24 — + wired `sliceFilterable(ids)` into `makeHeader` in grid-panels.ts)*
- [x] 2.2.2 `funnelColumnAt`: gate on `isFilterable(k)` instead of `isFiltered(k)` so clicks route regardless of filter state — same file *(completed 2026-07-16 09:24 — predicate renamed; unused `filters` local removed)*
- [x] 2.2.3 Update `draw` / `funnelColumnAt` JSDoc to the new behavior (plain language, no plan IDs) — same file *(completed 2026-07-16 09:24 — module overview + FUNNEL const + draw + funnelColumnAt)*
- [x] 2.2.4 **RD-06 funnel revision (moved here from Phase 4, PF-006):** revise all five spots that encode the old rule — §Feature Overview (~L15), §Condition filters (~L27), §Funnel indicator (~L34), Technical §Funnel + count (~L83), acceptance #4 (~L139) — and add the non-filterable AC, per [00-ambiguity-register §C](00-ambiguity-register.md) — `codeops/features/datagrid/requirements/RD-06-filtering.md` *(completed 2026-07-16 09:24 — all 5 spots + new AC #9)*
- [x] 2.2.5 Verify **green** — ST-1…ST-7 pass; RD-06 + the re-spec agree *(completed 2026-07-16 09:16 — sort-header 28 green)*

### Step 2.3: Impl tests & verify
- [x] 2.3.1 Impl tests: title clips one cell earlier on a filterable column (unchanged on a non-filterable one); muted↔emphasized repaint on `setFilter`/`clearFilter` — `packages/datagrid/test/sort-header.impl.test.ts` *(completed 2026-07-16 09:24 — title-clip + grid-API reactive tone flip, only the filtered column emphasizes)*
- [x] 2.3.2 Full `yarn verify` *(completed 2026-07-16 09:24 — turbo 26/26 green; datagrid full suite + showcase/kitchen-sink smoke unaffected by the always-on funnel)*

**Deliverables**: mouse entry point live on every filterable column; RD-06 + `ST-19` agree with the code. **Verify**: `yarn verify`

---

## Phase 3: `Alt+Down` keyboard opener

**Reference**: `03-02` · `07 §Keyboard opener` (ST-8…ST-12) · AR-5/AR-9/AR-10/AR-11

### Step 3.1: Specification tests (red)
- [x] 3.1.1 New `filter-entry-point.spec.test.ts`: ST-8 (`Alt+Down` on non-editing body opens the focused column's popup, `ev.handled`), ST-9 (no-op while editing), ST-10 (`filterable:false` ⇒ no-op), ST-11 (blank popup on an unfiltered column), ST-12 (frozen right panel), **+ a plain-`Down` guard: no popup and the row cursor still moves (PF-001)** — `packages/datagrid/test/filter-entry-point.spec.test.ts` *(completed 2026-07-16 09:42 — 8 cases incl. body-unit onOpenFilter spy + modifier guard)*
- [x] 3.1.2 Verify **red** — no keyboard route exists *(completed 2026-07-16 09:37 — 5 new-behavior cases red; invariant guards green)*

### Step 3.2: Implement (green)
- [x] 3.2.1 `EditableGridRows`: add `onOpenFilter?(globalCol, ev)` config + handle `Alt+Down` **before `super.onEvent`** and only when **not editing** (`!this.controller.isEditing()`); forward the live `ev`; `ev.handled = true` **so the base row-down doesn't also fire (PF-001)** — `packages/datagrid/src/editable-grid-rows.ts` *(completed 2026-07-16 09:42 — `handleOpenFilter` first in the key block)*
- [x] 3.2.2 `SortHeader`: add a `funnelAnchor(columnId)` helper returning the funnel cell's header-local anchor, and **refactor the mouse path (`onEvent`) to call it too**, so both routes share one anchor (parity) — `packages/datagrid/src/sort-header.ts` *(completed 2026-07-16 09:42)*
- [x] 3.2.3 `grid.ts` + `grid-panels.ts`: **retain `parts.headers` as a field and re-assign it in `rebuildBody` (PF-002)**; thread `onOpenFilter`; map `globalCol` → `columnId` + owning header (from the retained headers), no-op when non-filterable, then call `openFilterPopup(columnId, funnelAnchor, ev, header)` — `packages/datagrid/src/grid.ts`, `grid-panels.ts` *(completed 2026-07-16 09:42 — `_headers` field + `openFilterFromKeyboard`; header resolved via `funnelAnchor` returning null off-panel)*
- [x] 3.2.4 Verify **green** — ST-8…ST-12 pass *(completed 2026-07-16 09:40 — 8/8 spec green; full datagrid suite 308 green)*

### Step 3.3: Impl tests & verify
- [x] 3.3.1 Impl tests: anchor parity (keyboard-opened popup lands where a funnel click would); `Alt+Down` on an empty grid is a no-op (no throw); the in-editor `Alt+Down`→ComboBox path still works; **`Alt+Down` still opens under the correct header after a rebuild (hide/show or reorder) — proves headers are refreshed (PF-002)** — `packages/datagrid/test/filter-entry-point.impl.test.ts` *(completed 2026-07-16 09:42 — 4 cases; freshness proven by keyboard==mouse anchor after a hide-rebuild)*
- [x] 3.3.2 Full `yarn verify` *(completed 2026-07-16 09:42 — turbo 26/26 green)*

**Deliverables**: keyboard entry point live; both routes share one anchor. **Verify**: `yarn verify`

---

## Phase 4: Showcase stories + hardening

**Reference**: `03-03` · `07 §Showcase / §Security` · AR-4 *(RD-06 funnel revision now lands in Phase 2 — PF-006)*

- [x] 4.1.1 Reword the three `datagrid-showcase` filtering story hints + add `quickFilter: true`, and reword the `filtering` kitchen-sink story hint to mention the always-visible `▽` + `Alt+Down` — `packages/examples/datagrid-showcase/stories/filtering/{condition-text,condition-num-date,value-list}.story.ts` (+ `filter-demo.ts`), `packages/datagrid/test/kitchen-sink/stories/filtering.story.ts` *(no new story — existing smoke must still pass; kitchen-sink gate satisfied by the updated stories)* *(completed 2026-07-16 09:49 — 3 hints + quickFilter:true + lead JSDoc; kitchen-sink hint+JSDoc; filter-demo.ts already supports quickFilter)*
- [x] 4.1.2 Hardening: `grep -rInE 'RD-|AR-|plans/|codeops/' packages/datagrid/src packages/examples/datagrid-showcase` on the touched files (no plan IDs in shipped code); confirm `security.spec.test.ts` still green (no regression) *(completed 2026-07-16 09:49 — removed a stray `(PF-002)` from grid.ts; grep clean (only the legit Story `rd:` metadata remains); security.spec 11 green)*
- [x] 4.1.3 Behavioral verification via the **verify skill**: drive Filtering → Text conditions — muted `▽` present with no quick-filter; click opens; `Alt+Down` opens; set filter ⇒ emphasized; clear ⇒ muted-but-present; **spot-check a title-filled narrow column reads acceptably with the 1-cell funnel reserve (PF-009)** *(completed 2026-07-16 09:49 — headless render of the real condition-text story confirmed the always-visible `▽` on both wide columns + the reworded hint + the live quick-filter row; interactions (click/Alt+Down open, set→emphasized, clear→muted, narrow drop-first) are proven by the datagrid spec/impl suites on the same components. Note: interactive-TTY drive not possible in this headless session; the headless render + full spec/impl coverage stand in for it.)*
- [x] 4.1.4 Full `yarn verify` (turbo green) + close-out note on issue #92 *(completed 2026-07-16 09:49 — turbo 26/26 green; #92 referenced by all four feature commits and ready to close on merge)*

**Deliverables**: honest showcase; #92 resolved (RD-06 + `ST-19` already reconciled in Phase 2). **Verify**: `yarn verify`

---

## Post-completion

- Sync the datagrid roadmap: note the RD-06 entry-point revision + link this plan (Phase 5 of make_plan).
- Recommend a **fresh-session preflight** before/after exec_plan (same-session authoring note, AR §A).
- Commit per phase via **/gitcm** (or `--auto-commit` in exec_plan); no raw git in this document.
