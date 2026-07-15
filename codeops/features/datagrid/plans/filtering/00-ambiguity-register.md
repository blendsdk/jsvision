# Ambiguity Register: Filtering (datagrid/RD-06)

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Gate status**: ✅ GATE PASSED
> **Created**: 2026-07-15 13:37
> **CodeOps Skills Version**: 3.7.0

Every gap, ambiguity, and unstated assumption for the RD-06 filtering plan, hunted across the 12
categories and resolved with the user before any plan document beyond this register was written.
`[user]` = an explicit user decision this session; `[derived]` = derived from RD-06 + the RD-05
sorting architecture and confirmed in the user's blanket "confirmed" of the derived-decisions list.

## Register

| #  | Category | Ambiguity | Options | Decision | Source |
|----|----------|-----------|---------|----------|--------|
| 1  | Scope | RD-06 is much larger than sorting (model + API + quick-filter row + funnel + distinct + two anchored popups). Ship all at once or slice? | Full scope phased · Slice popups to a Phase B | **Full scope, phased** — all Must-Haves in one plan, structured data-plane-first (model + API + quick-filter + push-down + funnel + distinct first, then the two popups). Faithful to the RD (AR #6 kept value-list as v1) and the RD-05 precedent. | [user] |
| 2  | Scope / Completeness | The "N of M rows" count is specified for the RD-09 footer band, which is not built. Where does the count render? | Reactive API + story echo · Build a footer band now | **Reactive API + story echo** — expose `grid.filteredCount()`/`totalCount()`/`filterModel()`; the kitchen-sink story shows "N of M" via a live `Text` (as the sorting story echoed `grid.sort()`). No footer band here — RD-09 owns footer chrome. | [user] |
| 3  | Behavior | Quick-filter row is "an optional always-visible row" — show it by default? | Opt-in default off · Default on | **Opt-in, default off** — enabled via a `quickFilter` option; existing grids keep their height/appearance. Matches the RD's "optional" wording. | [user] |
| 4  | Behavior | Quick-filter / text `contains` filters match a column against — the formatted display string, or `String(value)`? RD says "display/value" (ambiguous). | Formatted display · Raw `String(value)` | **Formatted display string** — text ops match `format(value(row))` (what the user sees/types, Excel-like). Number/date condition filters and the value-list still evaluate the **typed value** (AR #31 in RD-06 / AC-2). | [user] |
| 5  | Completeness / API | AC-7 requires the value-list popup to disclose a truncated distinct list, but the declared `distinct(columnId): Promise<string[]>` carries no truncation signal. | Widen to `Promise<{ values, truncated? }>` · Keep `string[]`, infer at LIMIT | **Widen the seam** to `Promise<DistinctResult>` = `{ values: string[]; truncated?: boolean }`; the popup shows a "list truncated" note when `truncated`. The declared seam is unimplemented, so widening it is safe. | [user] |
| 6  | Naming / Architecture | Where does the filter model live? | `data-source.ts` placeholder · new `filter.ts` | **New `filter.ts`** owns `ColumnFilter`, `FilterModel`, the per-filter predicate derivation, and pure `filterRows(rows, model, columns)`. `data-source.ts` (currently a placeholder `FilterModel`) and the barrel re-point to it — exactly as `SortKey` moved to `sort.ts`. | [derived] · RD §Filter model |
| 7  | Behavior | Filter-vs-sort composition order. | filter→sort · sort→filter | **Filter → then sort** on the client path; a push-down source fires **both** `setFilter(model)` and `setSort(keys)` from guarded effects (mirrors the sort push-down effect). | [derived] · RD §RD-05 |
| 8  | Behavior | How do multiple column filters combine? | AND · OR | **AND** — a row survives only if it satisfies every active column filter. | [derived] · AC-5 |
| 9  | Architecture | `source.distinct` returns formatted labels, but `fromRows` has no column model to compute them. Who computes distinct for in-memory? | Grid computes · `fromRows` computes | **Grid-owned client distinct** — the grid scans materialized rows through `format∘value` (never truncated) when `source.distinct` is absent; it delegates to `source.distinct` only when present (windowed). | [derived] · RD §Distinct enumeration |
| 10 | Behavior | Value-list set membership — identity on what key? | Formatted label · raw value | **Formatted label** — the set stores selected formatted labels; a row matches when `selected.has(format(value(row)))`. Displays `format(value)`, filters on that label's identity. | [derived] · RD §value-list, AR #31 |
| 11 | Architecture | Where does the funnel indicator + its click live? | Extend `SortHeader` · new header decorator | **Extend `SortHeader`** — it renders a funnel glyph on filtered columns (reserving a cell alongside the sort arrow/priority digit) and routes a funnel-cell click to `onFunnelClick(columnId, anchor)`; a title click still sorts. Single-panel now; follows the same per-header binding when RD-07 lands. | [derived] |
| 12 | Behavior / Naming | Quick-filter row band — which columns get an Input, and where does the band sit? | Every column, no flag · per-column `filterable` flag | **Every column gets an Input** (no `filterable` flag — mirrors sorting's uniformity), in a new opt-in band between header and body sharing the body's column geometry. | [derived] |
| 13 | API | Grid filter API surface + unknown-column handling. | — | `grid.setFilter(columnId, filter)`, `grid.clearFilter(columnId?)`, reactive `grid.filterModel()`, and `grid.filteredCount()`/`totalCount()`. An unknown `columnId` is ignored — never forwarded to `setFilter`. | [derived] · AC-9 |
| 14 | Technical unknown | The condition popup offers "type-appropriate operators", but `GridColumn` has no declared filter type (`V` is erased at runtime). How is a column's filter type determined? | Explicit `filterType?` only · runtime inference · inference + override | **Runtime inference + optional override** — infer from a sampled non-null value (`number` → number, `Date`/`CalendarDate` → date, else text), overridable by an optional `filterType?: 'text' \| 'number' \| 'date'` on `GridColumn`. Mirrors `sort.ts`'s runtime type detection (`typeof number`, `instanceof Date`). **Surfaced during structuring — flagged in the plan summary for veto.** | [derived] |
| 15 | Dependency | RD-06 lists RD-07 (frozen panels — not done) as a dependency for "pinned-panel header geometry". | Block on RD-07 · proceed single-panel | **Proceed single-panel** — the datagrid already owns its one header (`SortHeader`), built for a later frozen-panel split; the funnel renders in that header now and follows the same per-header binding when RD-07 lands. RD-07 is a forward note, not a blocker. | [derived] |
| 16 | Naming | New file names. | — | `filter.ts` (model), `quick-filter-row.ts` (band), `filter-popup.ts` (condition), `value-list-popup.ts`. | [derived] |
| 17 | Testability | The verify command every phase runs. | — | `yarn verify` (root — lint + turbo typecheck/build/test/check:docs), per the project CLAUDE.md. | [derived] |

## Gate

- Every row Status = ✅ Resolved with an explicit decision. ☑
- User confirmed the complete register (the five `[user]` forks answered via AskUserQuestion; the
  `[derived]` list confirmed with "confirmed"). ☑
- Zero items deferred. ☑ (AR #14 was surfaced during structuring and is flagged in the plan summary
  for veto — recorded resolved with a grounded, pattern-consistent default.)

**✅ GATE PASSED** — 2026-07-15 13:37. Plan documents may be written.

## Preflight amendments (2026-07-15)

Decisions from the codebase-grounded preflight (see `00-preflight-report.md`), applied to the plan
docs. `[user]` = confirmed via the preflight decision batch; `[preflight]` = grounded in the recon.

| #  | Finding | Resolution | Source |
|----|---------|------------|--------|
| 18 | PF-001 (MAJOR) — the funnel→popup callback dropped the focus/popup seam | Forward the live `DispatchEvent` through `onFunnelClick(columnId, anchor, ev)` and `openFilterPopup(columnId, anchor, ev)`; the container builds the `mountCellOverlay` loop from `ev.focusView` and the popup's nested `ComboBox`/`DatePicker` consume the spread envelope — a mirror of `editing.ts`. The seam lands in **Phase 3** (where `onFunnelClick` is introduced), so Phase 4 doesn't retro-change the signature. | [user] · [preflight] |
| 19 | PF-002 (MINOR) — "omit the value-list section" (03-03) vs "always compute" (03-04) | v1 in-memory **always** offers the value-list via grid-owned client compute; a windowed source gates the client scan (offer the value-list only when `source.distinct` exists) — a forward note for RD-11. Docs reconciled. | [user] · [preflight] |
| 20 | PF-003 (MINOR) — quick-filter Input ⇄ popup filter on the same column | **Last-writer-wins** (one filter per column via the `Map`). The quick-filter Input reflects only `text` filters; a popup-set `set`/`number`/`date` filter leaves the Input blank while the funnel shows the column is filtered. Documented; no two-way sync in v1. | [user] · [preflight] |
| 21 | PF-004 (OBS) — "mirrors sort.ts type detection" over-claim | `resolveFilterType` **extends** sort.ts detection (adds a `CalendarDate → date` branch the sort comparator lacks); reworded in 03-01. | [user] · [preflight] |
| 22 | PF-005 (MINOR) — `filteredCount()` mechanism wording | `filteredCount()` returns `display().length` (== `source.length()` for an eager push-down source); ST-14 wording aligned to the implementation. | [user] · [preflight] |

## Runtime amendments (execution)

Decisions taken during `exec_plan`, tagged `(runtime)` per the zero-ambiguity-during-execution rule.
Mechanical/low-stakes only — no behavioral change to the plan.

| #  | Trigger | Resolution | Source |
|----|---------|------------|--------|
| 23 | The plan's `FilterModel<T>` fails the repo's `@typescript-eslint/no-unused-vars` (the alias body `ReadonlyMap<string, ColumnFilter>` never references `T` — it was always a phantom). | **`FilterModel` is non-generic** — a `ReadonlyMap<string, ColumnFilter>`, row-type-agnostic (each `ColumnFilter` reads its own column's value). The consuming signatures (`setFilter?(model: FilterModel)`, the grid signal/`filterModel()`) drop the `<T>`. Zero value-level/behavioral impact. | (runtime) |
| 24 | Phase 3's ST-19/ST-20 (funnel) are added to `sort-header.spec.test.ts`, which already carries the sorting plan's (RD-05) ST-19/ST-20 test descriptions. | The two funnel tests are named **`ST-19 (filter)` / `ST-20 (filter)`** — mirroring the file's existing `(unit)`/`(container)` qualifiers that already disambiguate same-numbered cases. Naming only; the tested behavior is exactly 07 §Quick-filter row & funnel ST-19/ST-20. | (runtime) |
| 25 | Making `filterModel`/`onFunnelClick` required on `SortHeaderConfig` breaks the two direct `SortHeader` constructions in `sort-header.impl.test.ts` (an RD-05 impl test) at runtime. | Those construction sites (an impl test, not an oracle) supply the new required config (`filterModel: signal(new Map())`, `onFunnelClick: () => undefined`). Mechanical forced update; no asserted behavior changed. | (runtime) |
| 26 | `QuickFilterRow`'s input→`onQuickFilter` wiring, run inside a `bind` effect, mutates the container's filter model, whose re-anchor reads `display`/cursor signals — the effect would then read-and-write the same signals and never converge (`ReactiveCycleError`). | The sink call is wrapped in **`untrack(...)`** (the same guard `editor-bridges.ts` uses for its cross-signal writes), so the effect depends only on the input's own text signal. Implementation necessity, no behavioral change. | (runtime) |
