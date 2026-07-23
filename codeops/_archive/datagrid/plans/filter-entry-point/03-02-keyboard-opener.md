# 03-02 — Keyboard Opener (`Alt+Down`)

> **Document**: 03-02-keyboard-opener.md
> **Parent**: [Index](00-index.md)
> **Implements**: FR-3 · **Refs**: AR-1, AR-5, AR-9, AR-10, AR-11

Add a keyboard route into `openFilterPopup` for the focused column, so filtering is reachable without
a mouse. The opener lives on the grid body (which owns the focused column) and reports up to the
container (which owns the popup). No new focusable header cursor (out of scope, `01`).

## Body: handle `Alt+Down` (`editable-grid-rows.ts`)

In `onEvent`, inside the `inner.type === 'key'` block and **before the fall-through to
`super.onEvent`** (`02 §body keys`), add:

```
if (inner.key === 'down' && inner.alt && !inner.ctrl && !inner.shift && !this.controller.isEditing()) {
  const globalCol = this.focusedCol();            // the shared global column cursor
  this.onOpenFilter?.(globalCol, ev);             // report up; container decides filterability + anchor
  ev.handled = true;
  return;
}
```

- **Must precede `super.onEvent` (preflight PF-001).** `Alt+Down` is **not** unbound on the body:
  `EditableGridRows` doesn't handle it, so it falls through to the base `GridRows.handleKey`, whose
  `case 'down'` ignores modifiers (`ui/src/table/grid-rows.ts:278`) and moves the row cursor down today.
  Intercepting here — before `super.onEvent` — is what *repurposes* it; returning early prevents the
  base row-down. A plain `Down` (no Alt) still reaches the base and row-navigates (spec-guarded, `07`).
- Guard on **not editing** via `this.controller.isEditing()` (`editing.ts:154,304`) — while a cell
  editor is open the editor owns keys (and the in-editor `Alt+Down`→ComboBox path, `editing.ts:235`,
  must keep working). Focus is on the editor while it is open, so the body rarely sees the key anyway;
  the guard makes the behavior robust for a direct-dispatch unit test (ST-9).
- Forward the **live `ev`** (not a synthesized copy) so `ev.focusView`/`ev.popupHost` reach the popup.

## Body config: the new callback

Add `onOpenFilter?: (globalCol: number, ev: DispatchEvent) => void` to the `EditableGridRows` config
(alongside `onCursorEnterPanel`, `editable-grid-rows.ts:74`). Optional — a body with no handler simply
ignores `Alt+Down`.

## Container: wire `onOpenFilter` → `openFilterPopup` (`grid.ts`, `grid-panels.ts`)

- `grid-panels.ts` passes `onOpenFilter` into each panel body (like the other body callbacks).
- **Retain the headers (preflight PF-002).** `grid.ts` today keeps only `parts.center` + `parts.inner`
  from `buildGridBody` (`grid.ts:404-407`) and **discards `parts.headers`** — yet `openFilterPopup`
  *requires* a live `SortHeader` (`grid.ts:821`, `absoluteRect(header)` at `:834`). So `grid.ts` must
  now **retain `parts.headers`** as a field and **re-assign it in `rebuildBody`** (`grid.ts:467-480`,
  which mints fresh headers each call — a stale reference after a hide/show/reorder/frozen-resize would
  be a live bug). The mouse path reaches its header via a capturing closure (`grid-panels.ts:247`); the
  keyboard path has no closure, so this retained array is the only route.
- `grid.ts` implements it:
  1. Map `globalCol` → `columnId` (visible-column projection) and resolve the owning **header panel**
     from the retained `headers` (by the panel offset/segment math `buildGridBody` already computes) —
     the same header that owns the funnel for that column in a frozen grid.
  2. If the column is **not filterable** (`col.filterable === false`), no-op (FR-4).
  3. Compute the **funnel-cell anchor** in that header's local space — the same `{ x, y }` the mouse
     path builds (`sort-header.ts:361-362` computes `funnelLocalX`); expose a small header helper
     `funnelAnchor(columnId)` so the container reuses the exact reserve math rather than duplicating
     it.
  4. Call `openFilterPopup(columnId, anchor, ev, header)` — the existing method (`grid.ts:821`),
     unchanged. The blank-popup behavior for an unfiltered column is already handled (AR-10).

## Edge cases

- **Focused column off-screen / horizontally scrolled:** `openFilterPopup` anchors on the header's
  absolute origin + the funnel anchor; if the column is scrolled out, the popup still anchors at the
  computed header cell (consistent with a mouse click on that cell). No special handling.
- **No focused column / empty grid:** `focusedCol()` clamps to a valid range in a non-empty grid; on
  an empty grid the no-op filterability/column-lookup guard returns without a popup.
- **Frozen panels:** the container resolves the owning header from the global column, so `Alt+Down`
  works in any panel (AR-11).

## JSDoc

`onOpenFilter` gets a doc comment (purpose, params, when it fires, the not-editing precondition). The
`Alt+Down` behavior is documented on the body's key-handling JSDoc in plain language.
