# 03-02 — Editing Engine: `EditableGridRows` + the edit lifecycle

> **Parent**: [Index](00-index.md) · **Phases**: 2 (cursor + nav + overpaint) & 3 (lifecycle + commit)
> **Refs**: AR #1, #2, #4, #5, #7, #8, #9, #13, #15 (plan) · req AR-02/16/18/19

The interactive core: a `GridRows` subclass that adds a column cursor and overpaints the focused cell (Phase 2),
plus the editor-overlay lifecycle that mounts a text `Input`, commits through the RD-01 seam, and advances
(Phase 3). Two files: `editable-grid-rows.ts` (the view) and `editing.ts` (the lifecycle controller + dirty
registry — the dirty half is detailed in [03-03](03-03-dirty-container-story.md)).

## `EditableGridRows<T>` (`packages/datagrid/src/editable-grid-rows.ts`, new)

Extends the public `GridRows<T>`. Construction config extends the public `GridRowsConfig<T>` with the RD-02
additions the container injects (AR #4):

```ts
export interface EditableGridRowsConfig<T> extends GridRowsConfig<T> {
  /** The typed columns (parse/set/format live here; the base `columns` are the engine adapters). */
  typedColumns: GridColumn<T>[];
  /** The shared column cursor, owned by the container (AR #4). */
  focusedCol: Signal<number>;
  /** The editor mount host (the container's absolute overlay group). */
  overlay: Group;
  /** The optional per-cell veto sink. */
  onCommit?: OnCommit<T>;
  /** The row-identity function (from the data source). */
  rowKey: (row: T) => string | number;
  /** Bump-on-write so an in-place `column.set` repaints (AR #5). */
  bumpVersion: () => void;
  /** The shared dirty registry (AR #6). */
  dirty: DirtyRegistry;
}
```

The subclass reads the base's `protected` state (`display`, `columns`, `indent`, `focused`, `topItem`,
`geometry()`) directly — verified `protected` in [02-current-state](02-current-state.md).

### Navigation — `onEvent` intercept + fall-through (Phase 2)

`override onEvent(ev)` handles the reassigned keys and **returns before** `super.onEvent(ev)`; it falls through
for the keys the base already does right:

| Key | Action | Handled here? |
| --- | --- | --- |
| `←` / `→` | `moveCol(∓1)` — column cursor (base binds these to H-scroll) | ✅ intercept |
| `Home` / `End` | `focusedCol → 0` / `last` (base = first/last visible row) | ✅ intercept |
| `Ctrl+Home` / `Ctrl+End` | first / last cell of the grid (`focused` + `focusedCol`) | ✅ intercept |
| `Tab` / `Shift+Tab` | `moveCellForward` / `Back` (row wrap; corner clamps, AR #8) | ✅ intercept |
| `F2` | begin-edit | ✅ intercept |
| `Enter` | editable → begin-edit; read-only → no-op (consume) | ✅ intercept |
| printable (`inner.char !== undefined && !ctrl && !alt`, incl. Space) | editable → begin-edit + replace; read-only → no-op | ✅ intercept |
| `↑` / `↓` / `PgUp` / `PgDn` / `Ctrl+PgUp` / `Ctrl+PgDn` | row nav (inherited) | ⤵ `super.onEvent` |
| mouse / wheel | base row click + wheel (mouse begin-edit is RD-10) | ⤵ `super.onEvent` |

Cursor math (all clamp to `[0, n)`; `n = columns.length`, `len = display().length`):

```ts
moveCol(d)        → focusedCol.set(clamp(focusedCol() + d, 0, n - 1))
colFirst / colLast→ focusedCol.set(0) / focusedCol.set(n - 1)
gridStart (C-Home)→ focused.set(0); focusedCol.set(0)
gridEnd   (C-End) → focused.set(len - 1); focusedCol.set(n - 1)
moveCellForward   → focusedCol < n-1 ? focusedCol+1
                    : focused < len-1 ? (focused+1, focusedCol=0)
                    : (stay)                       // grid corner clamps (AR #8)
moveCellBack      → focusedCol > 0 ? focusedCol-1
                    : focused > 0 ? (focused-1, focusedCol=n-1)
                    : (stay)
```

`focused.set(...)` reuses the base's existing bind (it re-runs `updateTop()` + repaints); `focusedCol` gets its
own `bind` in `onMount` so a column move repaints.

### Cell overpaint — `draw` override (Phase 2)

```ts
override draw(ctx): void {
  super.draw(ctx);          // base paints rows (incl. the focused ROW in listFocused)
  this.paintCursorCell(ctx); // overpaint the focused CELL in gridCursor (only when this.state.focused)
  this.paintDirtyMarkers(ctx); // overpaint • for visible dirty cells (Phase 4)
}
```

`paintCursorCell` — only when `this.state.focused` (colour-only focus, like the base):
- `geom = this.geometry(ctx.size.width)`; `c = clamp(focusedCol(), 0, n-1)`; `y = clampIndex(focused()) − topItem`.
- If `0 ≤ y < ctx.size.height` and `geom.widths[c] > 0`: `x = geom.starts[c] − indent`; `fillRect(x, y,
  geom.widths[c], 1, ' ', ctx.color('gridCursor'))`; then redraw the aligned cell text via
  `alignCell(engineCol.accessor(row), geom.widths[c], align, stringWidth)` in `gridCursor`. `ctx` clips
  off-screen (H-scroll), so no bounds math beyond the `y` check.

`paintDirtyMarkers` (Phase 4, detail in 03-03): for each visible dirty cell, draw `•` at `x + widths[c] − 1`
with `{ fg: gridCursor?… }` — i.e. `gridDirty.fg` composed over the cell's background (`gridCursor.bg` when it is
the active focused cell, else the row-role bg computed with the same `focused > selected > zebra > normal`
priority the base uses). See 03-03.

## The edit lifecycle (`packages/datagrid/src/editing.ts`, new) (Phase 3)

A small state machine owned by `EditableGridRows` (constructed in its `onMount`). States:
`idle → editing(cell) → (await commit) → idle | editing(same cell)`.

```
type EditState<T> =
  | { kind: 'idle' }
  | { kind: 'editing'; cell: CellRef; field: Signal<string>; editorHost: Group; dispose: () => void };
```

### begin-edit (F2 / Enter / printable)

```ts
beginEdit(ev, opts?: { replaceWith?: string }): boolean {
  if (state.kind !== 'idle') return false;
  const cell = currentCell();                       // { row, rowKey, col: focusedCol(), columnId }
  const tcol = typedColumns[cell.col];
  if (!isEditable(tcol) || committing.has(key(cell))) return false; // read-only / locked → reject (AC-1, AR #9)
  const seed = opts?.replaceWith ?? (tcol.format ? tcol.format(tcol.value(cell.row), cell.row)
                                                 : String(tcol.value(cell.row)));
  const field = signal(seed);
  const editor = createCellEditor(tcol, field, { overlay });  // never null here (isEditable checked)
  const editorHost = new Group();
  editor.layout = { position: 'fill' };
  editorHost.add(editor);
  editorHost.onEvent = (ev2) => this.onEditorKey(ev2, cell, field, editor); // commit-key capture (AR #7)
  const dispose = mountCellOverlay({
    host: overlay,
    loop: { focusView: (v) => ev.focusView?.(v) },  // AR #13 — no stored loop ref
    rect: cellRect(cell),                            // { x: starts[c]-indent, y: focused-topItem, w: widths[c], h: 1 }
    origin: absoluteRect(this),                      // body's absolute origin
    view: editorHost,
  });
  ev.focusView?.(editor);                            // focus the INNER Input so typing lands + Enter/Tab bubble to editorHost
  state = { kind: 'editing', cell, field, editorHost, dispose };
  return true;
}
```

- **`getFocused() === editor`** holds (AC-1) because we focus the inner `Input`.
- **Enter on a read-only cell** is a consumed no-op (`beginEdit` returns `false`; `onEvent` still sets
  `ev.handled = true` so the base `activate` never fires) — AC-1.
- **printable** passes `replaceWith: inner.key` so the field is the typed char (content replaced) — AC-2.

### commit-key capture (`onEditorKey`, on the editor-host `Group`, AR #7)

The inner `Input` leaves Enter/Tab unhandled and does not consume Esc, so all three bubble here:

```ts
onEditorKey(ev2, cell, field, editor): void {
  const k = ev2.event; if (k.type !== 'key') return;
  if (k.key === 'escape')            { this.cancel(ev2, cell); ev2.handled = true; }
  else if (k.key === 'enter')        { void this.commit(ev2, cell, field, 'row');  ev2.handled = true; }
  else if (k.key === 'tab' && k.shift){ void this.commit(ev2, cell, field, 'cell-back'); ev2.handled = true; }
  else if (k.key === 'tab')          { void this.commit(ev2, cell, field, 'cell-forward'); ev2.handled = true; }
  // everything else stays in the Input (already handled there)
}
```

### cancel (Esc, AC-4)

```ts
cancel(ev, cell): void {
  closeEditor();               // dispose the overlay root (owner disposal — AC-8)
  ev.focusView?.(this);        // refocus the body
  state = { kind: 'idle' };
  // No onCommit; nothing was written to the record (we write only on commit), so the cell already shows previous.
}
```

### commit (Enter/Tab, await-close — AR #15, AC-3/5/6)

```ts
async commit(ev, cell, field, advance): Promise<void> {
  const tcol = typedColumns[cell.col];
  const value = tcol.parse!(field());                 // text -> V
  const previous = tcol.value(cell.row);
  const ckey = key(cell);
  committing.add(ckey);                               // per-cell serialization guard (AR #9)
  dirty.add(ckey);                                    // pending marker (AR #6)
  const res = await commitCell({
    row: cell.row, columnId: cell.columnId, rowKey: cell.rowKey,
    previous, next: value,
    apply: (r, _c, v) => tcol.set!(r, v),             // optimistic write; commitCell reverts on veto
    onCommit,
  });
  bumpVersion();                                       // repaint the (new or reverted) value (AR #5)
  dirty.delete(ckey);
  committing.delete(ckey);
  if (res.committed) { closeEditor(); state = { kind: 'idle' }; this.applyAdvance(advance); ev.focusView?.(this); }
  // vetoed: the editor REMAINS open (AC-5); commitCell already reverted the record; the field is left for the user to fix.
}

applyAdvance(advance): void {
  if (advance === 'row')          this.focused.set(clampIndex(this.focused() + 1, len())); // same col, next row (AC-3)
  else if (advance === 'cell-forward') this.moveCellForward();  // AC-6
  else                                 this.moveCellBack();
}
```

- **`onCommit` called exactly once** with `{ rowKey, columnId, value: parse(field), previous, row }` — it is the
  `commitCell` payload (AC-5).
- **committed** ⇒ editor closes, cursor advances (Enter → next row same col; Tab → next cell wrap; corner clamps),
  body refocused (AC-3/6).
- **vetoed** ⇒ editor stays open, record shows `previous` (AC-5).
- **repaint** ⇒ `bumpVersion()` folds into the container `display` computed so the mutated-in-place row repaints
  (AR #5). Nothing else can trigger it (same object reference).

### closeEditor (AC-8)

```ts
closeEditor(): void {
  if (state.kind !== 'editing') return;
  state.dispose();             // mountCellOverlay's disposer: host.remove(editorHost) + dispose the reactive root
}
```

The `mountCellOverlay` disposer tears down the `createRoot` scope, so the editor's binding effects do not leak
(AC-8 — an owner-disposal assertion). The overlay mounts within a single cell rect (`w = column width`,
`h = 1` — AC-8).

## Spec coverage (see [07](07-testing-strategy.md))

ST-1 (read-only no-op / editable mounts + `getFocused`), ST-2 (Enter mounts editor), ST-3 (printable replaces),
ST-4 (Enter commits + next row, `focusedCol` unchanged), ST-5 (Esc reverts + closes, no `onCommit`), ST-6
(`onCommit` once; false keeps open + previous; true closes + new), ST-7 (Tab/Shift-Tab row wrap + corner clamp),
ST-9 (overlay one-cell rect + dispose disposes root), ST-12 (nav clamps + fall-through), ST-13 (cursor overpaint
in `gridCursor`), ST-14 (per-cell commit serialization).
