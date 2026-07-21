# Current State: Export & Layout Variants

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

Grounded analysis of the code this plan builds on. Every claim is cited to `file:line` on the
`feat/editable-data-grid` branch **as re-verified at the execution-gate preflight refresh (post-RD-11
merged)** ([AR-2](00-ambiguity-register.md)). RD-11 added ~48 lines to `grid.ts` (now **1520**) and a
windowed read path (`windowing.ts`); every symbol below still exists, but the one behavioral change
that matters here is that `displayedRows()` is now **fail-loud** on a windowed source (see
[00-preflight-report §PF-001](00-preflight-report.md)).

## Existing Implementation

### What Exists — the read side is already public

The grid container (`EditableDataGrid`, `grid.ts:297`) already exposes the reactive **read** surface
export and variant-save need:

| Need | Public getter | `file:line` |
|------|---------------|-------------|
| Filtered + sorted rows (the export row set) | `displayedRows(): readonly T[]` — ⚠️ **fail-loud lazy view on a windowed source** (whole-array ops throw; see PF-001) | `grid.ts:946` |
| Visible columns, effective display order | `columnOrder(): string[]` (visible only) | `grid.ts:956` |
| Resolved column width | `columnWidth(id): number` | `grid.ts:1006` |
| Frozen partition | `frozen(): { left, right }` | `grid.ts:1047` |
| Sort model | `sort(): SortKey[]` | `grid.ts:868` |
| Filter model | `filterModel(): FilterModel` | `grid.ts:906` |

The typed column carries everything the serializer needs: `GridColumn<T,V>` has `id`, `title`,
`value(row): V`, and optional `format(value, row): string` — when `format` is absent the cell shows
`String(value)` (`column.ts:31-45`). So a cell's export text is
`col.format ? col.format(col.value(row), row) : String(col.value(row))`.

### What Exists — the write side variants restore

The layout **write** surface is also public and reactive: `setColumnOrder(ids)` (`grid.ts:967`),
`setColumnWidth(id, w)` (`grid.ts:1017`), `setColumnVisible(id, visible)` (`grid.ts:1033`), `sortBy` /
`addSort` / `clearSort` (`grid.ts:823-859`), `setFilter` / `clearFilter` (`grid.ts:879-897`). These
mutate private signals: `columnOrderSig` (`grid.ts:373`), `hidden` (`grid.ts:375`), `columnWidths`
(`grid.ts:374`), `sortKeys` (`grid.ts:365`, read in `display` at `grid.ts:437`), `filters`
(`grid.ts:369`, read at `grid.ts:436`).

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/datagrid/src/export-view.ts` | **NEW** — pure `serializeView` (csv/html/json/tsv) | Create |
| `packages/datagrid/src/variant.ts` | **NEW** — `GridVariant` type + pure `buildVariant` / `resolveVariant` | Create |
| `packages/datagrid/src/grid.ts` | Container | Add thin `exportView`/`saveVariant`/`applyVariant`/`setFrozen`; make `freezeSpec` a signal |
| `packages/datagrid/src/index.ts` | Barrel | Export `ExportFormat`, `GridVariant`, `GridVariantColumn` types |
| `packages/datagrid/src/column.ts` | `GridColumn` shape | Read-only (source of `title`/`value`/`format`) |
| `packages/datagrid/src/column-model.ts` | `FreezeSpec`/`partition` | Read-only (reused by `setFrozen`) |

## Gaps Identified

### Gap 1: No public column-metadata accessor
**Current Behavior:** `columnMap` is `private` (`grid.ts:392`); `opts.columns` is not re-exposed on
the instance. A free function outside the class cannot read a column's `title`/`format`.
**Required Behavior:** the exporter must resolve visible ids → `{ title, format, value }`.
**Fix Required:** make export a **method** (`grid.exportView`) with private access, delegating to the
pure `serializeView` ([AR-18](00-ambiguity-register.md)). No new public surface.

### Gap 2: Freeze is construction-only — no runtime setter
**Current Behavior:** `freezeSpec` is a `private readonly` field declared at `grid.ts:376` and set
once in the constructor (`grid.ts:417`); `partitionSig` derives `partition(visibleIds(), this.freezeSpec)`
(`grid.ts:472`); the `rawPartition`/over-freeze region (`grid.ts:699,707`) and its `devWarn`
(`grid.ts:709`) also read it. `frozen()` reads the partition but nothing re-applies freeze.
**Required Behavior:** `applyVariant` must restore freeze.
**Fix Required:** convert `freezeSpec` → a `signal<FreezeSpec>`, read it at all three sites
(`grid.ts:472`, `699`, `707`), and add `setFrozen(left, right)` that sets it. The existing effect that
rebuilds the body "when the partition SHAPE changes" (`grid.ts:677`) already reacts to a partition
change — freeze re-pins with no new rebuild path. ([AR-3](00-ambiguity-register.md))

### Gap 3: `setColumnOrder` accepts only a visible permutation
**Current Behavior:** `setColumnOrder(ids)` rejects any input whose length/set ≠ the currently-visible
ids, then splices them back into the full order keeping hidden columns anchored (`grid.ts:967-977`).
**Required Behavior:** `applyVariant` restores the **full** order (hidden columns interleaved at the
variant's positions), which is not a visible permutation.
**Fix Required:** `applyVariant` (a method) sets the private `columnOrderSig` + `hidden` directly, in
the fixed restore sequence ([AR-14](00-ambiguity-register.md)) — it does **not** route through the
public `setColumnOrder`.

### Gap 4: `grid.ts` line budget
**Current Behavior:** `grid.ts` is at **1520** lines against a **< 1550** guard (RD-11 re-based it from
< 1500 for the windowing surface). The guard is asserted in **three** impl tests —
`grid-selection.impl.test.ts:190`, `grid-footer.impl.test.ts:78`, `navigation.impl.test.ts:144` —
**not** `grid.impl.test.ts` (which has no line guard).
**Required Behavior:** add four documented public methods (`exportView`/`saveVariant`/`applyVariant`/
`setFrozen`) + the `freezeSpec`-signal edit.
**Fix Required:** all serialization/variant logic lives in `export-view.ts` / `variant.ts`; grid.ts
gets only thin delegators ([AR-15](00-ambiguity-register.md)). **Headroom is ~30 lines and four
`@example`-bearing public methods will very likely cross it**, so plan on re-basing the guard (→ ~1600)
with rationale in all three test files — the RD-10/RD-12/RD-11 precedent. Never met by re-inlining the
logic. Flagged as a risk below.

## Dependencies

### Internal Dependencies
- `GridColumn` (`column.ts`) — `title`/`value`/`format`.
- `SortKey` (`sort.ts`), `ColumnFilter` / `FilterModel` (`filter.ts`) — the variant's sort/filter fields.
- `FreezeSpec` / `partition` (`column-model.ts`) — reused by `setFrozen`.
- `sanitize` (`@jsvision/core`, already a datagrid dep) — control-byte stripping at the serialization boundary.

### External Dependencies
- None. The package stays zero-runtime-dependency (`check:deps`). TSV-to-clipboard uses
  `@jsvision/web`'s `setClipboard` **only from the showcase** — the datagrid never imports web
  ([AR-10](00-ambiguity-register.md)).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| RD-11 mutated grid.ts/data-source.ts → stale citations | Resolved | — | ✅ RD-11 landed; execution-gate preflight refresh completed — citations re-verified, `displayedRows()` fail-loud change caught (PF-001), line budget corrected (PF-004). See `00-preflight-report.md`. |
| `freezeSpec` → signal breaks an RD-07 freeze invariant | Low | High | `partition`/`overPinnedIds` are pure and unchanged; only the *source* of the spec changes; RD-07 freeze specs stay green (regression suite) |
| `grid.ts` crosses the < 1550 guard | High | Low | Thin delegators only; **plan on re-basing the guard (→ ~1600) with rationale in all three guard tests** (RD-10/RD-12/RD-11 precedent) — ~30-line headroom vs four documented methods makes a re-base near-certain |
| Formula-escape mangles legitimate negatives (`-5` → `'-5`) | Certain | Low | Documented, accepted OWASP tradeoff for the RD escape set ([AR-7](00-ambiguity-register.md)); noted in JSDoc |
| `exportView` called on a windowed grid | Low | Med | **Hard-guarded:** `exportView` throws a clear "unsupported on windowed" error (mirrors `autoFitColumn`/`distinctFor`), never the generic proxy error; windowed export is a follow-up ([AR-2](00-ambiguity-register.md), PF-001) |
