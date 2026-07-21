# 01 — Requirements

> **Source**: [RD-11](../../requirements/RD-11-data-at-scale.md)
> **Implements**: datagrid/RD-11 (Must-Have slice — [AR-1](00-ambiguity-register.md))

## Scope delta over RD-11

RD-11 formalizes the windowed `GridDataSource` contract and two navigation modes. This plan ships the
**Must-Have** slice — continuous virtual scroll over a windowed/async source — and defers the
Should-Have pager, infinite scroll, and pluggable adapters to a Phase-B plan.

### IN scope (this plan)

- **Virtual scroll over a windowed source.** `display()` becomes a length-correct lazy view on the
  windowed path (skipping `materialize`), so view/allocation cost is O(visible), never O(rows).
  ([AR-2](00-ambiguity-register.md); RD Must-Have "Virtual scroll", AC-1)
- **Windowed source loading.** The body drives `source.ensureRange(start, end)` for the visible
  window plus a one-viewport prefetch buffer; `source.rowAt(i)` returning `undefined` renders a muted
  `…` placeholder that repaints to the real value when the range resolves. ([AR-6](00-ambiguity-register.md), [AR-11](00-ambiguity-register.md); RD Must-Have "Windowed source loading", AC-2)
- **Repaint reactivity.** A new optional reactive `revision?()` member on `GridDataSource`, read
  inside the `display` computed, drives the repaint on a landed page. ([AR-3](00-ambiguity-register.md))
- **Server-side push-down (required for windowed).** `setSort`/`setFilter` delegate to the source;
  `distinct` delegates for value-lists; `length()` reflects the current (filtered) total. A windowed
  source missing `setSort`/`setFilter` → **construction throws** (hard-fail), so the client-scan path can
  never run. ([AR-7](00-ambiguity-register.md), [AR-10](00-ambiguity-register.md); RD Must-Have "Server-side push-down", AC-3)
- **In-memory large arrays.** Virtual scroll also applies to a large in-memory `Signal<T[]>` source
  (no per-row `View` explosion); AC-1 is asserted for both eager-large and windowed. ([AR-17](00-ambiguity-register.md); RD Must-Have "In-memory large arrays")
- **Per-frame coalescing.** Rapid scroll bursts collapse to ≤1 `ensureRange` per frame for the
  settled window. ([AR-11](00-ambiguity-register.md); RD AC-5, AC-8)
- **Windowed-source behavior under scale** — the red-team landmines, each user-decided:
  auto-width forces fixed/`fr` ([AR-8](00-ambiguity-register.md)); windowed footer aggregates render
  blank + `devWarn` — the live fold is deferred to Phase B ([AR-9](00-ambiguity-register.md)); header
  select-all/tri-state **and Ctrl/Shift range** disabled, single-row keyed toggle on a loaded row kept
  ([AR-4](00-ambiguity-register.md)); mutation is append+delete via the
  seam, no positional ([AR-5](00-ambiguity-register.md)); an unloaded focused cell is read-only
  ([AR-12](00-ambiguity-register.md)); the synthetic prefix band mirrors the body ([AR-16](00-ambiguity-register.md)).
- **A shipped async windowed-source helper** (test fixture + showcase source): page store + `revision`
  signal + settle-able `ensureRange`, no eviction in v1. ([AR-13](00-ambiguity-register.md))
- **Kitchen-sink story** + **datagrid-showcase "Data at scale" cluster** (replacing the RD-11
  placeholder) + a **security oracle**. ([AR-14](00-ambiguity-register.md); RD AC-7, AC-8)

### OUT of scope (Phase B — a later plan)

- **Pager mode** (`navigation: 'paged'` + `|◄ ◄ Page n of N ► ►|` control + page-size selector) and
  the pager backend strategy (offset vs keyset — RD AR #28). ([AR-1](00-ambiguity-register.md); RD Should-Have, AC-6)
- **Infinite / lazy load-more** scroll mode. (RD Should-Have)
- **Pluggable public adapters** — a `fromWindowed` / REST `GridDataSource` factory; LRU page eviction
  + dirty-page pinning. ([AR-13](00-ambiguity-register.md); RD Should-Have)
- **Windowed footer aggregates** — both the live loaded-window fold **and** the server-side grand-total
  seam (footer over the whole dataset). Windowed aggregate cells render blank + `devWarn` in v1.
  ([AR-9](00-ambiguity-register.md), [PF-001](00-preflight-report.md))
- **A separate filtered-vs-grand total split** on the source. ([AR-10](00-ambiguity-register.md))
- **The AC-4 16 ms frame-budget measurement** — RD-14 owns the perf bench. This plan asserts AC-1
  (bounded view count) but does not run the timed bench.
- The PostgreSQL / RecordSet adapter — the separate Data Studio app.

## Acceptance-criteria mapping

| RD AC | Covered by | ST |
|-------|-----------|-----|
| AC-1 (bounded cell views at 100k; scroll doesn't grow the count) | 03-01, 03-04 | ST-1, ST-19 |
| AC-2 (`ensureRange` for the window; `undefined` → placeholder → repaint on resolve) | 03-02 | ST-5, ST-6 |
| AC-3 (`setSort`/`setFilter` re-query; `length()` filtered total; window re-fetches) | 03-03 | ST-12, ST-15 |
| AC-4 (16 ms recompose, measured off-CI) | **Deferred to RD-14** | — (AC-1 boundedness asserted via ST-19) |
| AC-5 (rapid scroll coalesced to ≤1 `ensureRange`/frame) | 03-02 | ST-7 |
| AC-6 (pager mode) | **Phase B** | — |
| AC-7 (kitchen-sink story, large windowed dataset, smoke) | 03-04 | ST-21 |
| AC-8 (bounds clamped/validated; bursts coalesced) | 03-02, 03-04 | ST-8, ST-20 |
