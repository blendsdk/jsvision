# 03-04: Mouse Double-click & Scroll-into-view

> **Parent**: [Index](00-index.md) · **AR**: AR-3, AR-11
> **Modified file**: `packages/datagrid/src/editable-grid-rows.ts`

RD-10 adds two mouse behaviors: **single-click cell focus** (AC-4, the column half — see below) and
**double-click-to-edit**. Everything else (row focus + selection, header-sort, funnel, wheel, scrollbar,
resize/reorder drag) already ships (RD-05/07/08) and is not re-plumbed (01 non-goals). Plus the AC-6
scroll-into-view assertion.

## Single-click cell focus — the column half of AC-4 (PF-001)

AC-4 requires a click to focus *that cell and its row*. The **row** half already ships (the base
`focusTo` on mouse-down). The **column** half does **not** for a single-body grid: `grid-panels.ts:328`
wires `mouseColumns: frozen`, so `setColFromClick` runs only in a **frozen** grid — in a plain single body
a click leaves `focusedCol` where it was, so click-cell-3-then-F2 edits the previously-cursored column.
Fix: set the column on **every** body click, not only frozen ones. Wire `mouseColumns: true` for the
center/only body (or drop the `if (this.mouseColumns)` guard in the mouse-down branch so `setColFromClick`
always runs). The pinned frozen-rows **band** stays passive (`focusable === false`), so it is unaffected.

This is an **intended behavior change** for a single-body grid (a click now moves the column cursor), so
it is called out in the ST-13 regression spec as a deliberate delta — the "byte-identical" invariant is
scoped to keyboard gestures and pre-existing frozen-panel mouse behavior, not this AC-4 fix.

## Double-click-to-edit (`handleDoubleClickEdit`)

Reuse the framework `ev.clickCount` stamp (02 §4) — no bespoke tracker or timer (AR-3). Intercept in the
body's mouse-down branch (03-02), **before** `super.onEvent` (so the base's `clickCount===2 → activate`
does not also fire on an editable cell):

```ts
private handleDoubleClickEdit(inner: MouseEvent, ev: DispatchEvent): boolean {
  if (ev.clickCount !== 2) return false;
  // The base already focuses the row on the FIRST down of the pair; set the column from x so the cursor
  // is on the double-clicked cell, then begin the edit if it is editable.
  this.setColFromClickAlways(ev);          // map x→column even in single-body mode (unlike mouseColumns)
  const c = this.localCol();
  const col = c >= 0 ? this.typedColumns[c] : undefined;
  if (col === undefined || !isEditable(col)) return false;   // read-only → base activate (unchanged)
  return this.controller.beginEdit(ev);    // editor opens on the double-clicked cell
}
```

- **Single click (`clickCount===1`)** → returns false → falls through to the base focus + the no-op
  `select()` (cursor-only, unchanged — AC-3/AC-4).
- **Read-only cell** double-click → returns false → base `activate` (the existing row-activate), so
  double-click never edits a read-only cell (ST-21).
- The 500 ms window is the loop's `MULTI_CLICK_MS`, injectable via `createEventLoop({ now })`, so the
  spec drives it deterministically with a fake clock (ST-22).

`setColFromClickAlways` is the existing `setColFromClick` geometry (`editable-grid-rows.ts:429`)
generalized to run without the `mouseColumns` guard. **Note the overlap with the AC-4 single-click fix
above:** once `setColFromClick` runs on every body down (that fix), the column is already set from the
first down of the pair, so this explicit call is idempotent — keep it only as a defensive belt-and-braces
for the double-click cell resolution, or fold it away entirely since the mouse-down branch now always
sets the column. Either way, do not reintroduce two divergent column-from-click code paths.

## Scroll-into-view guarantee (AC-6)

No new machinery (AR-11) — assert the existing guarantees hold end-to-end:

- **Rows:** `updateTop()` (override at `editable-grid-rows.ts:299`) calls `super.updateTop()`
  (`keepVisible`) then clamps to `[rowFloor, rowCeil]`, so the focused row is always in the window — after
  `Ctrl+End` (`gridEnd`), `pageDown`, or a click on a partially-visible row. The cursor cell is painted
  only when in-window (`paintCursorCell`, :744), so it is never drawn off-screen.
- **Columns:** `autoScrollToCol` (:555, center panel, `autoScrollColumns`) reveals an off-screen focused
  column on a cursor move. `setGlobalCol` calls it (:549).

The plan adds spec assertions (ST-23, ST-24) over these; if a case is found unmet, the fix is a clamp in
the existing methods, not new code.

## Reference, don't restate

- `ev.clickCount` semantics + the injectable clock are documented in [02 §4](02-current-state.md).
- `setColFromClick`, `updateTop`, `autoScrollToCol`, `paintCursorCell` are existing methods — reused.

## Verification hooks

Spec: ST-20…ST-24 ([07 §D](07-testing-strategy.md)).
