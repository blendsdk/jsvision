# Synthetic Columns (checkbox · gutter): Rows, Records & Selection

> **Document**: 03-03-synthetic-columns.md
> **Parent**: [Index](00-index.md)

## Overview

The two opt-in leading affordances: a selection **checkbox column** (`[ ]`/`[x]` per row + a tri-state
header box) and a **row-number gutter** (1-based display numbers). Both are fixed-width **synthetic
prefix** cells — not caller `GridColumn`s, not part of the `apportionColumns` sortable/filterable
track, not reachable by the column cursor (AR-5). They render in the **left-pinned region** so they
never scroll horizontally (AR-11).

## Architecture

### Proposed Changes

A new `packages/datagrid/src/synthetic-columns.ts` computes the prefix width + paints its cells;
`grid-panels.ts` prepends a prefix segment to the leftmost panel's header, frozen-rows band, and body.

## Implementation Details

### Prefix model (`synthetic-columns.ts`)

```ts
/** Which synthetic prefix cells are enabled and their fixed widths. */
export interface SyntheticPrefix {
  readonly checkbox: boolean;   // opts.checkboxColumn
  readonly rowNumbers: boolean; // opts.rowNumbers
  readonly rowCount: number;    // for the gutter's right-aligned width (digits of the max index)
}

/** Total prefix width in cells (0 when neither is enabled). */
export function prefixWidth(p: SyntheticPrefix): number;   // checkbox: 3 ("[x]") ; gutter: digits+1

/** The checkbox glyph for a row's selection state. */
export function checkboxGlyph(selected: boolean): string;  // '[x]' | '[ ]'

/** The header tri-state glyph (none/some/all). */
export function headerCheckboxGlyph(state: TriState): string;  // '[ ]' | '[-]' | '[x]'

/** The right-aligned 1-based display number for a body row (`index` is 0-based display). */
export function gutterLabel(index: number, width: number): string;
```

### Rendering (`grid-panels.ts`)

- **Header row:** the prefix segment paints the header-checkbox glyph over the checkbox slot (when
  enabled) and blanks the gutter slot; it sits left of the leftmost data header, in the pinned region.
- **Body rows:** each row's prefix paints `checkboxGlyph(selectedKeys.has(rowKey(row)))` + the gutter
  label; the segment shares the panel's row window (and the frozen-rows band, so a pinned row shows
  its checkbox/number too).
- **Geometry:** the prefix width is reserved **before** the data columns; the data columns' geometry
  is unchanged (they still apportion over the remaining width). The prefix is drawn at a fixed origin,
  never H-scrolled.

### Interaction

| Target | Gesture | Effect |
| ------ | ------- | ------ |
| A per-row checkbox cell | mouse-down | `toggleRow(rowKey(row))` (additive in multi) — AC-3 |
| The header checkbox cell | mouse-down | if tri-state is `all` → `clearSelection`; else → `selectAllDisplayed()` (AR-7) — AC-3 |
| The gutter | (none) | display-only; 1-based, right-aligned, re-numbers after sort/filter — AC-7 |

The header/checkbox hit-test is a fixed-x band on the leftmost panel; the column cursor never lands
there (AR-5), so `←`/`Home` stop at the first data column.

## Integration Points

- **With `03-02`:** the checkbox reads `selectedKeys()` and drives `toggleRow`/`selectAllDisplayed`;
  the header glyph reads `triState(selectedKeys(), displayKeys())`.
- **With RD-07 panels:** the prefix rides on the left frozen panel when `freeze*` is set, else on the
  single body; either way it is in the non-scrolling region. Frozen-rows band rows also get a prefix.
- **With the gutter + sort/filter:** the label is the **display** index + 1, so it renumbers whenever
  `display()` re-derives (AC-7).

## Code Examples

```ts
const grid = new EditableDataGrid<Emp>({
  columns, source,
  checkboxColumn: true,   // [ ]/[x] per row + tri-state header box
  rowNumbers: true,       // 1-based display-number gutter, right-aligned
});
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Neither option set | `prefixWidth` = 0; no segment built; the body is byte-identical to today | AR-5 |
| A very large `rowCount` (many digits) | Gutter width = digit count of the max index + 1; reserved once | — |
| Header checkbox glyph | Static ASCII (`[ ]`/`[-]`/`[x]`) — no user text, passes `sanitize` trivially | RD AR-25 |

> **Traceability:** cites AR-5/AR-7/AR-11.

## Testing Requirements

- Spec (ST-13…ST-15): checkbox per-row toggle + tri-state header + stays pinned on H-scroll; select-all
  over the filtered display; gutter 1-based renumber after sort.
- Impl: prefix alignment across header ↔ body ↔ frozen-rows band; prefix + frozen columns compose;
  `prefixWidth` = 0 leaves the no-prefix body untouched.
