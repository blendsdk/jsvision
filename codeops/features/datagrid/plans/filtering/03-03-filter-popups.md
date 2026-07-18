# Filter Popups & Distinct: Filtering

> **Document**: 03-03-filter-popups.md
> **Parent**: [Index](00-index.md)

## Overview

The two on-demand deep-filter surfaces opened from the header funnel: the **condition filter**
(`filter-popup.ts`) and the **Excel value-list** (`value-list-popup.ts`), plus the **widened
`distinct` seam** (`data-source.ts`). Both popups are anchored Views mounted over the grid — the same
proven pattern as the RD-03 cell editors (`DatePicker`/`ComboBox`/`CheckGroup` in the overlay). Per
the RD they are one popup with two sections; here they are two cohesive components the shell composes
(condition section lands Phase 4, value-list section Phase 5), keeping "the same popup" faithful while
phasing cleanly.

## Component A — `FilterPopup<T>` (condition filter)

### Architecture
An anchored popup shell for one column. Resolves the column's filter type via
`resolveFilterType(col, sample)` (`03-01`) and shows a type-appropriate condition editor. Emits
`onApply(columnId, filter)` / `onClear(columnId)`. Reserves a slot for the value-list section (B).

```ts
export interface FilterPopupConfig<T> {
  column: GridColumn<T>;
  columnId: string;
  current?: ColumnFilter;                          // the column's existing filter (for reopening)
  filterType: FilterType;                          // from resolveFilterType (AR #14)
  distinct?: () => Promise<DistinctResult>;        // present ⇒ embed the value-list section (B)
  onApply: (columnId: string, filter: ColumnFilter) => void;
  onClear: (columnId: string) => void;
  onClose: () => void;                             // Escape / click-away / after apply
}
```

### Condition section by type (AR #14)

| `filterType` | Operator choices | Operand input(s) | Produces |
|--------------|------------------|------------------|----------|
| `text` | contains · startsWith · endsWith · equals | one text `Input` | `{ kind: 'text', op, value }` |
| `number` | > · < · between · = | one numeric `Input`, plus a second when `between` | `{ kind: 'number', op, a, b? }` |
| `date` | before · after · between · on | one `DatePicker`, plus a second when `between` | `{ kind: 'date', op, a, b? }` |

- Operator choice is a small `ComboBox`/`CheckGroup`-style selector; the second operand appears only
  for `between` (AC-2).
- **Apply** emits the filter and calls `onClose`; **Clear** emits `onClear` and closes; **Escape** /
  click-away closes with no change.

## Component B — `ValueList<T>` (Excel value-list section)

### Architecture
The distinct-value checkbox picker, embedded in `FilterPopup` when `distinct` is provided. Populates
asynchronously from the passed `distinct()` thunk (grid-owned client compute or `source.distinct` —
resolved by the container, `03-04`). Emits a `{ kind: 'set', selected }` filter on Apply.

```ts
export interface ValueListConfig {
  distinct: () => Promise<DistinctResult>;   // resolves to formatted labels (+ truncated flag)
  current?: ReadonlySet<string>;             // currently-selected labels (checked on reopen)
  onApply: (selected: ReadonlySet<string>) => void;
}
```

### Behavior
- **Loading → list:** shows a loading line until `distinct()` resolves, then a scrollable checkbox
  list of the labels (a `CheckGroup`/`ListView` of the distinct labels).
- **Type-ahead search:** a search `Input` narrows the *visible* labels (case-insensitive contains on
  the label); it never changes the underlying selection.
- **Select All:** a control that checks/unchecks every currently-visible label.
- **Truncation disclosure (AC-7 / AR #5):** when `distinct()` resolves with `truncated: true`, a
  visible "list truncated — refine your search" note renders above/below the list. Never silent.
- **Apply:** emits the checked label set as `{ kind: 'set', selected }` (membership on the formatted
  label — `03-01 §set`, AR #10). Checking a subset keeps only rows whose label is in the set; Select
  All (all checked) is equivalent to no set filter.

## Component C — the widened `distinct` seam (`data-source.ts`)

### Proposed change
```ts
// before: distinct?(columnId: string): Promise<string[]>;
distinct?(columnId: string): Promise<DistinctResult>;   // AR #5 — { values, truncated? }
```

`DistinctResult` is imported from `filter.ts` (`03-01`). The seam is currently declared but
unimplemented, so widening it breaks nothing. The container resolves distinct as (`03-04`):

```ts
// grid-owned client compute (never truncated) unless the source provides its own bounded distinct
const distinctFor = (columnId, col) =>
  this.source.distinct
    ? this.source.distinct(columnId)
    : Promise.resolve({ values: computeDistinct(materialize(this.source), col), truncated: false });
```

## Integration Points
- The container opens `FilterPopup` on `onFunnelClick`, anchoring it via `absoluteRect(header)` +
  the funnel's local anchor, mounted into a dedicated hit-transparent popup overlay (`03-04`).
- `FilterPopup` embeds `ValueList` only when a `distinct` thunk is passed. In v1 every column
  qualifies: the only source is in-memory `fromRows`, and the container always passes the grid-owned
  `distinctFor` thunk (client compute over the materialized rows — correct and complete for in-memory).
  When windowed sources land (RD-11), the container will gate the section — a windowed source is offered
  the value-list **only when it exposes `source.distinct`** (which bounds the query), never by scanning
  its partial window client-side, which RD-06 forbids on large data. (AR #19)
- Apply/Clear route to the container's `setFilter`/`clearFilter` (the single filter signal).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `distinct()` rejects (async source failure) | The value-list shows an inline error line, not a throw into the render loop (mirrors the RD-03 lookup provider) | AR #9 |
| Distinct list capped by the source | `truncated: true` ⇒ visible disclosure note (never silent) | AR #5 / AC-7 |
| `between` applied with only one operand filled | The second operand defaults so the model stays well-formed (`b` omitted ⇒ degenerate range, `03-01`) | AR #8 |
| Popup opened while a cell editor is open | The dedicated popup overlay is separate from the editor overlay; opening the popup does not corrupt an edit (container closes conflicting transient UI) | AR #11 |

> **Traceability:** every strategy cites its AR. See `00-ambiguity-register.md`.

## Testing Requirements
- `FilterPopup`: correct operator set per `filterType`; `between` reveals the second operand; Apply
  emits the right `ColumnFilter`; Clear emits `onClear`.
- `ValueList`: distinct labels populate; checking a subset emits a `{set}` filter; Select All; search
  narrows visible labels; `truncated` shows the disclosure. ST cases: `07-testing-strategy.md`
  (ST-21…ST-26).
