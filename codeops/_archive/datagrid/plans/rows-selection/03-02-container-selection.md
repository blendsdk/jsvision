# Container Selection (state · gestures · paint · API): Rows, Records & Selection

> **Document**: 03-02-container-selection.md
> **Parent**: [Index](00-index.md)

## Overview

Wires the pure `selection.ts` ops (`03-01`) into `EditableDataGrid` and `EditableGridRows`: the
container-owned selection state, the gesture handling, the datagrid-local set-membership paint (zero
`@jsvision/ui` change, AR-1), and the reactive public API.

## Architecture

### Current Architecture

`grid.ts:233` carries `private readonly selected = signal(-1)` — a single "chosen row" index owned by
the base `GridRows`. It is **required** by `GridRowsConfig` (`ui/…/grid-rows.ts:66`), reactively bound
in the base (`:143`), and **written on every plain click** (`super.onEvent` → `select(newItem)`, `:260`
→ `selected.set(index)`, `:330`); the container re-anchors it by key on sort/filter (`grid.ts:886`–`:942`).
The body's self-contained `draw()` override (`editable-grid-rows.ts:443`) computes a per-row role at
`:480`–`:492` and feeds `isSelectedRow` into cellStyle suppression (`:497`) and `CellState.selected`
(`:521`); `paintDirtyMarkers()` reads `selected` again at `:561`/`:581`.

### Proposed Changes

**Keep** the base-owned `selected` signal (it is a required, base-written config field — removing it
needs a `@jsvision/ui` change, forbidden by AR-1; AR-16) and **add** a `selectedKeys` set + anchor
beside it. The paint path consults `selectedKeys`; `EditableGridRows.select()` is overridden so a plain
click is cursor-only and never drives the base single index into the highlight (AR-17).

## Implementation Details

### Container state (`grid.ts`)

```ts
private readonly selectedKeys = signal<ReadonlySet<Key>>(new Set());
private anchorKey: Key | null = null;             // last non-shift pick, for range extension
private readonly selectionMode: SelectionMode;    // from opts.selectionMode ?? 'multi' (AR-2)
```

Keep `selected = signal(-1)` (the base's required click sink, AR-16) but override
`EditableGridRows.select()` so a plain click no longer feeds it into the highlight (AR-17); drop the
**selection half** of the sort/filter reconcile (`snapshotAnchors`/reconcile — the `selAnchor` lines at
`grid.ts:890`/`913`/`937`/`942`) — a key set survives sort/filter with **no reconcile** (AR-10); the
**focus half** (`anchor`/`focused`) stays. On delete, prune the removed keys from the set and clear
`anchorKey` if its row is gone (AR-12).

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
selected: Signal<number>;                 // kept — the base's required click sink (AR-16)
selectedKeys: Signal<ReadonlySet<Key>>;   // NEW — the datagrid selection set the body paints from
onToggleRow?: (rowIndex: number, additive: boolean) => void;   // Space (read-only cell) / Ctrl+click
onRangeToRow?: (rowIndex: number) => void;                     // Shift+click / Shift+↑↓
```

`EditableGridRows` overrides `select()` to a cursor-only no-op for the selection set (AR-17), so the
base's per-click `selected.set(index)` no longer produces a highlight; the body binds `selectedKeys`
for repaint.

| Gesture | Handler | Effect |
| ------- | ------- | ------ |
| `Space` on a **read-only** focused cell | `onToggleRow(focused, additive=mode==='multi')` | toggle the focused row (single replaces, multi accumulates) — AC-1. On an **editable** cell `Space` stays begin-edit (AR-19). |
| `Ctrl`+click a row | `onToggleRow(clicked, additive=true)` | move the cursor to the row + toggle it (multi) |
| `Shift`+click a row | `onRangeToRow(clicked)` | extend the range anchor→clicked in display order — AC-2 |
| `Shift`+`↑`/`↓` | `onRangeToRow(focused±1)` after moving the cursor | grow/shrink the contiguous range from the anchor |
| plain click a row | base cursor move **only** — no selection change (`select()` override, AR-17) | cursor semantics unchanged |

The container maps a `rowIndex` to a key via `display()[rowIndex]` and applies the pure ops:
`onToggleRow` → `toggleKey`; `onRangeToRow` → `selectRange(anchorKey ?? focusedKey, toKey, …)`. A
non-shift pick sets `anchorKey`.

> **`Space` precedence (AR-19).** `Space` has **two** prior claimants, not one:
> 1. On an **editable** focused cell the datagrid's own `tryBeginEdit` already claims `Space` first
>    (`editable-grid-rows.ts:318`, `beginEdit(ev, { replaceWith: ' ' })`) and returns before the base —
>    so `Space` **begins an edit** there today. **This is preserved:** on an editable cell `Space` stays
>    begin-edit (type-a-space-to-edit is not lost).
> 2. On a **read-only** focused cell `tryBeginEdit` returns false and `Space` would fall through to the
>    base `GridRows.handleKey` `Space`→`activate` (`grid-rows.ts:302`). The body intercepts it there and
>    **toggles the focused row's selection** instead (AC-1, as reworded). (`Enter` keeps its RD-02
>    begin-edit/commit meaning — Enter is never a selection gesture.)
>
> So `Space`-toggle-selection applies to a read-only focused cell; selection on an editable cell is
> driven by the checkbox column, `Ctrl`+click, or `Shift` (AR-19).

### Paint — the membership swap at **two** sites (AR-18)

Selection membership is read in two paint methods, both of which migrate from the single-index test to
set membership:

```ts
// 1) draw() role logic (editable-grid-rows.ts:480)
const keys = this.selectedKeys();
const isSelectedRow = keys.has(this.rowKey(row));         // was: item === this.selected()

// 2) paintDirtyMarkers() background recompute (editable-grid-rows.ts:581) — `rk` already in scope (:568)
… : keys.has(rk) ? ctx.color('listSelected').bg : …      // was: item === selected ? … : …
```

Missing site (2) would leave a dirty `•` on a selected row compositing onto the wrong background (or
fail to compile once `selected` no longer tracks selection). Precedence **cursor > dirty > selected >
cellStyle > zebra > normal** is unchanged — `isSelectedRow` keeps feeding `rowOwns` (`:497`) and
`CellState.selected` (`:521`) (AR-13). Repaint: the body binds `selectedKeys` so a selection change
repaints (the base's `selected` bind stays for the base's own draw path).

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
