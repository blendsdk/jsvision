# Overlay & Read-only Container: Foundation

> **Document**: 03-05-overlay-container.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 §"Cell-overlay helper" + the AR #1 read-only container · AC-3, AC-7, AC-8 · req AR-16, AR-25, AR-26, PF-004 · AR #1/#6/#7 (plan)
> **Files**: `packages/datagrid/src/overlay.ts`, `packages/datagrid/src/grid.ts`

## Overview

Two runtime pieces. `mountCellOverlay` is the cell-aligned, no-frame editor-mount primitive, built from
**public** `@jsvision/ui` primitives (the spike-proven mechanism, not the ui-internal `openAnchoredPopup`,
req PF-004). `EditableDataGrid<T>` is the minimal **read-only** container (AR #1, plan) that composes the
promoted header + body over a `GridDataSource<T>` via the column adapter — the home for AC-3's render/order
proof, AC-8's sanitize proof, and the AC-9 story. RD-02 adds the cursor + editor + wires `commitCell`.

## Architecture

### Current Architecture

The spike mounts an editor into a sibling absolute overlay `Group` via `overlay.add(view)` + `loop.focusView`
+ `overlay.remove`, with `absoluteRect(view)` walking the parent chain (`spike-data-studio/src/editable-grid.ts`).
`@jsvision/ui`'s `DataGrid` (`data-grid.ts:119-181`) composes `GridHeader`+`GridRows` over shared signals in an
inner `col` container of `fr` bands. Neither is reachable/shaped for the datagrid yet.

### Proposed Changes

- `overlay.ts`: `CellRect`, `absoluteRect`, `mountCellOverlay`.
- `grid.ts`: `EditableDataGrid<T>` (read-only) + `EditableDataGridOptions<T>`.

## Implementation Details

### `overlay.ts`

```ts
export interface CellRect { x: number; y: number; width: number; height: number; } // body-local

/** A view's absolute top-left by walking the parent chain (from the spike). */
export function absoluteRect(view: View): { x: number; y: number };

/** Mount `view` at an absolute position derived from a body-local cell rect, focus it, and return a
 *  disposer that removes it and disposes its reactive root. No frame/border chrome. */
export function mountCellOverlay(args: {
  host: Group;                 // the grid's absolute overlay Group (a child of the grid)
  loop: { focusView(v: View): void };  // structural — the event loop's focus seam
  rect: CellRect;              // body-local cell rect
  origin: { x: number; y: number };    // body's absolute origin (absoluteRect(body))
  view: View;                  // the editor view to mount
}): () => void;                // dispose()
```

- **Mechanism (req PF-004 / AR #7, plan):** translate `rect` to absolute (`origin.x+rect.x`, `origin.y+rect.y`),
  set `view.layout = { position:'absolute', rect:{...absolute..., width, height} }`, `host.add(view)`,
  `loop.focusView(view)`. Wrap the mount's binding setup in a fresh `createRoot((dispose)=>…)` so binding
  effects are **owned by the overlay**; the returned `dispose()` calls `host.remove(view)` **and** the root's
  `dispose` (no leaked effects — AC-7).
- No frame/border (unlike the dropdown popup). An editor that needs its own dropdown (`DatePicker`/`ComboBox`,
  RD-03) opens it internally through the public widget — the overlay never touches `openAnchoredPopup`.
- `loop` is typed structurally (only `focusView` is needed), so the helper is unit-testable with a fake loop.

### `grid.ts` — read-only `EditableDataGrid<T>`

```ts
export interface EditableDataGridOptions<T> {
  readonly columns: GridColumn<T>[];
  readonly source: GridDataSource<T>;   // carries the REQUIRED rowKey (AC-5)
  readonly zebra?: boolean;
  // RD-02+ add: onCommit, editing config, selection, sort/filter, footer, frozen panels…
}

export class EditableDataGrid<T> extends Group {
  readonly rows: GridRows<T>;           // the focusable body renderer (focus this, not the Group)
  readonly overlay: Group;              // the absolute overlay host for RD-02's editors
  constructor(opts: EditableDataGridOptions<T>);
}
```

- **Composition (mirrors `DataGrid`, read-only):** adapt each `GridColumn` via `toEngineColumn` (03-03);
  build `autoWidths = derived(measureAutoWidths(engineCols, display(), stringWidth))` — importing the
  **promoted** `stringWidth` (03-01) so the container measures with the EXACT wide-glyph-aware function the
  engine draws with (never a naive `[...s].length`, which would misalign wide/CJK auto columns) — and
  `display = derived(materialize(source))` where `materialize` reads `source.length()`/`source.rowAt(i)`
  (in-memory returns its array; the windowed double returns its loaded window). `rowAt` is typed
  `T | undefined`; in RD-01 the eager sources never yield `undefined` in range, so `materialize` coerces to
  the engine's `display: () => T[]` seam with a type-guard (never `as any`/`as unknown`); RD-11's windowed
  placeholder path is what reconciles `rowAt`'s `undefined` against `display`'s non-optional `T[]`. Construct
  `GridRows` over the shared `indent`/`focused`/`selected` signals, and `GridHeader` over
  `columns`/`autoWidths`/the shared `indent` **and its required `sort` signal** — but because `GridHeader`'s
  built-in click-to-sort sets that signal and paints a `▲`/`▼` arrow that the read-only `display` never
  reorders, RD-01 mounts a header whose sort interaction is suppressed: a datagrid-local
  `class ReadonlyGridHeader extends GridHeader { override onEvent() {} }` constructed with a fixed
  `signal<SortState>(null)`, keeping the grid genuinely read-only. Stack the `fr` bands in an inner `col`
  container (the `DataGrid` idiom), and add an **absolute full-container `overlay` Group** as a sibling on
  top (RD-02 mounts editors into it via `mountCellOverlay`).
- **Read-only in RD-01:** no `focusedCol`, no editor wiring, no `sortBy`/filter UI — the reused
  `GridHeader`'s built-in click-to-sort is suppressed (above) so "no sort UI" genuinely holds; RD-02+ re-enable
  a live, wired sort. It is a self-drawing, themed, source-agnostic table. Focus its `rows` renderer (a `Group`
  is not itself a focus target — same as `DataGrid`).
- **Container-owned shared cursor (forward seam):** RD-02 hoists `focusedCol` + selection + scroll to
  container-owned signals injected into each panel's `GridRowsConfig` (the requirements-set preflight PF-001
  resolution). RD-01 constructs the single-panel body such that RD-02 adds those signals additively — the base
  engine already accepts shared `focused`/`selected`/`indent` (`grid-rows.ts:53`).

### AC-8 — the sanitize boundary

All cell text reaches the screen through the engine's existing sanitizing write path: `GridRows.draw` →
`alignCell` → `DrawContext.text`/`ScreenBuffer.set`, which run core `sanitize`. The adapter's `accessor`
(display string) and any value therefore cannot inject raw control bytes. ST-11 renders a grid whose cell value
contains `"\x1b[31m"`/`"\x07"`, serializes the frame, and asserts **no** raw ESC/BEL byte from that value
survives (req AR-25/AR-26). No custom-renderer path exists in RD-01 (RD-04); the sanitize guarantee is inherited
from the engine.

## Code Examples

### Example: read-only grid over an in-memory source

```ts
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';

interface Row { id: number; qty: number; }
const rows = signal<Row[]>([{ id: 1, qty: 9 }, { id: 2, qty: 1000 }]);
const columns = [column({ id: 'qty', title: 'Qty', value: (r: Row) => r.qty, align: 'right' })];

const grid = new EditableDataGrid<Row>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }) });
grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 6 } };

const root = new Group(); root.add(grid);
const caps = resolveCapabilities().profile;
const loop = createEventLoop({ width: 20, height: 6 }, { caps }); // createEventLoop requires opts.caps
loop.mount(root); loop.focusView(grid.rows);
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Overlay closed | `dispose()` removes the view + disposes its reactive root (no leaked effects) | AC-7 / req PF-004 |
| A cell value carries a control byte | Rendered through the engine's `sanitize` path; no raw ESC/BEL in the frame | AC-8 / req AR-25 |
| `source.rowAt(i)` undefined (windowed, unloaded) | RD-11 placeholder path; RD-01 double loads eagerly | req AR-14 |
| A draw callback throws (RD-04+ custom renderers) | Draw-error isolation degrades one cell, not the frame (inherited from `RenderRoot`); no custom renderers in RD-01 | req AR-25 |
| Grid built without a `rowKey`-bearing source | Compile error (source `rowKey` required) | req AR-15 / AC-5 |

> **Traceability:** overlay from public primitives = req PF-004 / AR #7 (plan); read-only container = AR #1
> (plan); container name = AR #6 (plan); sanitize boundary = req AR-25/26; forward cursor seam = req PF-001.

## Testing Requirements

- Spec: `mountCellOverlay` mounts a view at the translated rect, focuses it (fake-loop `focusView` called),
  and `dispose()` removes it + disposes the root — owner-disposal asserted (07 ST-9).
- Spec: the read-only container renders `format(value)` cells into a `ScreenBuffer` for both an in-memory and a
  windowed source (07 ST-10, extends AC-3/AC-4).
- Spec (security): a control-byte cell value yields no raw ESC/BEL in the serialized frame (07 ST-11).
- Impl: `absoluteRect` parent-chain walk; overlay re-mount; empty-source `<empty>` render.
