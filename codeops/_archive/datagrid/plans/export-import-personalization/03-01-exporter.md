# Exporter: Export & Layout Variants

> **Document**: 03-01-exporter.md
> **Parent**: [Index](00-index.md)

## Overview

The pure serializer `export-view.ts` turns a **snapshot of the current view** (resolved visible
columns + the filtered/sorted rows) into a CSV / HTML / JSON / TSV string, and the thin
`grid.exportView(format)` method that gathers that snapshot from the grid's private state and calls it.
Serialization is view-free and signal-free — every function is directly unit-testable from plain
inputs, matching `sort.ts` / `filter.ts` / `aggregate.ts`.

## Architecture

### Current Architecture
No exporter exists. The grid exposes `displayedRows()` (`grid.ts:946`), `columnOrder()` (`grid.ts:956`),
and typed `GridColumn` metadata privately in `columnMap` (`grid.ts:392`). See
[02 §Gap 1](02-current-state.md). ⚠️ Post-RD-11, `displayedRows()` on a **windowed** source is a
fail-loud lazy view whose whole-array operations throw — so `exportView` must hard-guard windowed (below).

### Proposed Changes
Add `export-view.ts` (pure) + one method on `EditableDataGrid`. No change to the read/write signal
surface; the method only reads.

## Implementation Details

### New Types/Interfaces

```ts
/** The serialization target for {@link EditableDataGrid.exportView}. */
export type ExportFormat = 'csv' | 'html' | 'json' | 'tsv';

/** One resolved, exportable column: a display title, a formatted-text accessor, and the raw value. */
interface ExportColumn<T> {
  readonly id: string;
  readonly title: string;
  readonly text: (row: T) => string;   // format(value(row)) — or String(value(row))
  readonly raw: (row: T) => unknown;    // value(row) — JSON only
}
```

### New Functions/Methods

```ts
// export-view.ts — pure, no view/signal state.
export function serializeView<T>(cols: readonly ExportColumn<T>[], rows: readonly T[], format: ExportFormat): string;

// grid.ts — thin delegator; resolves the snapshot from private state, then calls serializeView.
class EditableDataGrid<T> {
  exportView(format: ExportFormat): string;
}
```

`exportView` **first hard-guards a windowed source** — `if (this.windowed) throw new Error(…)` with a
clear "exportView is unsupported on a windowed source; export the loaded window via a follow-up"
message (mirroring `autoFitColumn` at `grid.ts:1060` and `distinctFor` at `grid.ts:1123`, which every
full-scan consumer does post-RD-11). Without this guard, `serializeView`'s `rows.map(...)` would hit
RD-11's fail-loud proxy and throw a generic *"windowed display() supports only .length…"* error naming
`display()`, not `exportView`. Then, on the eager path, it builds `cols` from `this.columnOrder()`
(visible, display-ordered — already excludes hidden + synthetic, [AR-8](00-ambiguity-register.md))
mapped through `this.columnMap`, and `rows` from `this.displayedRows()`; and returns
`serializeView(cols, rows, format)`.

### Serialization rules (per format)

**CSV** ([AR-6](00-ambiguity-register.md), [AR-7](00-ambiguity-register.md)) — delimiter `,`, records
joined by **CRLF**. Header row = titles. Each field: take `text(row)` → `sanitize` control bytes →
**formula-escape** (leading `= + - @ \t \r` → prefix `'`) → **RFC-4180 quote** if it contains `,`,
`"`, `\r`, or `\n` (embedded `"` doubled).

**TSV** ([AR-6](00-ambiguity-register.md), [AR-10](00-ambiguity-register.md)) — identical to CSV with
delimiter `\t` (a field is quoted when it contains a tab, quote, or newline). Formula-escaped like CSV.

**JSON** ([AR-4](00-ambiguity-register.md)) — `JSON.stringify(rows.map(row => Object.fromEntries(
cols.map(c => [c.id, c.raw(row)]))), null, 2)`. **Raw** values, keyed by column **id**; no formula- or
CSV-escaping (`JSON.stringify` handles its own string escaping). Header/titles are not emitted.

**HTML** ([AR-5](00-ambiguity-register.md), [AR-11](00-ambiguity-register.md)) — a standalone document:
`<!doctype html>\n<meta charset="utf-8">\n<table>` with a `<thead>` title row and a `<tbody>` of
`text(row)` cells. Every title and cell is **HTML-escaped** (`&`→`&amp;`, `<`→`&lt;`, `>`→`&gt;`,
`"`→`&quot;`); `sanitize`d for control bytes. No formula-escape (not a spreadsheet-paste format).

### Integration Points
- Reads `columnOrder()` / `displayedRows()` / `columnMap` — no writes, no reactive subscription (a
  synchronous snapshot at call time).
- `sanitize` from `@jsvision/core` (existing dep) strips control bytes at the boundary, consistent with
  cell rendering.
- **Eager only** ([AR-2](00-ambiguity-register.md)): `displayedRows()` is the resident row array on an
  eager source. On a **windowed** (RD-11) source it is a **fail-loud** lazy view — `.map`/spread/`for..of`
  **throw** (`windowing.ts:92-107`), so it is NOT a serializable "loaded window". `exportView` therefore
  hard-guards windowed with a clear error (above); windowed export is a separate follow-up. `exportView`'s
  JSDoc states it serializes the resident (eager) displayed rows and **throws on a windowed source**.

## Code Examples

### Example 1: formula-injection escaping
```ts
// A column formatting to '=SUM(A1)' exports (CSV) as the escaped literal, so a spreadsheet
// does not execute it:  =SUM(A1)  →  '=SUM(A1)
grid.exportView('csv');  // …,'=SUM(A1),…
grid.exportView('json'); // { … "formula": "=SUM(A1)" }  — raw, not escaped (structured format)
```

### Example 2: RFC-4180 quoting
```ts
// A value 'Ann, "the boss"' becomes a quoted, quote-doubled CSV field:
// "Ann, ""the boss"""
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Column `format` throws | Fall back to `String(value(row))` for that cell (a bad formatter degrades one cell, never the export) | [AR-9](00-ambiguity-register.md) |
| Zero displayed rows | Header-only output (CSV/HTML/TSV); `[]` (JSON) — never an exception | [AR-8](00-ambiguity-register.md) |
| `exportView` on a **windowed** source | Throws a clear "unsupported on windowed" error **before** touching the fail-loud proxy (mirrors `autoFitColumn`/`distinctFor`) | [AR-2](00-ambiguity-register.md) / PF-001 |
| Leading `-`/`+` on a legitimate number | Prefixed with `'` (accepted OWASP tradeoff; documented) | [AR-7](00-ambiguity-register.md) |
| Unknown `format` argument (type-guarded) | `ExportFormat` union makes it unreachable; an exhaustive `switch` throws internally (dead branch) | [AR-18](00-ambiguity-register.md) |

> **Traceability:** every strategy references its AR. See `00-ambiguity-register.md`.

## Testing Requirements
- Unit: each format's framing (delimiter, CRLF, quoting, header), formula-escape set, HTML-escape set,
  JSON raw+id shape, empty-rows, `format`-throws fallback. See `07-testing-strategy.md` ST-1…ST-11,
  ST-20…ST-23.
- Integration: `grid.exportView` reflects the current filter/sort/visibility/order (a filtered, sorted,
  reordered grid exports only what shows). ST-6, ST-9.
