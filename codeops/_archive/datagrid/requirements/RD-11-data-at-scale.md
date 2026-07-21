# RD-11: Data at Scale

> **Document**: RD-11-data-at-scale.md
> **Status**: Draft
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: RD-01
> **CodeOps Skills Version**: 3.4.1

---

## Feature Overview

Making the grid usable on large datasets: continuous virtual scroll over a windowed data source
(100k+ rows), server-side paging via the push-down seams, and — as the opt-in Phase-B alternative to
continuous scroll — a classic pager. The spike proved a windowed `Proxy` dense-array feeds the
unmodified grid at 100k rows; this RD formalizes that as the `GridDataSource` windowing contract and
the two navigation modes.

---

## Functional Requirements

### Must Have

- [ ] **Virtual scroll** — the body renders only the visible row window (plus a small prefetch buffer),
      regardless of total row count; view/allocation cost is O(visible), never O(rows).
- [ ] **Windowed source loading** — the grid calls `source.ensureRange(start, end)` for the visible +
      buffer range; `source.rowAt(i)` returns `undefined` for not-yet-loaded rows, which render as a
      loading placeholder until the range resolves.
- [ ] **Server-side push-down** — sort (`setSort`, RD-05) and filter (`setFilter`, RD-06) delegate to
      the source, which re-queries windows; `length()` reflects the current (filtered) total.
- [ ] **In-memory large arrays** — virtual scroll also applies to a large in-memory `Signal<T[]>`
      source (no per-row `View` explosion).
- [ ] **Frame-budget adherence** — a scroll/edit that changes the visible window recomposes within the
      framework's 16 ms frame budget (measured per RD-14).

### Should Have

- [ ] **Pager mode** — an opt-in `navigation: 'scroll' | 'paged'`; `'paged'` renders fixed-size pages
      with a **pager control** widget (`|◄ ◄  Page n of N  ► ►|`) in the footer (RD-09) and a
      **page-size selector** (25 / 50 / 100 / all). *Phase B.*
- [ ] **Infinite / lazy load-more** scroll mode. *Phase B.*
- [ ] **Pluggable source adapters** — ready-made `GridDataSource` implementations for common backends
      (in-memory, REST). *Phase B; the PostgreSQL adapter belongs to the Data Studio app.*

### Won't Have (Out of Scope)

- The pager backend paging strategy (LIMIT/OFFSET vs keyset) — **deferred (AR #28)**; decided when
  pager mode is planned.
- The PostgreSQL / RecordSet adapter — the separate Data Studio app.

---

## Technical Requirements

### Windowing contract

- `ensureRange(start, end)` may be synchronous (in-memory) or return a `Promise` (async fetch); the
  grid tolerates `rowAt` returning `undefined` in the interim and repaints when the range resolves
  (reactive on a source version/loaded signal).
- The visible window = `[topItem, topItem + visibleRows)`; the prefetch buffer extends it by a small
  configurable margin so scrolling doesn't flash placeholders for already-near rows.
- `length()` is the source's best-known total (exact for in-memory / counted server queries; a lazy
  source may report a growing total).

### Navigation modes

- `'scroll'` (default): continuous, scrollbar-driven, virtual window.
- `'paged'` (Phase B): a presentation over the same source — a page is a window `[page*size,
  (page+1)*size)`; the pager widget drives `page`; the backend strategy (offset vs keyset) is the
  deferred AR-28 decision. `'paged'` and `'scroll'` share the same `GridDataSource`.

---

## Integration Points

- Provides the windowed `GridDataSource` implementations RD-01 abstracts; RD-05/RD-06 push down through
  it; RD-09 hosts the pager/navigator widgets; RD-14 measures the frame budget.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Default navigation | scroll / paged | Continuous virtual scroll | Modern default; pager opt-in | AR #4 |
| Large-data strategy | load-all / windowed | Windowed source (+ prefetch) | 100k-row scale (spike-proven) | AR #14 |
| Pager backend | offset / keyset | Deferred | Decide at Phase-B pager planning | AR #28 |
| Adapters | in-package PG / generic | Generic; PG in Data Studio | Backend-agnostic package | AR #1 |

---

## Security Considerations

- **Data sensitivity**: windows fetch caller data on demand; the grid holds only the loaded window +
  edits in memory.
- **Input validation**: window bounds are clamped to `[0, length())`; a source's `ensureRange` receives
  validated integer ranges.
- **Injection risks**: push-down passes structured sort/filter models (RD-05/06) to the source, which
  parameterizes its queries (caller responsibility); the grid never builds SQL.
- **Rate limiting**: rapid scrolling could burst `ensureRange` calls — the grid coalesces range
  requests per frame (debounced to the visible window) so a source isn't flooded; a source may still
  throttle.
- **Encryption / infrastructure**: N/A (transport is the source's concern).

---

## Acceptance Criteria

1. [ ] Rendering a source of 100,000 rows creates a bounded number of cell views (≈ visible rows ×
       columns), not 100,000; scrolling does not grow the view count (asserted).
2. [ ] Scrolling calls `ensureRange` for the visible + buffer range; a row whose `rowAt` returns
       `undefined` renders the loading placeholder and repaints to the real value when the range
       resolves.
3. [ ] `setSort`/`setFilter` re-query the source (spy-verified) and `length()` reflects the filtered
       total; the visible window re-fetches accordingly.
4. [ ] A window change (scroll by a page) recomposes within the 16 ms budget for a 200×50 viewport
       (measured off-CI per RD-14).
5. [ ] Rapid scroll bursts are coalesced to at most one `ensureRange` per frame for the settled window
       (no per-row flood).
6. [ ] (Should) `navigation: 'paged'` renders fixed-size pages with a working pager control and
       page-size selector in the footer; `'scroll'` and `'paged'` use the same source.
7. [ ] A `datagrid` kitchen-sink story demonstrates a large windowed dataset scrolling smoothly and
       passes the smoke test.
8. [ ] Security verified: window bounds are clamped/validated; `ensureRange` bursts are coalesced.
