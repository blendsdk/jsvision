# 99 — Execution Plan

> **Implements**: datagrid/RD-11 (Must-Have slice)
> **CodeOps Skills Version**: 3.8.0
> **Progress**: 34 / 34 tasks (100%) · 4 / 4 phases
> **Last Updated**: 2026-07-18 03:27

Four phases, **foundation-first**, each in the mandatory three-session order
(**Spec Tests → Implementation → Impl Tests & Hardening**) with spec-first ordering enforced
(`spec → red → implement → green → impl → verify`). All new logic lands in a new `windowing.ts`;
`grid.ts` stays a thin `isWindowed`-guarded delegator under its `< 1500` line guard. **Verify** every
task with `yarn verify` ([AR-15](00-ambiguity-register.md)). Commit via `/gitcm` / `/gitcmp` per the
active commit mode.

**Zero-regression invariant:** the eager path takes no windowed branch — the RD-01…12 suite must stay
green at every task. ST-4 is the tripwire.

---

## Phase 1 — Windowed contract & lazy display (03-01) · ST-1…ST-4

*Session 1.0 — Test tooling (prerequisite; [PF-004](00-preflight-report.md))*
- [x] 1.0 Author the `async-windowed-source.ts` fixture in full (page store, **no eviction**; `rowAt` load-kick + in-flight de-dup; settle-able `ensureRange` + `settle()`; `revision` `signal<number>`; `complete()`; `setSort`/`setFilter`/`distinct` push-down spies; stable mutable refs) **and** the `rowAt`-access **scan-tripwire** double (realized as the fixture's `rowAtCount()`/`resetCounts()` access counter — no dead standalone double). These are test tooling and a hard prerequisite for ST-1/ST-3 (this phase) and ST-5…ST-10 (Phase 2) — the existing eager `windowed-source.ts` can yield neither holes nor a `revision` bump. Pin the fixture's own contract with ST-18 (in 4.1). **Also (runtime [AR-18](00-ambiguity-register.md)): dropped the eager `windowed-source.ts` fixture's no-op `ensureRange`** so `isWindowed` doesn't misclassify it (zero-regression precondition). ✅ (completed: 2026-07-18 02:24)

*Session 1A — Spec tests (red)*
- [x] 1.1 Write `data-source.spec.test.ts` cases for the `revision?()` contract + `windowing.spec.test.ts` ST-1 (length-correct, no `materialize`) and ST-2 (holes not collapsed), using the async source's tripwire (built in 1.0) — verify **red**. ✅ (completed: 2026-07-18 02:24)
- [x] 1.2 Write `windowing.spec.test.ts` ST-3 (a `revision` bump re-derives `display()` to a fresh identity) and ST-4 (eager path stays dense/byte-identical) — verify **red**. ✅ (completed: 2026-07-18 02:24)

*Session 1B — Implementation (green)*
- [x] 1.3 Add the optional reactive `revision?(): number` member to `GridDataSource<T>` (`data-source.ts`) with JSDoc spelling out the "must be a tracked signal read" contract. ✅ (completed: 2026-07-18 02:24)
- [x] 1.4 Create `windowing.ts` with `isWindowed(source)` and `windowedView(source)` (the length-correct lazy **fail-loud** `Proxy` — whole-array access throws, per [PF-003](00-preflight-report.md)/03-01), each with JSDoc + `@example`. ✅ (completed: 2026-07-18 02:24)
- [x] 1.5 Make the `display` computed windowed-aware (`grid.ts:415`): read `source.revision?.()`; return `windowedView(source)` when `isWindowed`, else the unchanged `materialize` + client filter/sort path. Memoize `private readonly windowed = isWindowed(opts.source)`. ✅ (completed: 2026-07-18 02:24)
- [x] 1.6 Verify ST-1…ST-4 **green**; full `yarn verify` green (zero eager regression). ✅ (completed: 2026-07-18 02:24)

*Session 1C — Impl tests & hardening*
- [x] 1.7 `windowing.impl.test.ts`: Proxy `has`/`length`/index/non-integer-key traps; **the fail-loud contract — a whole-array access (`.map`/`.find`/`.findIndex`/spread/`for..of`) throws, on both all-loaded and partly-loaded sources** ([PF-003](00-preflight-report.md)); `isWindowed` on an `ensureRange`-present-but-undefined source; `revision` absent (eager) is an inert read. Verify. ✅ (completed: 2026-07-18 02:24)

---

## Phase 2 — Windowed rendering, prefetch & coalescing (03-02) · ST-5…ST-10

*Session 2A — Spec tests (red)*
- [x] 2.1 `windowing.spec.test.ts` ST-5 (window → `ensureRange(visible+buffer)`, clamped) + ST-7 (per-frame coalesce + settled-window de-dup) + ST-8 (bounds clamped/integer, security) — verify **red**. ✅ (completed: 2026-07-18 02:48)
- [x] 2.2 ST-6 (unloaded row paints `…`, repaints on `revision`) + ST-9 (unloaded focused cell read-only) + ST-10 (synthetic band placeholder) — verify **red**. ✅ (completed: 2026-07-18 02:48)

*Session 2B — Implementation (green)*
- [x] 2.3 Inject `ensureRange`/`rowCount`/`prefetch` seams into `EditableGridRowsConfig`; add `requestWindow(top, visibleRows)` + `coalesceEnsureRange` (microtask, settled-window de-dup, bounds clamp) to the body; call it from `draw` once the window is resolved (windowed only). ✅ (completed: 2026-07-18 02:48)
- [x] 2.4 Add the muted `…` placeholder paint (`paintPlaceholderRow`) in the body's draw loop for an `undefined` row — **fg-only**: `ctx.color('inputPlaceholder').fg` over the row-band bg, never the role's own bg ([PF-007](00-preflight-report.md)); skip cursor/dirty/invalid overpaints. Wire the `prefetch?: number` option through `grid.ts` → `grid-panels.ts` → the body, with **unset ⇒ buffer = current `visibleRows`** (dynamic, per-draw; no static default — [PF-008](00-preflight-report.md)). ✅ (completed: 2026-07-18 02:48)
- [x] 2.5 Mirror the `undefined`-guard + placeholder into `SyntheticBodyBand.draw` (`synthetic-columns.ts`) — blank checkbox + `…`/blank gutter ([AR-16](00-ambiguity-register.md)). ✅ (completed: 2026-07-18 02:48)
- [x] 2.6 Read-only unloaded-focused guards: `editableCol()` / `currentCell()` return `-1`/`null` on an `undefined` row; `focusedRow()`/`focusAnchorKey()` (`grid.ts`) return `null`/`undefined` (no `rowKey(undefined)`); the row-gate treats a null focused row as nothing-to-validate ([AR-12](00-ambiguity-register.md)). ✅ (completed: 2026-07-18 02:48)
- [x] 2.7 Verify ST-5…ST-10 **green**; confirm the coalescing scheduler against the event loop (record a `(runtime)` AR note if it must change); full `yarn verify` green. ✅ (completed: 2026-07-18 02:48)

*Session 2C — Impl tests & hardening*
- [x] 2.8 `windowing.impl.test.ts`: coalescer edges (empty/single-row source, window at exactly `length()`, back-to-back settles); placeholder precedence vs zebra/selected row band. Verify. ✅ (completed: 2026-07-18 02:48)

---

## Phase 3 — Full-scan consumer guards (03-03) · ST-11…ST-17

*Session 3A — Spec tests (red)*
- [x] 3.1 `windowing.spec.test.ts` ST-11 (auto-width skipped + fallback + `devWarn`; `autoFitColumn` no-op) + ST-12 (push-down required `devWarn`; no client scan) + ST-17 (`distinct` required; sample via `rowAt(0)`) — verify **red**. ✅ (completed: 2026-07-18 03:07)
- [x] 3.2 ST-13 (windowed footer aggregate blank + `devWarn`; fold not invoked) + ST-14 (select-all/tri-state **and range** disabled; keyed toggle on a loaded row, no-op on an unloaded row) + ST-15 (`filteredCount` reads `source.length()`; filtered ≡ grand total v1) + ST-16 (append/delete via seam; duplicate/positional no-op + `devWarn`) — verify **red**. ✅ (completed: 2026-07-18 03:07)

*Session 3B — Implementation (green)*
- [x] 3.3 Construction guard: **throw** when a windowed source omits `setSort`/`setFilter` (hard-fail, not `devWarn` — guarantees the `applySort`/`applyFilter` re-anchor early-returns fire so `.findIndex` never hits the loud Proxy; [PF-003](00-preflight-report.md)); `distinctFor` requires `source.distinct` (no `computeDistinct(materialize)`); the filter-popup sample reads `source.rowAt(0)` ([AR-7](00-ambiguity-register.md)). ✅ (completed: 2026-07-18 03:07)
- [x] 3.4 Auto-width: `autoWidths` skips `measureAutoWidths` for windowed (fixed/`fr`, `auto`→fixed fallback + `devWarn`); `autoFitColumn` no-op ([AR-8](00-ambiguity-register.md)). ✅ (completed: 2026-07-18 03:07)
- [x] 3.5 Footer: for a windowed source, aggregate cells render **blank + a one-time `devWarn`** (the live loaded-window fold is deferred to Phase B — no cheap loaded-range seam, and a no-eviction fold would drift/mislead; [PF-001](00-preflight-report.md)). Do **not** wire a folding `displayedRows` dep for windowed. The eager `complete()`/"(loaded)" fold is unchanged ([AR-9](00-ambiguity-register.md)). ✅ (completed: 2026-07-18 03:07)
- [x] 3.6 Selection: disable header select-all + tri-state **and Ctrl/Shift range** for windowed (all route through `display().map(rowKey)`; prefix omits/inerts the select-all affordance). Keep only single-row keyed toggle (Ctrl-click / `Space`) on a **loaded** row, guarded at the `GridSelection` choke points — `toggleAtRow`/`rangeToRow`/`focusedKey`/`runToggleSelect` no-op when `source.rowAt(i) === undefined` (never `rowKey(undefined)`) ([AR-4](00-ambiguity-register.md), [PF-002](00-preflight-report.md)). ✅ (completed: 2026-07-18 03:07)
- [x] 3.7 Counts + mutation: `filteredCount()` reads `source.length()` for windowed ([AR-10](00-ambiguity-register.md)); `insertRow` appends via `source.insert`, `deleteRows` via `source.remove`, `duplicateRow`/positional insert no-op + `devWarn` ([AR-5](00-ambiguity-register.md)). ✅ (completed: 2026-07-18 03:07)
- [x] 3.8 Verify ST-11…ST-17 **green**; full `yarn verify` green; confirm `grid.ts` under `< 1500`. ✅ (completed: 2026-07-18 03:07)

*Session 3C — Impl tests & hardening*
- [x] 3.9 `windowing.impl.test.ts`: fallback width value; the **windowed footer blank + one-time `devWarn`** (fold not invoked); the **selection loaded-guard** (toggle/range no-op on an unloaded row, no `rowKey(undefined)`); select-all inert-affordance render; append-at-append-index behavior. Verify. ✅ (completed: 2026-07-18 03:07)

---

## Phase 4 — Helper source, showcase, barrel & security (03-04) · ST-18…ST-21

*Session 4A — Spec tests (red)*
- [x] 4.1 `windowing.spec.test.ts` ST-18 over the async source (built in **task 1.0**): miss→undefined+load-kick, settle-able `ensureRange`, `revision` bump, retained pages, stable refs — verify (pins the fixture's contract). ✅ (completed: 2026-07-18 03:27)
- [x] 4.2 `grid.impl.test.ts` ST-19 (100k windowed **and** 100k in-memory → bounded views, scroll doesn't grow the count) + `security.spec.test.ts` ST-20 (bounds/coalesce/static placeholder/no persistence bypass) — verify **red**. ✅ (completed: 2026-07-18 03:27)

*Session 4B — Implementation (green)*
- [x] 4.3 Wire `asyncWindowedSource` (built in **task 1.0**: page store, no eviction; `rowAt` load-kick + in-flight de-dup; `ensureRange` Promise + `settle()`; `revision` signal; `complete()`; push-down/`distinct` spies; stable mutable refs) as the datagrid-showcase demo source; confirm it satisfies ST-12/17/18 ([AR-13](00-ambiguity-register.md)). **Exec note:** the datagrid *test* fixture can't be imported cross-package by `packages/examples` (which consumes the **built** `@jsvision/datagrid`), so the showcase uses a small package-local twin `stories/lib/windowed-source.ts` (same shape: lazy page loading + `revision` repaint + real `setSort`/`setFilter` push-down over a backing array). The fixture itself is validated by ST-18 (task 4.1) + the 4.8 edge tests. ✅ (completed: 2026-07-18 03:27)
- [x] 4.4 Barrel: export `isWindowed`/`windowedView` from `src/index.ts` with JSDoc `@example`; ensure `GridDataSource.revision?()` is documented; **update the public `displayedRows()` JSDoc to disclose the windowed limitation** (`.length` + integer index only; whole-array ops throw — [PF-006](00-preflight-report.md)). Run `yarn check:docs` (JSDoc `@example` gate) + a plain grep for banned CodeOps IDs in `packages/*/src`. ✅ (completed: 2026-07-18 03:27)
- [x] 4.5 **Kitchen-sink story** — `packages/datagrid/test/kitchen-sink/stories/data-at-scale.story.ts` + one line in that **datagrid-local** `stories/index.ts` (the registry the datagrid smoke test imports; [PF-005](00-preflight-report.md)): a 100k windowed scroll with an "N of M loaded" read-out + blurb/hint (mandatory showcase gate). Make ST-21 (`packages/datagrid/test/kitchen-sink.smoke.spec.test.ts`) pass. ✅ (completed: 2026-07-18 03:27)
- [x] 4.6 Datagrid-showcase "Data at scale" cluster — replace the RD-11 placeholder (`placeholders.ts`) with `stories/data-at-scale/` demos (100k scroll · `…` placeholder · push-down over the window · "(loaded)" footer · in-memory-large); re-base the showcase registry counts + per-category oracle; keep both headless tiers green. **Exec note (scope):** shipped as **2** live demos under a new `Data at scale` category — `scroll-100k` (windowed virtual scroll, which inherently demonstrates the `…` placeholder AND push-down-on-header-click) and `in-memory-large` (the eager 100k AC-1 variant). The `…` placeholder + push-down are folded into `scroll-100k` (they are the same grid, not separate screens); the "(loaded)" footer honesty label is already showcased by the existing `footer-master-detail/honesty` story, so it was not duplicated. RD-11 removed from `placeholders.ts`; the smoke oracles re-based (Roadmap 3→2, new `Data at scale`=2 category). A caller wanting finer-grained demos can split `scroll-100k` further. ✅ (completed: 2026-07-18 03:27)
- [x] 4.7 Verify ST-18…ST-21 **green**; full `yarn verify` green. ✅ (completed: 2026-07-18 03:27)

*Session 4C — Impl tests & hardening*
- [x] 4.8 `async-windowed-source` impl edges: in-flight de-dup, `settle()` with zero pending, a window straddling two unloaded pages; reconcile the kitchen-sink-gate checklist. ✅ (completed: 2026-07-18 03:27)
- [x] 4.9 Final full `yarn verify` (turbo all green); confirm zero RD-01…12 regression; `grid.ts` under `< 1500`; run `yarn lint:fix` before any PR-bound push (prime directive) and commit what it changes. ✅ (completed: 2026-07-18 03:27)

---

## Roadmap sync

- On start: set the datagrid RD-11 row to `Executing` (🔄) via the roadmap skill; cascade the
  portfolio `codeops/00-roadmap.md` datagrid row.
- On completion: set RD-11 to `Done` (✅), bump the feature progress to 13/15, cascade the portfolio.

## Notes for the executor

- **Grid `< 1500` guard** — keep new logic in `windowing.ts` + the body; `grid.ts` holds thin
  delegators. Re-base the guard only if the irreducible public surface crosses it (record the number
  as a `(runtime)` AR, never re-inline).
- **Scheduler** — the coalescer's per-frame flush (`queueMicrotask` in the spec) must be reconciled
  with the actual event-loop frame cadence at task 2.7; the invariant is *≤1 `ensureRange` per settle
  per frame*, not the specific primitive. Note ([PF-010](00-preflight-report.md)): `queueMicrotask`
  bounds to ≤1 per *task* — a multi-task burst (key-repeat / a scrollbar drag where each event is its
  own task) can still fire once per task within a frame, so confirm the chosen primitive meets AC-5's
  "per frame" against the real loop (a repaint/rAF-cadence flush may be needed).
- **No `@jsvision/ui` change** — if a task appears to need one, STOP and surface it (the design's
  premise is zero ui touch; a required ui change is a plan deviation, not a silent edit).
- **Zero-ambiguity during execution** — any detail not covered here → STOP, present options, record a
  `(runtime)` AR in `00-ambiguity-register.md`, then resume.
