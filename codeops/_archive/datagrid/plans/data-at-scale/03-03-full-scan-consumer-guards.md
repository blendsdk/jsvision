# 03-03 — Full-Scan Consumer Guards

**Owns:** gating every consumer that iterates the whole `display()`/source behind `isWindowed`, so no
windowed path page-faults the dataset. Each guard implements a user/confirmed decision. Pins:
ST-11…ST-17. ([AR-4](00-ambiguity-register.md), [AR-5](00-ambiguity-register.md), [AR-7](00-ambiguity-register.md), [AR-8](00-ambiguity-register.md), [AR-9](00-ambiguity-register.md), [AR-10](00-ambiguity-register.md))

The full-scan sites are inventoried in [02 §Full-scan consumers](02-current-state.md). Each is gated
by the single `isWindowed(this.source)` predicate (03-01). None runs on the eager path, so this
document changes **windowed behavior only**.

## Push-down requirement ([AR-7](00-ambiguity-register.md)) — ST-12

At construction, a windowed source that omits push-down is a **hard misconfiguration** — construction
**throws** ([preflight PF-003](00-preflight-report.md)):

```ts
if (isWindowed(this.source) && (!this.source.setSort || !this.source.setFilter)) {
  throw new Error(
    'A windowed source (ensureRange present) must implement setSort and setFilter — sort/filter ' +
      'cannot run client-side over a partially-loaded dataset.',
  );
}
```

- **Why throw, not `devWarn`:** the `applySort`/`applyFilter` re-anchor scans (`grid.ts:1234-1240`,
  `:1254-1261`) short-circuit on `if (this.source.setSort/​setFilter) return;` — i.e. they are gated by
  push-down *presence*, **not** `isWindowed`. A windowed source lacking push-down would fall through to
  `after.findIndex(…)` on the lazy view and **throw at an unhelpful site** (the loud Proxy). Hard-failing
  at construction makes "windowed ⟹ both `setSort` and `setFilter`" an invariant, so those re-anchor
  early-returns always fire and the `.findIndex` is never reached. (Optional belt-and-suspenders: also
  add `if (this.windowed) return;` before both scans.)
- The client-scan path in `display` is likewise structurally skipped on the windowed path (03-01 returns
  the lazy view before `filterRows`/`sortRowsMulti`). ST-12 asserts construction throws when push-down
  is absent, and that no client `materialize` scan runs when it is present.
- `distinctFor` (`grid.ts:1081-1083`): for a windowed source, require `source.distinct`; the
  `computeDistinct(materialize(source))` fallback is **not** taken (it would page-fault). Missing
  `distinct` → an empty value-list + `devWarn`. The filter-popup sample (`grid.ts:1133`) reads
  `source.rowAt(0)` instead of `materialize(source)[0]`.

## Auto-width ([AR-8](00-ambiguity-register.md)) — ST-11

`measureAutoWidths` scans all rows and would both page-fault and reflow-on-scroll. For a windowed
source:

- `this.autoWidths` (`grid.ts:422`) does **not** call `measureAutoWidths`; it returns the resolved
  fixed/`fr` widths directly. Any column declared `auto` (or width-less) falls back to a fixed default
  width + a one-time `devWarn('windowed-auto-width', …)`.
- `autoFitColumn` (`grid.ts:1019-1027`) is a **no-op** for a windowed source (double-click auto-fit on
  a header does nothing) — it cannot measure unloaded rows without a reflow.

## Footer aggregates ([AR-9](00-ambiguity-register.md)) — ST-13

`FooterController.cell` folds `col.value` over `displayedRows()` — i.e. `this.displayedRows().map(...)`
(`grid-footer.ts:105`), where `displayedRows` is wired to `() => this.display()` (`grid.ts:500`). On the
windowed path that `.map` hits the lazy view. **Windowed footer aggregates are deferred to Phase B**
([preflight PF-001](00-preflight-report.md)):

- **Why deferred, not a loaded-window fold.** There is no cheap way to fold "the loaded window": the
  plan adds only `revision?()` — no loaded-range seam — so discovering which indices are resident would
  mean iterating `rowAt(0…length())`, an O(n) scan that **page-faults / fetch-storms** (each unloaded
  `rowAt` kicks a page fetch). And with **no page eviction** (03-04), a partial "loaded" total would
  drift upward as the user scrolls — a total that changes with no data change is misleading even with a
  label. Both defeat the feature's own O(visible) premise.
- **What ships in v1.** For a windowed source, an aggregate cell renders **blank** (`cell()` returns
  `''`) plus a **one-time `devWarn('windowed-footer', …)`**; the fold is **not** invoked (no `.map` on
  the lazy view, no `rowAt` scan). Concretely, the `FooterController` is told the source is windowed (a
  flag) and `cell()` returns `''` for windowed — note a mere empty dep (`() => []`) would fold to a
  misleading `'0'`/`'Σ 0'`, so the cell must be **truly blank**, not a zero fold.
- **The `complete()`/"(loaded)" honesty seam is unchanged** for the existing partially-loaded **eager**
  path (e.g. a `fromReactiveRows` source with `complete() === false`, exercised by
  `grid-footer.impl.test.ts`) — that path still folds and labels normally. Only the windowed
  (`ensureRange`-present) path defers.
- A server-side grand-total aggregate seam is Phase B.

## Selection ([AR-4](00-ambiguity-register.md)) — ST-14

`GridSelection`'s `displayKeys()` maps `display().map(rowKey)` over the full length (`grid-selection.ts:159`),
which throws/fetch-storms on the lazy view. It is reached by select-all (`selectAllDisplayed`),
tri-state (`currentTriState`), **and range extend** (`extend`, via `rangeToRow`). For a windowed source
([preflight PF-002](00-preflight-report.md)):

- The header **select-all checkbox + tri-state are disabled** — `SyntheticPrefix` omits the header
  select-all affordance (or renders it inert) when `isWindowed`, and `selection.toggleAll()` /
  `currentTriState()` are guarded no-ops.
- **Ctrl/Shift-click *range* selection is also disabled for windowed.** The range path
  (`rangeToRow` → `extend` → `displayKeys()`) routes through the very `display().map(rowKey)` that
  page-faults — you cannot gate that method off for select-all and keep it for range. So Shift-click /
  Shift-arrow range is a guarded no-op on the windowed path.
- **Single-row keyed toggle on a *loaded* row survives** — Ctrl-click / `Space` toggles the clicked
  row's key. But a placeholder `…` row is painted *because* it is unloaded and is still clickable, so
  the guard lives at the `GridSelection` choke points, not just at the click site: `toggleAtRow`,
  `rangeToRow`, `focusedKey`, and the `Space`-toggle path each **no-op when `source.rowAt(i) === undefined`**
  (never calling `rowKey(undefined)`). `handleSelectionClick` (`editable-grid-rows.ts:559`) and the
  `Space`-toggle (`runToggleSelect`) both funnel through those guards. Per-row keyed selection
  (`selectedKeys`) is unaffected — keys are stable across scroll.

## Counts ([AR-10](00-ambiguity-register.md)) — ST-15

`filteredCount()` (`grid.ts:885`) returns `display().length`. On the windowed path `display()` is the
length-correct lazy view, so `display().length === source.length()` already — but to be explicit and
avoid depending on the Proxy `.length`, `filteredCount()` reads `source.length()` directly when
`isWindowed`. `totalCount()` (`grid.ts:896`) already reads `source.length()`. The single-`length()`
limitation (filtered ≡ grand total) stays documented for v1; the N-of-M readout reflects
`source.length()`.

## Mutation ([AR-5](00-ambiguity-register.md)) — ST-16

`RowMutations` (`row-mutations.ts`) client-scans the source for positional ops (`:89` `display().find`,
`:105` `sourceIndexOf` linear scan). For a windowed source:

- `insertRow` **appends** via `source.insert(row)` (no `at` index → append; `data-source.ts:34`) when
  `source.insert` exists; positional insert-at is not attempted.
- `deleteRows` uses `source.remove(keys)` (`data-source.ts:39`) — key-based, no scan.
- `duplicateRow` is a **no-op + `devWarn`** for a windowed source (it needs `display().find` +
  positional insert). Same for any positional insert path.
- `sourceIndexOf`'s linear scan (`:105`) is never reached on the windowed path (append + key-remove
  only).

## The single gate + `grid.ts` thinness

All guards read one memoized `private readonly windowed: boolean` set at construction. The branch
bodies are small delegators in `grid.ts`; any non-trivial windowed logic (the lazy view, the
coalescer helpers) lives in `windowing.ts` / the body, keeping `grid.ts` under its `< 1500` guard.

## ST coverage (see 07)

- **ST-11** — `measureAutoWidths` not invoked for windowed; `auto` → fixed fallback + `devWarn`;
  `autoFitColumn` no-op.
- **ST-12** — windowed source without `setSort`/`setFilter` → **construction throws**; with push-down
  present, a sort/filter gesture fires the `setSort`/`setFilter` spies and triggers no client
  `materialize` scan.
- **ST-13** — windowed footer aggregate cell is **blank + a one-time `devWarn`**; the fold is **not**
  invoked (`rowAt` scan tripwire flat). The eager partial-load "(loaded)" path is unchanged.
- **ST-14** — header select-all/tri-state **and Ctrl/Shift range** disabled for windowed (no
  `display().map(rowKey)`); a Ctrl-click / `Space` on a **loaded** row toggles its key, and the same
  gesture on an **unloaded** (placeholder) row is a no-op (no `rowKey(undefined)`).
- **ST-15** — `filteredCount()` reads `source.length()` on the windowed path.
- **ST-16** — `duplicateRow`/positional insert no-op + `devWarn` for windowed; append via `insert` and
  delete via `remove` still work with no source scan.
- **ST-17** — `distinctFor` requires `source.distinct` for windowed (no `computeDistinct(materialize)`);
  the popup sample reads `source.rowAt(0)`.
