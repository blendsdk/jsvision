# Footer Band: Footer, Aggregation & Master-Detail

> **Document**: 03-02-footer-band.md
> **Parent**: [Index](00-index.md)

## Overview

The visible footer: a **sticky bottom band** hosting a column-aligned aggregate row (and, per 03-03,
a widget row). Three pieces: the `GridFooter<T>` **option/interface** (what the caller declares), the
`FooterBand` **view** (the passive per-panel aggregate painter), and the `FooterController` (the
reactive glue: aggregate `computed`s + honesty + validation). Assembly happens inside
`buildGridBody` so a `rebuildBody` recreates it for free (AR-7/AR-10).

## Architecture

### Current Architecture

`buildGridBody` stacks bands into the `inner` col-group; `bodyRow` is the only `fr` child
(`grid-panels.ts:372/526`); the hbar `botRow` is last (`:528`). Aggregate-free today.

### Proposed Changes

1. **`GridFooter<T>` interface** (the caller's footer config, in `grid-footer.ts`, exported), the RD shape:

```ts
export interface GridFooter<T> {
  /** Keep the footer visible while the body scrolls. Default true; v1 footers are always sticky
   *  (the fixed-band layout gives it for free — a non-sticky/inline footer is Phase B). */
  readonly sticky?: boolean;
  /** Per-column aggregates, keyed by columnId. Unknown keys are ignored + devWarn (AR-12). */
  readonly aggregates?: Record<string, AggregateSpec>;
  /** Free-form widget row (03-03). Any `View`s — totals Text, command Buttons, the N-of-M read-out. */
  readonly widgets?: readonly View[];
}
```

2. **`FooterBand<T>` view** (`footer-band.ts`) — a passive, **non-focusable** `View` subclass, the twin
   of `SyntheticBodyBand`/`SortHeader`: one band per panel that paints all its columns' aggregate cells
   in a single `draw()` loop. It reuses the shared geometry exactly as the body/header do —
   `apportionColumns(cols, autoWidths(), width, dividers)` then, per column, `alignCell(cellText, w,
   col.align, stringWidth)` at `x = geom.starts[c] - indent` (mirrors `editable-grid-rows.ts:646-672`).
   Its cell text comes from an injected `cell(columnId) => string` accessor (the controller's on-demand
   fold). The band **`bind`s the fold to its data deps** (`displayedRows()`/`version`) so it recomputes
   once per data change (memo-equivalent — the `SyntheticBodyBand` bind pattern, `synthetic-columns.ts:136/209`),
   and drives the `widthTick` live-resize repaint off a **separate invalidate-only `bind`** so a resize
   never re-folds. Do **not** fold inside `draw()` (that re-runs the fold on every repaint).

3. **`FooterController<T>`** (`grid-footer.ts`, internal — distinct name from the `GridFooter` config
   interface to avoid an interface/class collision) — twin of `GridSelection`/`RowMutations`, which hold
   **no** reactive `computed`s and read live state lazily. It follows that pattern:
   - `cell(columnId)`: folds **on demand** — `formatAggregate(spec, foldAggregate(spec.fn,
     displayedRows().map(col.value)), partial)`, `partial = source.complete?.() === false` (AR-2/AR-9).
     **No owned `computed`:** a bare `computed` in a pre-mount controller has ambiguous ownership (it
     attaches to whatever ambient owner is active at grid construction), unlike the grid's scope-owned
     `this.derived`; the datagrid uses **zero** bare `computed`s package-wide. The memo lives in the
     `FooterBand`'s data-bound repaint (point 2), not here;
   - config-time validation: drop `aggregates` keys not in the column set (+ `devWarn`, imported from the
     shared `dev.ts` — PF-004), guard `fn` via `isAggregateFn` (AR-12);
   - the widget-row wiring (03-03).

4. **Band assembly in `buildGridBody`** — build a footer container `Group` and add it to `inner`
   **after `inner.add(bodyRow)` (`:526`) and before the hbar `botRow` (`:528`)**:
   - **Aggregate row** (present when `footer.aggregates`): iterate the same `segs` — one `FooterBand`
     sub-view per left/center/right segment, same `segLayout(seg)` + `indent` (zero for frozen,
     `deps.indent` for center) + `dividers`, with `FreezeDivider`s between and a trailing `corner()`
     — exactly the `freezeRowsRow` pattern (`:519-524`). Fixed **1 cell** tall.
   - **Widget row** (present when `footer.widgets`, 03-03): a flow `Group` spanning the band, fixed N
     cells tall.
   - Band total height = `(aggregates ? 1 : 0) + (widgets ? 1 : 0)` (v1: the widget row is fixed at
     **1 cell** — `widgetRows = 1`; multi-row is a caller concern via nested groups); absent both ⇒ no band.

### Integration Points

- Thread `footer` + the controller through `GridBodyDeps` so `buildGridBody`/`rebuildBody` see it.
- `grid.ts` gains ONLY: the `footer?: GridFooter<T>` option in `EditableDataGridOptions`, a
  `displayedRows()` accessor (`return this.display();`), and the controller instantiation wired into
  `_bodyDeps`. All aggregate/paint logic lives in `footer-band.ts`/`grid-footer.ts` to hold the
  `<1200` guard (AR-10).
- Sticky is inherent: the fixed band sits outside the body's virtual-scroll window (AR-7), so it never
  scrolls vertically; per-segment `indent` keeps it panning in lockstep with the header/body (frozen
  cells never pan). `sticky` defaults true; `false` is reserved (treated as true + devWarn in v1).

## Code Examples

```ts
const grid = new EditableDataGrid<Sale>({
  columns: [ column({ id: 'region', /* … */ }), column({ id: 'amount', value: (r) => r.amount, align: 'right' }) ],
  source: fromRows(rows, { rowKey: (r) => r.id }),
  footer: {
    aggregates: {
      region: { fn: 'count', label: 'rows:' },
      amount: { fn: 'sum', format: (v) => `$${v.toLocaleString()}`, label: 'Σ' },
    },
  },
});
// The `amount` footer cell shows "Σ $12,340" aligned under the amount column; editing an amount,
// inserting/deleting a row, or filtering updates it reactively.
```

## Error Handling

| Error Case | Handling Strategy | AR |
| ---------- | ----------------- | -- |
| `aggregates` key not a known columnId | Ignore that entry + `devWarn` | AR-12 |
| `fn` not a known `AggregateFn` | Ignore that entry + `devWarn` | AR-12 |
| Footer + frozen panels | Aggregate cells align via the per-segment `apportionColumns`/`indent` path; ST-16 pins it | AR-7 |
| `sticky: false` | Reserved; rendered sticky + `devWarn` (non-sticky is Phase B) | AR-7 |
| Footer text with control bytes | Stripped at the `ctx.text` boundary automatically (`draw-context.ts:108`) | AR-12 |

> **Traceability:** [00-ambiguity-register.md](00-ambiguity-register.md) AR-2, AR-7, AR-9, AR-10, AR-12.

## Testing Requirements

- Spec: aggregate cell renders aligned under its column (ST-1); reacts to edit/insert/delete/sort/filter
  (ST-2..ST-6); sticky while the body scrolls (ST-14/15); aligned across a freeze split (ST-16);
  honesty label from `complete()` (ST-17/18). (`grid-footer.spec.test.ts`, `footer-band.spec.test.ts`.)
- Impl: `grid.ts` stays `<1200`; controller instantiated (not inlined); unknown-key/`fn` devWarn.
