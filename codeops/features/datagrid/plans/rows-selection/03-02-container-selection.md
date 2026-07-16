# Container Selection (state · gestures · paint · API): Rows, Records & Selection

> **Document**: 03-02-container-selection.md
> **Parent**: [Index](00-index.md)

## Overview

Wires the pure `selection.ts` ops (`03-01`) into `EditableDataGrid` and `EditableGridRows`: the
container-owned selection state, the gesture handling, the datagrid-local set-membership paint (zero
`@jsvision/ui` change, AR-1), and the reactive public API.

## Architecture

### Current Architecture

`grid.ts:233` carries `private readonly selected = signal(-1)` — a single "chosen row" index that is
injected into the body and re-anchored by key on sort/filter (`grid.ts:886`–`:942`) but is never set
to a real value. The body's self-contained `draw()` override (`editable-grid-rows.ts:443`) computes a
per-row role at `:480`–`:492` and feeds `isSelectedRow` into cellStyle suppression (`:505`) and
`CellState.selected` (`:521`).

### Proposed Changes

Replace the single index with a **key set** + anchor; the same paint path consults the set.

## Implementation Details

### Container state (`grid.ts`)

```ts
private readonly selectedKeys = signal<ReadonlySet<Key>>(new Set());
private anchorKey: Key | null = null;             // last non-shift pick, for range extension
private readonly selectionMode: SelectionMode;    // from opts.selectionMode ?? 'multi' (AR-2)
```

Remove `selected = signal(-1)` and the selection half of the sort/filter reconcile
(`snapshotAnchors`/reconcile) — a key set survives sort/filter with **no reconcile** (AR-10). On
delete, prune the removed keys from the set and clear `anchorKey` if its row is gone (AR-12).

`display()` provides the rows; `displayKeys()` = `this.display().map(this.source.rowKey)` is the
ordered key list the ops need.

### New options (`EditableDataGridOptions`)

```ts
/** Selection mode: 'single' replaces on each pick; 'multi' accumulates (default 'multi'). */
readonly selectionMode?: SelectionMode;
```

(The `checkboxColumn?`/`rowNumbers?`/`assignKey?` options are documented in `03-03`/`03-04`.)

### Gestures — where they live

Selection gestures live in `EditableGridRows.onEvent` (it has the row-hit context) and call
container-injected callbacks, mirroring how RD-07 injected `onColumnReorder`. The body config gains:

```ts
selectedKeys: Signal<ReadonlySet<Key>>;   // replaces the old `selected: Signal<number>`
onToggleRow?: (rowIndex: number, additive: boolean) => void;   // Space / Ctrl+click
onRangeToRow?: (rowIndex: number) => void;                     // Shift+click / Shift+↑↓
```

| Gesture | Handler | Effect |
| ------- | ------- | ------ |
| `Space` on the focused row | `onToggleRow(focused, additive=mode==='multi')` | toggle the focused row (single replaces, multi accumulates) — AC-1 |
| `Ctrl`+click a row | `onToggleRow(clicked, additive=true)` | move the cursor to the row + toggle it (multi) |
| `Shift`+click a row | `onRangeToRow(clicked)` | extend the range anchor→clicked in display order — AC-2 |
| `Shift`+`↑`/`↓` | `onRangeToRow(focused±1)` after moving the cursor | grow/shrink the contiguous range from the anchor |
| plain click a row | base cursor move; in `single` mode also select the row | cursor semantics unchanged |

The container maps a `rowIndex` to a key via `display()[rowIndex]` and applies the pure ops:
`onToggleRow` → `toggleKey`; `onRangeToRow` → `selectRange(anchorKey ?? focusedKey, toKey, …)`. A
non-shift pick sets `anchorKey`.

> **`Space` precedence.** The base `GridRows.handleKey` maps `Space`→`activate` (`grid-rows.ts:302`).
> The body must intercept `Space` for selection **before** delegating, so `Space` toggles selection
> rather than activating. (`Enter` keeps its RD-02 begin-edit/commit meaning — Enter is not a
> selection gesture.)

### Paint — the two-line change (`editable-grid-rows.ts:480`)

```ts
const keys = this.selectedKeys();
const isSelectedRow = keys.has(this.rowKey(row));   // was: item === this.selected()
```

Precedence **cursor > dirty > selected > cellStyle > zebra > normal** is unchanged — `isSelectedRow`
keeps feeding `rowOwns` (`:505`) and `CellState.selected` (`:521`) (AR-13). Repaint: the body already
binds `selected`; bind `selectedKeys` instead so a selection change repaints.

### Public API (`grid.ts`)

```ts
selectedKeys(): ReadonlySet<Key>;              // reactive read
selectRow(key: Key): void;                     // set = {key}, anchor = key
toggleRow(key: Key): void;                     // toggleKey(mode), anchor = key
selectRange(toKey: Key): void;                 // anchor..toKey in display order
selectAllDisplayed(): void;                    // selectAll(displayKeys) (AR-7)
clearSelection(): void;                        // new Set(), anchor = null
```

## Integration Points

- **With RD-02 editing:** the cell cursor (`focused`/`focusedCol`) and the selection set coexist; both
  key by `rowKey`. Editing does not change the selection; selecting does not open an editor.
- **With RD-07 frozen panels:** in frozen mode each panel shares the one `selectedKeys` signal, so a
  selected row highlights across all panels (the same `panelActive` focus predicate already spans
  panels for the cursor row).
- **With `03-03` checkbox column:** the header/per-row checkbox drives `selectAllDisplayed` /
  `toggleRow`; the tri-state box reads `triState(selectedKeys(), displayKeys())`.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `Shift`-range with no prior anchor | Anchor defaults to the focused row | AR-9 |
| Selected key whose row was deleted | Pruned from the set on delete; never painted | AR-10/AR-12 |
| `single` mode + `Ctrl`/`Shift` | `toggleKey`/`selectRange` collapse to a single key (single can't accumulate) | AR-2 |

> **Traceability:** cites AR-1/AR-2/AR-9/AR-10/AR-12/AR-13.

## Testing Requirements

- Spec (ST-8…ST-12): Space toggle single vs multi; Shift range; keys survive re-sort; selected-role
  paint + precedence; Ctrl+click toggle.
- Impl: anchor defaulting; select→delete prunes the set; single-mode Ctrl/Shift collapse; frozen-panel
  selection spans panels.
