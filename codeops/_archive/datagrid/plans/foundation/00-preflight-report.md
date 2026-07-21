# Preflight Report: Foundation & Grid-Engine Exposure (datagrid/RD-01 plan)

> **Status**: ✅ PASSED — all 6 findings resolved (0 critical · 2 major · 4 minor · 0 observation); fixes applied to the plan docs 2026-07-12
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/datagrid/plans/foundation/` (12 documents)
> **Codebase Grounded**: 14 source files examined; ~30 references verified (incl. 2 empirical `tsc` runs)
> **Last Updated**: 2026-07-12
> **Recommendation hardening**: the MAJOR batch (PF-001/PF-002/PF-003-as-drafted) was sent to one
> independent challenger with the codebase context; all confirmed against primary source, and PF-003
> was reconciled DOWN to MINOR on the challenger's reasoning before recommendations were recorded.

> ⚠️ **SAME-MODEL REVIEW (cross-session).** These plan docs were authored by the same model family
> (prior session); this scan runs in a fresh, `/clear`ed session, which improves independence but does
> not eliminate shared-training blind spots. Every codebase claim below is re-verified against primary
> source (`packages/ui/src/table/*`, `packages/ui/src/controls/measure.ts`, `packages/core/src/engine/*`,
> `packages/files/*`, `scripts/check-jsdoc.mjs`, `turbo.json`) with file:line citations, and the two
> type-level claims were confirmed with the repo's own `tsc`.

## Codebase Context Summary

**Tech Stack:** yarn 1.x + Turborepo monorepo; TypeScript ESM-only (NodeNext, strict); vitest (unit/e2e);
zero runtime deps (`check:deps` guard). New package `@jsvision/datagrid` layers on `@jsvision/core` + `@jsvision/ui`.

**Architecture (verified):**
- The grid engine is real and internal: `GridRows`/`GridHeader` (`packages/ui/src/table/grid-rows.ts:76,340`)
  + pure `columns.ts` math (`apportionColumns`/`alignCell`/`sortRows`/`measureAutoWidths`). The ui barrel
  exports **only** `DataGrid` + column **types** (`packages/ui/src/index.ts:148-149`; `table/index.ts:6-7`
  even documents the renderers as "internal"). The promotion the plan proposes is accurate & necessary.
- `Column<T>.accessor:(row)=>string` and `sortRows` orders by that string unless `compare` is set
  (`columns.ts:20-35,190-196`) — confirming the value/format adapter is load-bearing.
- `GridRows` has **zero `private` members**; state is `protected`; `GridRowsConfig` accepts shared
  `focused`/`selected`/`indent` signals (`grid-rows.ts:54-73`) — the shared-cursor substrate is real.
- `DataGrid`'s band composition (`data-grid.ts:119-181`) is exactly the read-only container's model.
- `@jsvision/files` is a clean clone template (six scripts, no `tsconfig.typecheck.json`) — the plan's
  scaffold delta (adding test-typechecking) is correctly identified (`packages/files/package.json`).
- The docs gate is real: `check-jsdoc.mjs` requires an `@example` on every public **class/function**
  value (types exempt), following barrel re-exports — matching the plan's stated cost.
- **CLAUDE.md drift caught & cleared:** the plan's `scripts/sync-package-versions.mjs` is the CORRECT
  filename (CLAUDE.md's `sync-versions.mjs` is the stale one). No finding — the plan is right.

**Key Files Examined:** `packages/ui/src/table/{grid-rows,columns,data-grid,index}.ts`,
`packages/ui/src/{index,controls/measure}.ts`, `packages/ui/src/event/{types,event-loop}.ts`,
`packages/ui/src/view/render-root.ts`, `packages/core/src/engine/index.ts`,
`packages/files/package.json`, `packages/spike-data-studio/src/editable-grid.ts`,
`packages/examples/test/kitchen-sink.smoke.spec.test.ts`, `scripts/check-jsdoc.mjs`, `turbo.json`,
and the requirements set's own preflight report (PF-001/002/004/007/008 cross-referenced — the plan
cites them accurately).

**Reference Verification:** ~30 references mapped to code — 24 verified accurate, 6 produced findings below.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | (PF-002, PF-003 secondary) | 🟠 |
| 3 | Logical Contradictions | (PF-001 secondary) | 🟠 |
| 4 | Completeness Gaps | PF-005 | 🟡 |
| 5 | Dependency Issues | (PF-003 secondary) | 🟡 |
| 6 | Feasibility Concerns | (PF-002 secondary) | 🟠 |
| 7 | Testability | PF-006 | 🟡 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | (PF-005 secondary) | 🟡 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | (PF-004, PF-006 secondary) | 🟡 |
| 13 | Codebase Alignment | PF-001, PF-002, PF-003, PF-004 | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 2 | ✅ resolved (applied) |
| 🟡 MINOR | 4 | ✅ resolved (applied) |
| 🔵 OBSERVATION | 0 | — |

---

### PF-001: Read-only container reuses `GridHeader`, which has live click-to-sort 🟠 MAJOR

**Dimension:** Codebase Alignment (13 — Architecture Mismatch / Impact Blindness); Logical Contradiction (3); Completeness (4)
**Location:** `03-05-overlay-container.md` §"`grid.ts` — read-only `EditableDataGrid<T>`" (the "read-only … no `sortBy`/filter UI" claim + the "GridHeader + GridRows over shared `indent`/`focused`/`selected` signals" construction)
**Codebase Evidence:** `packages/ui/src/table/grid-rows.ts:411-429` (`GridHeader.onEvent` unconditionally `this.sort.set(...)` on mouse-down), `:394-397` (draws `▲`/`▼` from the sort signal), `:328-337` (`GridHeaderConfig` **requires** `sort: Signal<SortState>`; there is **no** disable flag), `:341` (`focusable=false` gates keyboard focus only, not mouse routing); contrast `data-grid.ts:130` where `display` DOES depend on `sort`.
**The Problem:** The plan ships a strictly "read-only" container but composes `GridHeader`, whose click-to-sort is unconditional (any header mouse-down sets the sort signal and repaints a `▲`/`▼` arrow). The container's `display = derived(materialize(source))` never reads the sort signal, so a header click in the AC-9 story / any live mount **paints a sort arrow that never reorders the rows** — a broken affordance that directly contradicts "no sort UI." Compounding it, the construction description is not implementable verbatim: `GridHeaderConfig` requires a `sort` signal (which the plan omits — it lists `focused`/`selected`, which are `GridRows`' fields, not the header's).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Datagrid-local `class ReadonlyGridHeader extends GridHeader { override onEvent() {} }`; pass a fixed `signal<SortState>(null)`. Keeps ui promotion pure (no ui behavior change). | Truly read-only; ui untouched (matches 03-01's "additive promotion, no behavior change"); minimal. | One tiny subclass; no arrow ever (fine for read-only). |
| B | Add an additive `sortable?: boolean`/`interactive?: false` opt-out to `GridHeaderConfig` in ui; the container passes it. | Reusable opt-out for future read-only grids. | Expands the ui touch beyond pure promotion (still backward-compatible). |
| C | Embrace a working single-key sort now: `display = derived(() => sortRows(materialize(source), engineCols, sort()))` using `toEngineColumn`'s value-aware `compare`. | Honest header; near-free (adapter already synthesizes `compare`). | Pulls RD-05 sort scope into RD-01; drops the "read-only" framing (AR #1 plan). |

**Recommendation:** **Option A** — it keeps the container genuinely read-only per AR #1 (plan), leaves the ui promotion strictly additive per 03-01, and is a ~3-line datagrid-local subclass. Whichever is chosen, 03-05 must be corrected to **spec the required `sort` signal** for `GridHeader` construction (the header takes `columns`/`autoWidths`/`indent`/`sort`, not `focused`/`selected`). Option C is a legitimate scope call for the user (a "read-only but sortable" RD-01), but it reopens the AR #1 read-only decision.
**Confidence:** High. **Hardening:** independent challenger CONFIRMED against `grid-rows.ts:411-429,328-337`; also independently flagged the missing-`sort`-signal implementability gap.
**User Decision:** ✅ Resolved — accepted recommendation (Option A). Applied to `03-05` (sort-suppressed `ReadonlyGridHeader` + required `sort` signal specced) + `99` task 5.2.2.

---

### PF-002: `defineColumns<T>(cols: GridColumn<T>[])` erases per-column `V` → typed `format`/`parse` (and the plan's own examples) do not typecheck 🟠 MAJOR

**Dimension:** Codebase Alignment (13); Feasibility (6); Testability (7); Implicit Assumptions (2)
**Location:** `03-03-column-model-adapter.md` §"New Functions" (`export function defineColumns<T>(columns: GridColumn<T>[]): GridColumn<T>[]`), and the examples in `00-index.md:59-69`, `03-03:80-84`, `03-05:111`.
**Codebase Evidence:** `RD-01-foundation.md:85-99` (`GridColumn<T, V = unknown>`, `format?:(value:V,row)=>string`). Empirical: repo `tsc 5.x --strict` on the plan's exact signature + example (`format: (v) => eur.format(v)`) errors **TS2769** ("Argument of type 'unknown' is not assignable to parameter of type 'number | bigint'"). The array element type collapses to `GridColumn<T, unknown>`, so `format`/`parse` params are `unknown`.
**The Problem:** `defineColumns` is the primary authoring ergonomic for the set's central decision — the `value`/`format`/`parse` split (req AR-31). As specced, a per-array `<T>` fixes every element to `V = unknown`, so no typed formatter compiles. The challenger confirmed the obvious workaround also fails: annotating `format: (v: number) => …` errors **TS2322** (contravariant param under `strictFunctionTypes`), and partial type-arg inference (`defineColumns<Person>([...])` with a variadic `V`) is forbidden by TS (TS2558). The plan's three canonical examples — which the doc standard requires be copy-paste-correct and which will seed JSDoc `@example`s and the `column.spec`/`grid.spec` tests — do not compile.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Replace with a per-column helper `column<T,V>(c: GridColumn<T,V>): GridColumn<T,V>` used inside a plain array. | Infers `V` from `value`; types `format`/`parse` correctly and safely (TanStack idiom, verified type-safe). | Call syntax changes from `defineColumns<T>([...])` to `[column<Person,_>({...}), …]`; T still needs `value:(r:Person)=>…` or an explicit arg. |
| B | Curried factory `columnHelper<T>()` returning a per-column `col()` that infers `V`. | Pins `T` once; `col({...})` infers `V` per column; ergonomic. | Two-call shape; slightly more API surface. |
| C | Keep `defineColumns<T>` but type it `GridColumn<T, any>[]`. | Preserves the exact call syntax. | `format`/`parse` params become `any` — silently unsafe; violates the repo's no-`any` rule; defeats the point. |

**Recommendation:** **Option A** (or B if a pinned-`T` ergonomic is wanted) — a per-column helper is the only shape that both compiles and stays type-safe (Option C reintroduces `any`). Update the three examples to the chosen shape; they are currently the failing spec. This is the strongest, airtight finding.
**Confidence:** High (empirically proven both ways). **Hardening:** independent challenger reproduced TS2769 on the plan's example and TS2322 on the annotation workaround with the repo's `tsc`.
**User Decision:** ✅ Resolved — accepted recommendation (Option A, per-column `column<T,V>()`). Applied to `03-03`, `00-index`, `03-05`, `03-06`, `01-requirements`, `07`, `99`, and the register.

---

### PF-003: The measure `stringWidth` the container feeds to `measureAutoWidths` is not on the ui barrel / promotion set 🟡 MINOR

**Dimension:** Codebase Alignment (13 — Phantom Reference / Dependency Reality); Dependency (5)
**Location:** `03-05-overlay-container.md` §"`grid.ts`" — `autoWidths = derived(measureAutoWidths(engineCols, display(), stringWidth))`; promotion set in `03-01:34-47`.
**Codebase Evidence:** `stringWidth` is `packages/ui/src/controls/measure.ts:28` (internal) — **not** on `packages/ui/src/index.ts` and **not** in the promotion set (`GridRows`/`GridHeader`/`apportionColumns`/`alignCell`/`sortRows`/`measureAutoWidths` + types). `measureAutoWidths` requires a `measure` fn (`columns.ts:64-68`); `GridRowsConfig.autoWidths` is required (`grid-rows.ts:59-60`). ui's `stringWidth` = Σ `charWidth(cp,'wcwidth')` (`measure.ts:18-32`); core publicly exports `charWidth`+`WidthMode` (`packages/core/src/engine/index.ts:56,78`). The throwaway spike used a naive `(s)=>[...s].length` (`spike-data-studio/src/editable-grid.ts:16`).
**The Problem:** The container cannot import `stringWidth` as written, so it must obtain a measure another way. If an implementer copies the spike's naive `[...s].length`, `auto`-column widths diverge from what the engine actually draws (`alignCell(..., stringWidth)`, `grid-rows.ts:215`) for wide/CJK glyphs — a column-geometry misalignment in the foundation's render path. Harm is narrow (only `auto` widths for wide glyphs; `alignCell` is width-aware so nothing corrupts or de-sanitizes) and the fix is one line, hence MINOR.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add `stringWidth` (and `glyphWidth`) to the promotion set (03-01) and import it in the container. | Single source of truth — container measures exactly what the engine draws; immune to future width-rule changes. | Two more `@example`s; grows the ui public surface slightly (AC-2's list gains 1-2 names). |
| B | Reconstruct the measure in datagrid from core's public `charWidth`+`'wcwidth'`. | No ui-barrel change; byte-identical today. | Re-declares the definition; silent drift risk if the engine's width rules ever change. |

**Recommendation:** **Option A** — promoting `stringWidth` guarantees the container and engine share one measure permanently, eliminating the whole misalignment class; the extra `@example` cost is trivial and consistent with the promotion already underway. Whichever is chosen, 03-05 must stop naming the unreachable symbol and 03-03/05 must forbid the naive-length fallback.
**Hardening:** challenger CONFIRMED the facts and recommended the downgrade to MINOR + Option A; reconciled before recording.
**User Decision:** ✅ Resolved — accepted recommendation (Option A, promote `stringWidth`). Applied to `03-01`, `02-current-state`, `01-requirements`, `07` (ST-1), `99`, `00-index`; container now imports the promoted `stringWidth`.

---

### PF-004: The 03-05 `createEventLoop` example omits the required second `opts` argument 🟡 MINOR

**Dimension:** Codebase Alignment (13 — Stale Assumption); Consistency (12)
**Location:** `03-05-overlay-container.md` §"Code Examples" — `const loop = createEventLoop({ width: 20, height: 6 });`
**Codebase Evidence:** `packages/ui/src/event/event-loop.ts:553` — `createEventLoop(viewport: Size2D, opts: EventLoopOptions)` (both params required); `event/types.ts:37` — `EventLoopOptions.caps` is **required**. The function's own `@example` (`event-loop.ts:540`) passes `createEventLoop({ width: 40, height: 10 }, { caps })`.
**The Problem:** The example calls `createEventLoop` with one argument; it needs `(size, { caps })`. Per the repo's NON-NEGOTIABLE doc standard, examples must be copy-paste-correct, and this snippet is the container's usage illustration (likely to seed the `EditableDataGrid` JSDoc `@example`). `loop.mount(root)` and `loop.focusView(...)` in the same snippet are correct (`event/types.ts:89,99`).
**Recommendation:** The only viable fix — correct the example to `createEventLoop({ width: 20, height: 6 }, { caps })` (resolve `caps` via `resolveCapabilities(...).profile`, as the kitchen-sink oracle does). No design change.
**User Decision:** ✅ Resolved — accepted. Applied to the `03-05` example (added `resolveCapabilities` import + `caps` + the second arg).

---

### PF-005: `GridDataSource.rowAt(): T | undefined` does not cleanly feed `GridRowsConfig.display: () => T[]` 🟡 MINOR

**Dimension:** Completeness (4 — Impact Blindness / forward seam); Codebase Alignment (13); Edge Cases (9)
**Location:** `03-04-data-source-commit.md` §"`GridDataSource<T>`" (`rowAt(index): T | undefined`) + `03-05-overlay-container.md` §"`grid.ts`" (`display = derived(materialize(source))` reading `source.rowAt(i)`).
**Codebase Evidence:** `grid-rows.ts:55` — `GridRowsConfig.display: () => T[]` (not `(T|undefined)[]`). `materialize` = `Array.from({length}, (_,i) => source.rowAt(i))` yields `(T|undefined)[]`.
**The Problem:** The source's read seam returns `T | undefined` (undefined = not-yet-loaded for windowed sources), but the engine's `display` seam is typed `() => T[]`. In RD-01 the in-memory source and eager double never return undefined, so the container must coerce (`!`/a `.filter` type-guard) — a small type-fit wrinkle. The forward concern is real: RD-11's windowed placeholder story must reconcile this mismatch (either widen `GridRows` to accept `(T|undefined)[]`, or map undefined → a placeholder row before `display`). The Foundation RD — whose stated job is getting the interfaces right so "an ambiguity here propagates everywhere" — should acknowledge this seam rather than leave it implicit.
**Recommendation:** The single sensible fix — in 03-04/03-05, note how `materialize` coerces `(T|undefined)[]` → `T[]` in RD-01 (eager sources never yield undefined; use a type-guard, not `as any`/`as unknown` per the repo rule), and record that RD-11's placeholder rendering must reconcile `rowAt`'s `undefined` against `display`'s `T[]`. Documentation/forward-seam only; no RD-01 code change.
**User Decision:** ✅ Resolved — accepted. Applied to `03-05` (materialize coerces via type-guard; RD-11 reconciliation noted) + `99` task 5.2.2.

---

### PF-006: `defaultCompare` advertises `Date`/`CalendarDate` chronological ordering, but detection is unspecified and untested 🟡 MINOR

**Dimension:** Testability (7); Consistency (12); Completeness (4)
**Location:** `03-03-column-model-adapter.md` §"New Functions" — `defaultCompare` JSDoc "number→numeric, Date/CalendarDate→chronological, …"; the impl-test list ("`defaultCompare` across number/string/Date/null/mixed").
**Codebase Evidence:** `@jsvision/ui`'s `CalendarDate` is a plain `{ year, month, day }` value with its own `compare` helper (per CLAUDE.md `src/date/`); it is not an instance with a distinguishing prototype.
**The Problem:** For the JSDoc claim to be true, `defaultCompare(a: unknown, b: unknown)` must (a) structurally detect a `CalendarDate` (ambiguous — any `{year,month,day}` object matches) and (b) import its comparator. The plan specifies neither, and the impl-test list omits `CalendarDate`. Shipped JSDoc that claims a behavior the code doesn't clearly implement or test misleads the very users/agents the doc standard targets.
**Recommendation:** Either (i) implement + test `CalendarDate` detection explicitly (name the structural predicate and add a `CalendarDate` case to `column.impl.test.ts`), or (ii) drop `CalendarDate` from `defaultCompare`'s RD-01 scope (keep number/string/Date/null) and let RD-05's `sortRowsMulti` own typed comparators — simpler, and avoids date-family coupling in a Foundation helper. Recommend (ii) unless a concrete RD-01 consumer needs it.
**User Decision:** ✅ Resolved — accepted recommendation (ii, drop `CalendarDate` from RD-01 `defaultCompare`). Applied to `03-03`.

---

## Decisions log

User: **"i accept"** (all recommendations), 2026-07-12.

| Finding | Severity | Decision | What changed |
|---|---|---|---|
| PF-001 | 🟠 MAJOR | ✅ Applied (Option A) | `03-05`: read-only container mounts a sort-suppressed `ReadonlyGridHeader` + specs the required `sort` signal; `99` task 5.2.2 updated. Keeps the container genuinely read-only (AR #1) and the ui promotion additive. |
| PF-002 | 🟠 MAJOR | ✅ Applied (Option A) | Per-array `defineColumns<T>()` → per-column `column<T,V>()` across `03-03`/`00-index`/`03-05`/`03-06`/`01-requirements`/`07`/`99` + register. Examples now compile (infer `V` from `value`). |
| PF-003 | 🟡 MINOR | ✅ Applied (Option A) | `stringWidth` added to the ui promotion set (`03-01`, +1 `@example` → 7); `02-current-state`/`01-requirements`/`07` ST-1/`99`/`00-index` updated; container imports it so it measures what the engine draws. |
| PF-004 | 🟡 MINOR | ✅ Applied | `03-05` example: `createEventLoop({…}, { caps })` with a `resolveCapabilities().profile`. |
| PF-005 | 🟡 MINOR | ✅ Applied | `03-05`/`99`: `materialize` coerces `rowAt`'s `T \| undefined` to `display: () => T[]` via a type-guard; RD-11 placeholder reconciliation noted. |
| PF-006 | 🟡 MINOR | ✅ Applied (ii) | `03-03`: `defaultCompare` scoped to number/string/`Date`/null; `CalendarDate` deferred to RD-05's `sortRowsMulti`; JSDoc + impl-test list made consistent. |

**Outcome:** ✅ PASSED — all findings resolved and applied. The plan is ready for `exec_plan`.
