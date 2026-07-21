# 03-04 — Helper Source, Showcase & Security

**Owns:** the shipped async paged windowed-source helper (test fixture + showcase source), the
public barrel exports, the kitchen-sink story, the datagrid-showcase "Data at scale" cluster, the
AC-1 bounded-views assertion, and the security oracle. Pins: ST-18…ST-21.
([AR-13](00-ambiguity-register.md), [AR-14](00-ambiguity-register.md), [AR-17](00-ambiguity-register.md))

## The async paged windowed-source helper

A concrete, correct async windowed source is needed for (a) the tests, (b) the showcase, and (c) the
copy-paste reference that shows the `revision`-signal contract done right ([AR-3](00-ambiguity-register.md)).
It is the runnable proof the whole path works end-to-end.

Shape (a test fixture `packages/datagrid/test/fixtures/async-windowed-source.ts`, and re-used as the
showcase demo source — **not** a public `@jsvision/datagrid` factory in v1; a public `fromWindowed`
adapter is Phase B, [AR-13](00-ambiguity-register.md)):

```ts
interface AsyncWindowedOptions<T> {
  total: number;                                   // grand total (source.length())
  pageSize: number;
  fetchPage: (page: number) => Promise<T[]>;       // caller's async page loader
  rowKey: (row: T) => string | number;
}

function asyncWindowedSource<T>(opts: AsyncWindowedOptions<T>): GridDataSource<T> & { settle(): Promise<void> };
```

Behavior (each pinned by ST-18):
- **Page store** — `Map<pageIndex, T[]>`; **no eviction in v1** ([AR-13](00-ambiguity-register.md)):
  loaded pages are retained, which cleanly sidesteps the dirty-page / edit-loss race. Memory grows
  with visited pages (bounded by the dataset; acceptable for v1, documented).
- **`rowAt(i)`** — `page = Math.floor(i / pageSize)`; returns the cached row or `undefined`, and kicks
  off `ensurePage(page)` on a miss (idempotent — an in-flight page is not re-fetched).
- **`ensureRange(start, end)`** — resolves the covering pages, returns a `Promise<void>` that settles
  when they land (used by tests via `settle()`; **not** the repaint trigger).
- **`revision`** — a `signal<number>`, bumped when a page lands (`revision.set(revision() + 1)`), read
  reactively by the grid → repaint.
- **`length()`** — returns `total`; **`complete()`** — returns `loadedRowCount === total` (drives the
  footer "(loaded)" label until fully scrolled).
- **`setSort`/`setFilter`/`distinct`** — the fixture forwards to server-side spies so ST-12/17 can
  assert push-down and the grid never client-scans. Stable, mutable row references are returned from
  `rowAt` (the `fromReactiveRows` contract, `data-source.ts:113`) so an in-place cell edit persists.

## Barrel exports

`packages/datagrid/src/index.ts` gains: `isWindowed`, `windowedView` (from `windowing.ts`), and the
`revision?()` member is part of the already-exported `GridDataSource` type. Each public **value** export
(`isWindowed`, `windowedView`) carries JSDoc + an `@example` (the `check-jsdoc` gate; a type-only member
like `revision?()` is exempt from the example gate but is still a public-surface change). The helper
source lives in tests/examples, so it is not a public export in v1.

**Public `displayedRows()` contract** ([preflight PF-006](00-preflight-report.md)): the public reactive
readout `displayedRows()` (`grid.ts:906`) returns `this.display()`, which on the windowed path is the
loud lazy view — it supports only `.length` and integer indexing, and any whole-array op (`.map`/spread)
**throws** (03-01). Its JSDoc **must** state this windowed limitation, since "JSDoc is the contract" is
non-negotiable here — a caller must not assume a materialized `T[]` for a windowed grid. (No bounded
copy is materialized for windowed in v1; the doc discloses the limitation.)

## Kitchen-sink story (RD AC-7) — ST-21

Add `packages/datagrid/test/kitchen-sink/stories/data-at-scale.story.ts` + one line in that
`stories/index.ts` — the **datagrid-local** kitchen-sink registry (the per-RD precedent:
`foundation.story.ts` … `validation-lifecycle.story.ts`), which is what
`packages/datagrid/test/kitchen-sink.smoke.spec.test.ts` imports and validates
([preflight PF-005](00-preflight-report.md)). The story: a large (e.g. 100k) windowed dataset scrolling
smoothly, a visible read-out of the loaded-row count vs total ("N of M loaded"), and a brief blurb +
interaction hint. It must pass that datagrid smoke test (mounts headlessly, paints, unique id, required
metadata). The story uses the async windowed source with a synchronous-in-test page loader so the smoke
test is deterministic. (The cross-package examples showcase is covered separately by the datagrid-showcase
cluster below — the two registries are distinct; the plan's earlier draft mis-paired the examples-side
story dir with the datagrid smoke test.)

## Datagrid-showcase "Data at scale" cluster

Replace the RD-11 placeholder in `packages/examples/datagrid-showcase/stories/placeholders.ts` with a
live cluster `stories/data-at-scale/` (the RD-15 living-surface pattern — as RD-07…10/12 each did):
granular one-per-capability demos — a 100k windowed scroll, the `…` loading placeholder in action,
push-down sort/filter over the window, the "(loaded)" footer label, and the in-memory-large variant.
Update the showcase registry counts + any per-category oracle (the RD-07…12 precedent re-bases these).
Both headless tiers (smoke per-demo render + walkthrough shell-navigation) must stay green.

## AC-1 bounded views — ST-19

Assert that rendering a **100k** source creates a bounded number of cell views (≈ visibleRows ×
columns), and that scrolling does **not** grow the view count:

- **Windowed** — the lazy view + single-view body paint only the window.
- **In-memory large** ([AR-17](00-ambiguity-register.md)) — a 100k eager `Signal<T[]>` also yields
  O(visible) views (the single-view body; no per-row `View`). This is the AC's "no per-row View
  explosion" for in-memory large arrays. `materialize`'s O(n) copy runs on data-change, never on
  scroll, so scrolling stays cheap.

The assertion counts mounted views before and after a page-scroll and asserts equality + a bound; it
does **not** run the timed 16 ms bench (AC-4 → RD-14).

## Security oracle ([AR-14](00-ambiguity-register.md)) — ST-20

In `packages/datagrid/test/security.spec.test.ts` (extend the existing oracle):
- **Bounds** — a hostile / oversized scroll never sends `ensureRange` a negative or `> length()` bound
  or a fractional index (clamped to `[0,length())`, integers).
- **Coalescing** — a burst of scroll deltas produces ≤1 `ensureRange` per frame (rate-bounding a
  source; no per-row flood).
- **Static placeholder** — the `…` is a constant, never row-data-derived; a source whose rows carry
  hostile strings still has every rendered cell sanitized at the draw boundary (the existing
  cell-sanitize invariant) — a placeholder row shows only `…`.
- **No persistence bypass** — a windowed edit still routes through `onCommit`/the source; nothing in
  the windowed path writes around it.

## ST coverage (see 07)

- **ST-18** — the async paged source: `undefined` + load-kick on a miss; `ensureRange` settle-able
  Promise; a landed page bumps `revision`; loaded pages retained (no eviction); stable row refs.
- **ST-19** — 100k windowed *and* 100k in-memory render bounded views; scrolling doesn't grow the
  count.
- **ST-20** — security: bounds clamped/integer, bursts coalesced, static placeholder, no persistence
  bypass.
- **ST-21** — kitchen-sink `data-at-scale` story smoke (mounts, paints, unique id, metadata).
