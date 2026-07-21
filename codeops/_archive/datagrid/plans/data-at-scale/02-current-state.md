# 02 — Current State

Grounded analysis of the code RD-11 builds on. Every claim is cited to `file:line` as of the
`feat/editable-data-grid` branch (post-RD-12).

## The read path today: source → `materialize` → dense `display()` → the base engine

The `@jsvision/ui` `GridRows` base is **strictly whole-array**. Its config takes `display: () => T[]`
(`packages/ui/src/table/grid-rows.ts:54-56`), read once per draw and indexed per visible row
(`const row = display[item]`, `:228`); `topItem` is a plain field set by the pure `keepVisible`
helper (`packages/ui/src/list/virtual.ts:42`). It has **no** `rowAt`, `ensureRange`, prefetch, or
placeholder notion — any hole would call `accessor(undefined)`.

`@jsvision/datagrid` adapts a `rowAt`/`length` source into that whole-array contract:

- **The source seam** — `GridDataSource<T>` (`packages/datagrid/src/data-source.ts:22-59`): required
  `rowKey`/`length()`/`rowAt(index): T | undefined`, plus the **declared-but-inert** windowing members
  `ensureRange?(start,end): void | Promise<void>` (`:41`, doc "a later release"), `setSort?`/`setFilter?`
  (`:43-45`), `distinct?` (`:51`), and `complete?()` (`:58`, the one shipped partial-load concession —
  drives the footer "(loaded)" label).
- **The materialize collapse** — `materialize(source)` (`grid.ts:221-230`) full-scans
  `rowAt(0…length())` into a **dense** array, *skipping* `undefined` holes. This is the fatal
  incompatibility: a windowed source with holes collapses and loses index alignment. It runs on every
  re-derivation.
- **The `display` computed** — `this.display = this.derived(() => { this.version(); let rows =
  materialize(this.source); if (!setFilter) filterRows(...); if (!setSort) sortRowsMulti(...); })`
  (`grid.ts:415-421`). Client filter/sort is **already skipped when the push-down seam exists** —
  so a windowed source that pushes down is half-way handled; only `materialize` still collapses.
- **Push-down effects** already forward the models to the source when the seams exist
  (`grid.ts:452-465`).

`this.display` is handed straight to the base as `display` and is the single seam read by the body,
header geometry, autoWidths, selection, footer, and mutations (`grid.ts:429,436,500,564`).

## The body owns its draw loop — but not its whole nav surface

`EditableGridRows<T> extends GridRows<T>` (`editable-grid-rows.ts:203`) **fully overrides `draw()`**
(`:759`, its own loop `const row = display[item]` at `:796`) rather than calling `super.draw()`. So
the datagrid controls its own render loop — this is what lets the windowed read path live in the
datagrid with no ui change.

**But** (the red-team's load-bearing correction) the body still routes through **inherited** base code
that reads `this.display().length` and indexes `this.display()[i]`:

- `focusTo` → `this.focused.set(clampIndex(index, this.display().length))` (`grid-rows.ts:317`) —
  reached by every `runAction` row move (`moveUp`/`moveDown`/`pageUp`/`pageDown` call the inherited
  `focusBy`).
- `super.onEvent` mouse path — `range = this.display().length`, `activate()`'s `display[index]`
  (`grid-rows.ts:255,335`); the body calls `super.onEvent(ev)` (`editable-grid-rows.ts:440`).
- `super.updateTop()` — `range = this.display().length` (`grid-rows.ts:166`); called at
  `editable-grid-rows.ts:377`.

**Consequence:** the windowed `display()` **must be length-correct** (`.length === source.length()`).
This rules out a `rowAt`-only read path that ignores `display().length` (it would force base
overrides). The lazy-`Proxy` view satisfies it. ([AR-2](00-ambiguity-register.md))

## Full-scan consumers — the sites that page-fault a windowed source

Every site below iterates the **whole** `display()`/source and must be gated behind `isWindowed`
(they never run on the eager path today; they must be disabled/redirected on the windowed path):

| Site | `file:line` | What it does | Windowed handling ([AR](00-ambiguity-register.md)) |
|------|-------------|--------------|--------------------|
| `measureAutoWidths` | `grid.ts:422` | auto-width scans all rows | skip; fixed/`fr` fallback + `devWarn` (AR-8) |
| `autoFitColumn` | `grid.ts:1019-1027` | `for (const row of this.display())` | no-op for windowed (AR-8) |
| `distinctFor` fallback | `grid.ts:1081-1083` | `computeDistinct(materialize(source))` | require `source.distinct` (AR-7) |
| filter-popup sample | `grid.ts:1133` | `materialize(source)[0]` | read `source.rowAt(0)` (AR-7) |
| selection over display | `grid-selection.ts:159` (`:83,88,153`) | `display().map(rowKey)` for select-all/tri-state/range | disable select-all/tri-state **+ range**; single-row keyed toggle on a loaded row (AR-4, [PF-002](00-preflight-report.md)) |
| footer fold | `grid-footer.ts:105` | `displayedRows().map(col.value)` | windowed → **blank cell + `devWarn`**; live fold deferred to Phase B (AR-9, [PF-001](00-preflight-report.md)) |
| duplicate/positional insert | `row-mutations.ts:89,105` | `display().find` / source linear scan | no-op + `devWarn`; append/delete via seam (AR-5) |
| `filteredCount` | `grid.ts:885` | `display().length` | a `.length` read — **safe on the loud Proxy** (maps to `source.length()`); reads `source.length()` directly (AR-10; not truly a full-scan site, [PF-011](00-preflight-report.md)) |
| re-anchor scans | `grid.ts:1235,1255` | `after.findIndex(...)` after sort/filter | early-return on `setSort`/`setFilter` presence (`:1234,1254`) — **guaranteed to fire** because the windowed push-down requirement hard-fails construction (AR-7, [PF-003](00-preflight-report.md)); a mis-built windowed source can't reach the `.findIndex` |

## Visible-window / single-row consumers — safe once `display()` is length-correct + lazy

These read only the visible window or a single row and need only an `undefined`-guard: the body's own
`draw`/`paintInvalidCells`/`paintDirtyMarkers`/`paintCursorCell`/`currentCell`
(`editable-grid-rows.ts:796,892,937,995,636`), the container single-row reads `focusAnchorKey`/
`focusedRow` (`grid.ts:1217,1291`), and — critically — the **synthetic prefix band**
`SyntheticBodyBand.draw` (`synthetic-columns.ts:222-264`), a *second* view indexing `display[item]`
for the checkbox/gutter. Every body `undefined`-guard must be mirrored there ([AR-16](00-ambiguity-register.md)).

## The reactive repaint template already exists

Two patterns are already load-bearing and are the template for the `revision` seam:

- **A `version` signal read inside the `display` computed** — `grid.ts:338` + `grid.ts:416`
  (`this.version();`) — the exact "bump → recompute → fresh identity → base display-bind repaints"
  mechanism, already used for in-place cell edits.
- **Fresh-identity on a signal** — the base binds `() => this.display()` and repaints on a new array
  reference (`grid-rows.ts:135-141`).

The `revision?()` seam reuses pattern 1 verbatim: `this.display = derived(() => { this.version();
this.source.revision?.(); … })`. ([AR-3](00-ambiguity-register.md))

## Prior art & existing fixtures

- **Eager windowed double** — `packages/datagrid/test/fixtures/windowed-source.ts:17` implements the
  contract with `ensureRange` as a no-op and every row present; its own doc names a real
  `undefined`-yielding source "a later concern" — i.e. this RD.
- **The spike's `Proxy`** — `packages/spike-data-studio/src/windowed-source.ts:71-88` proved a `Proxy`
  (`length` trap → total, integer-index `get` → lazy `rowAt`) feeds the **raw ui** grid at 100k
  (`03b-paging.ts`, `07-scale.ts`), but it page-faults the datagrid's `materialize`/full-scan path —
  its verdict recommends fixed widths + server sort (both are AR-8/AR-7 here). Inert spike package
  (no build/test).
- **`ensureRange`/`prefetch`** — declared only; **never called** in production (`data-source.ts:40-41`).
- **Footer honesty** — `grid-footer.impl.test.ts:124-131` + `.../honesty.story.ts:31-37` already
  exercise a windowed source with `complete() === false`.
- **Line guards** — `grid.ts` is at `< 1500` (1472 lines); the RD-08/09/10/12 discipline puts new
  logic in a new module. This plan adds `windowing.ts` and keeps `grid.ts` thin.

## Test & story surface

- Datagrid tests live in `packages/datagrid/test/` (`*.spec.test.ts` immutable oracle + `*.impl.test.ts`).
  Relevant homes: `data-source.spec.test.ts`, a new `windowing.spec.test.ts`, `security.spec.test.ts`,
  `grid.impl.test.ts`, `kitchen-sink.smoke.spec.test.ts`.
- Kitchen-sink story: the **datagrid-local** registry `packages/datagrid/test/kitchen-sink/stories/`
  (+ its `stories/index.ts`) — this is what the smoke test `packages/datagrid/test/kitchen-sink.smoke.spec.test.ts`
  imports and validates. (The separate `packages/examples/kitchen-sink/` registry is a different
  package gated by `packages/examples/test/kitchen-sink.smoke.spec.test.ts`; see [PF-005](00-preflight-report.md).)
- Showcase: `packages/examples/datagrid-showcase/stories/` has per-RD placeholders in `placeholders.ts`
  — RD-11's is replaced by a live "Data at scale" cluster (the RD-15 living-surface pattern).
