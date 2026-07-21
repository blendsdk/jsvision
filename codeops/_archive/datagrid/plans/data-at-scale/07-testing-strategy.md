# 07 — Testing Strategy

Specification test cases (ST-*) derive from the RD acceptance criteria and the register decisions —
each an **immutable oracle**: a failing ST after implementation means the code is wrong, not the test.
Expectations come from the spec, never from imagined implementation behavior. Ordering per phase:
**spec tests → red → implement → green → impl tests → verify**.

**Verify command:** `yarn verify` ([AR-15](00-ambiguity-register.md)).

**Test homes:** a new `packages/datagrid/test/windowing.spec.test.ts` (+ `windowing.impl.test.ts`) for
ST-1…ST-17; `data-source.spec.test.ts` for the `revision` contract; `grid.impl.test.ts` for the
bounded-views assertion; `security.spec.test.ts` for ST-20; `kitchen-sink.smoke.spec.test.ts` for
ST-21. Fixtures: the existing `windowed-source.ts` (eager) + the new `async-windowed-source.ts` — the
latter, plus the `rowAt`-access **scan-tripwire** double, is authored in **task 1.0** (ahead of the
Phase 1/2 spec tests that consume it; the eager fixture cannot yield holes or a `revision` bump).

## Test doubles

- **`asyncWindowedSource`** (03-04) — the async paged source; drives ST-5…ST-18. A **deterministic**
  page loader (resolves on `settle()`/microtask pump) so no wall-clock timing is involved.
- **Push-down spies** — `setSort`/`setFilter`/`distinct`/`ensureRange` recorded as call logs so a test
  asserts push-down fired and no client scan ran.
- A **scan tripwire** — a source whose `rowAt` increments an access counter; a test asserts the access
  count stays ≈ O(window), never ≈ `length()`, proving no full-scan.

## Specification Test Cases

### Phase 1 — Windowed contract & lazy display (03-01)

| ST | Given | Expect |
|----|-------|--------|
| **ST-1** | An `asyncWindowedSource` of `length()===100000` with only rows `[0,50)` loaded | `display().length === 100000` (length-correct, holes preserved); a `rowAt` access tripwire shows `materialize` was **not** called (access count ≈ window, not 100000) |
| **ST-2** | Same source, rows `[0,50)` loaded | `display()[10]` returns the row; `display()[500]` returns `undefined` (holes not collapsed) |
| **ST-3** | A windowed source with a `revision` `signal<number>`; a page lands and bumps it | `display()` re-derives to a **fresh identity** (a bound effect on `() => this.display()` re-runs) → repaint fires |
| **ST-4** | An eager `fromRows` source (no `ensureRange`) | `display()` is a dense materialized array (no `undefined`), client filter/sort still applied — byte-identical to pre-RD-11 (regression guard) |

### Phase 2 — Windowed rendering & prefetch (03-02)

| ST | Given | Expect |
|----|-------|--------|
| **ST-5** | A windowed grid, viewport 20 rows, scrolled so `top===1000`, `prefetch` = one viewport | exactly one `ensureRange(start,end)` with `start===clamp(1000-20,0,n)`, `end===clamp(1000+20+20,0,n)` (visible + buffer, half-open, clamped) |
| **ST-6** | Row 1005 unloaded (`rowAt→undefined`), then its page lands + `revision` bumps | before: each cell of row 1005 paints the muted `…` (not `<empty>`, no crash); after: it repaints to the real values |
| **ST-7** | 5 scroll deltas within one frame, settling at window W; then a draw with the same W | ≤1 `ensureRange` call for W across the burst; the repeat draw at unchanged W issues **no** new call |
| **ST-8** | Scroll near the end (`top` s.t. `top+visible+buffer > length()`); and a hostile fractional/negative `top` | every `ensureRange` arg is an integer in `[0, length()]`; `end` never exceeds `length()`; no negative start (security) |
| **ST-9** | Cursor on an unloaded focused row; user presses F2 / Enter / a printable / value-help | no edit begins (`editableCol()===-1`); `currentCell()===null`; no `rowKey(undefined)` is called (no throw) |
| **ST-10** | A windowed grid with the checkbox + gutter prefix; an unloaded row in view | the synthetic band paints a blank checkbox + `…`/blank gutter for that row (mirrors the body; no crash) |

### Phase 3 — Full-scan consumer guards (03-03)

| ST | Given | Expect |
|----|-------|--------|
| **ST-11** | A windowed source with an `auto`-width column | `measureAutoWidths` is **not** invoked (scan tripwire flat); the column uses a fixed fallback width + a `devWarn`; `autoFitColumn(id)` is a no-op |
| **ST-12** | (a) constructing a windowed source **lacking** `setSort`/`setFilter`; (b) a properly-configured windowed source + a sort click + a filter set | (a) construction **throws**; (b) the `setSort`/`setFilter` spies fire and the gesture triggers **no** `materialize`/client scan (tripwire flat) |
| **ST-13** | A windowed grid with a `sum` footer aggregate, window `[0,50)` loaded | the windowed aggregate cell renders **blank** + a one-time `devWarn`; the fold is **not** invoked (`rowAt` scan tripwire flat — not ≈ 50). (The eager `complete()===false` "(loaded)" fold is unchanged, covered by `grid-footer.impl.test.ts`.) |
| **ST-14** | A windowed grid with the checkbox column; both a **loaded** row and an **unloaded** (placeholder) row in view | header select-all + tri-state disabled/inert **and** Ctrl/Shift **range** disabled (no `display().map(rowKey)` over `length()`); a Ctrl-click / `Space` on the **loaded** row toggles `selectedKeys`; the same gesture on the **unloaded** row is a **no-op** (no `rowKey(undefined)` throw) |
| **ST-15** | A windowed source `length()===100000` with a filter pushed down (server re-reports 4000) | after the re-query `source.length()===4000`, so `filteredCount()===4000`; `totalCount()===4000` **too** — the v1 single-`length()` limitation means filtered ≡ grand total (a distinct grand total is Phase B), so the "N of M" readout's M is the filtered total |
| **ST-16** | A windowed source with `insert`/`remove`; user append / delete / duplicate | append calls `source.insert(row)` (no `at`); delete calls `source.remove(keys)`; `duplicateRow` + positional insert no-op + `devWarn`; no source linear scan (tripwire flat) |
| **ST-17** | A windowed grid opening a value-list filter on a column | `distinctFor` calls `source.distinct(columnId)` (spy fires); `computeDistinct(materialize(...))` is **not** called; the popup sample reads `source.rowAt(0)` |

### Phase 4 — Helper source, showcase & security (03-04)

| ST | Given | Expect |
|----|-------|--------|
| **ST-18** | `asyncWindowedSource({total:100000,pageSize:100,…})` | `rowAt(250)` before load → `undefined` + a page-2 fetch kicked (idempotent); `ensureRange(200,400)` returns a Promise that `settle()` resolves; a landed page bumps `revision`; loaded pages are retained (a re-scroll to a loaded page issues no re-fetch); `rowAt` returns stable, mutable refs (an in-place edit persists) |
| **ST-19** | A 100k windowed grid **and** a 100k in-memory `Signal<T[]>` grid, viewport 30 | each mounts a bounded cell-view count (≈ 30 × columns), and a page-scroll does **not** grow the mounted-view count (asserted equal before/after) — AC-1 |
| **ST-20** | Security oracle: hostile scroll bounds; a burst; a source with hostile row strings | `ensureRange` bounds clamped/integer; ≤1 call/frame; the `…` placeholder is a static constant; every rendered cell sanitized at the draw boundary; a windowed edit still routes through `onCommit` (no persistence bypass) |
| **ST-21** | The kitchen-sink `data-at-scale` story | mounts headlessly, paints non-empty, unique id, required story metadata (smoke) |

## Implementation (impl) test coverage

Beyond the spec oracle, `*.impl.test.ts` covers: the `windowedView` Proxy `has`/`length`/index traps
and non-integer keys, **and its fail-loud contract — a whole-array access (`.map`/`.find`/`.findIndex`/
spread/`for..of`) throws the descriptive error, on both an all-loaded and a partly-loaded source**
([PF-003](00-preflight-report.md)); the coalescer's settled-window de-dup + microtask flush edge cases
(empty source, single-row source, window at exactly `length()`); the `isWindowed` predicate on a source
with `ensureRange` present-but-undefined; the auto-width fallback width value; the **windowed footer
blank-cell + one-time `devWarn`** path (the fold not invoked), alongside the unchanged eager
partial-load "(loaded)" fold; the selection guard (`rowAt(i)===undefined` → toggle/range no-op, no
`rowKey(undefined)`); and the async source's in-flight de-dup + `settle()` with zero pending pages.

## Regression guard (non-negotiable)

The full RD-01…12 datagrid suite + `yarn verify` must stay green at every phase. The eager path takes
**no** windowed branch (`isWindowed` false), so any eager-suite failure means a windowed guard leaked
onto the eager path — a defect. ST-4 is the explicit tripwire.
