# 03-02: Body Dispatch Refactor (`editable-grid-rows.ts`)

> **Parent**: [Index](00-index.md) · **AR**: AR-1, AR-4, AR-9, AR-10
> **Modified file**: `packages/datagrid/src/editable-grid-rows.ts` · **Option**: `grid.ts` `keymap` pass-through

Rewrite `EditableGridRows.onEvent` so a key event resolves to a `GridAction` (03-01) and routes to the
existing behavior seams — replacing the four hardcoded chord-handlers (`handleColKey`, `tryBeginEdit`,
`handleSelectionKey`, `handleOpenFilter`) while **preserving their exact precedence and behavior**
(ST-13, zero RD-02…09 regression).

## The merged keymap on the body

`EditableGridRowsConfig` gains `keymap: GridKeymap` (the container passes `mergeKeymap(opts.keymap)` — a
frozen merged map, computed once). A single-body grid and every frozen panel share the same merged map.

## The new `onEvent`

```ts
override onEvent(ev: DispatchEvent): void {
  const inner = ev.event;
  if (inner.type === 'key') {
    const action = resolveGridAction(inner, this.keymap);
    if (action !== undefined && this.runAction(action, inner, ev)) { ev.handled = true; return; }
    // Fallback: printable type-to-edit is not a chord (AR-9) — unchanged detection from tryBeginEdit.
    if (this.tryPrintableEdit(inner, ev)) { ev.handled = true; return; }
  }
  if (inner.type === 'mouse' && inner.kind === 'down') {
    if (this.mouseColumns) this.setColFromClick(ev);
    if (this.handleDoubleClickEdit(inner, ev)) { ev.handled = true; return; }  // 03-04
    if (this.handleSelectionClick(inner, ev)) { ev.handled = true; return; }
  }
  super.onEvent(ev);
}
```

## `runAction` — the router (preserves today's precedence)

`runAction(action, inner, ev): boolean` returns whether the action was consumed. The **editability
gating** is the router's job, matching today's `tryBeginEdit`-before-`handleSelectionKey` order (AR-9).

**Per-panel ownership guard (preserve exactly — frozen-panel correctness).** Before any edit/selection/
value-help action acts, `runAction` MUST short-circuit exactly as the four old handlers did: return
false when `this.localCol() < 0` (the global cursor is in another panel — today's guard at
`editable-grid-rows.ts:370` for selection and `:446-447` for edit) and when `this.focused() < this.rowFloor`
(the cursor is on a pinned band row). Dropping this would let a non-owning frozen panel double-fire
`onToggleRow`/`onRangeToRow` or, because `currentCell()` clamps `Math.max(0, localCol())` to its own
column 0, begin an edit in the wrong panel. Nav/column actions (`moveLeft/Right`, `rowStart/End`,
`gridStart/End`, `moveUp/Down`, `pageUp/Down`) are global-cursor ops and run regardless of local
ownership (as today). The routing table:

| GridAction | Routing | Consumed? |
|-----------|---------|-----------|
| `moveLeft`/`moveRight` | `setGlobalCol(focusedCol ∓ 1, ev)` | always |
| `moveUp`/`moveDown` | delegate `this.focusBy(∓1)` (base helper — AR-4) | always |
| `pageUp`/`pageDown` | delegate `this.focusBy(∓this.viewportRows())` | always |
| `rowStart`/`rowEnd` | `setGlobalCol(0 / totalCols−1, ev)` | always |
| `gridStart`/`gridEnd` | set row 0 / last row **and** `setGlobalCol(0 / totalCols−1, ev)` | always |
| `beginEdit` | editable focused cell → `controller.beginEdit(ev)`; **read-only → return false** (falls through to base `activate`) | only on editable |
| `valueHelp` | editable → `controller.beginEdit(ev, { openDropdown: true })`; else false | only on editable |
| `toggleSelect` | editable cell → **return false** so `beginEdit` (via `space` printable) or base runs; read-only → `onToggleRow(focused)` | only on read-only |
| `extendUp`/`extendDown` | `onRangeToRow(clamp(focused ∓ 1))` | if `onRangeToRow` wired |
| `openFilter` | `!isEditing` → `onOpenFilter(focusedCol, ev)` | if `onOpenFilter` wired |
| `nextCell`/`prevCell`/`commit`/`cancel` | not body-resolved (03-03 / editor host) — `return false` | never |

**Critical precedence detail (AR-9):** `enter`/`space` resolve to `beginEdit`/`toggleSelect`
respectively, but the ORIGINAL code let `Space` on an editable cell begin an edit (replace-with-space)
and `Space` on a read-only cell toggle selection. To preserve this exactly:

- `space` → `resolveGridAction` yields `toggleSelect`. In `runAction`, `toggleSelect` on an **editable**
  cell returns false; the `onEvent` fallback `tryPrintableEdit` then treats `space` as a printable →
  `beginEdit({ replaceWith: ' ' })`. On a **read-only** cell, `toggleSelect` calls `onToggleRow`. Net
  behavior is identical to today.
- `enter` → `beginEdit` on editable; read-only returns false → `super.onEvent` runs the base
  `activate` (`grid-rows.ts:301`). Identical to today (`tryBeginEdit` returned false → base activate).

A remapped chord (e.g. `{ 'ctrl+e': 'beginEdit' }`) flows through the same router, so `Ctrl+E` begins an
edit and `F2` still does (AC-2, ST-12).

## `tryPrintableEdit` (the fallback)

Extracted from today's `tryBeginEdit` printable branch (`editable-grid-rows.ts:458-463`), unchanged:
on an editable focused cell, a non-chord single-codepoint key (or `space`) → `beginEdit({ replaceWith })`.
Runs only when `resolveGridAction` did not consume the key.

## Frozen-panel note

`setGlobalCol`/`localCol`/`onCursorEnterPanel` are unchanged — the router calls the same methods
`handleColKey` did, so cross-panel cursor movement and the leaf-focus hop are preserved. Every panel
shares the one merged keymap.

## Reference, don't restate

- The chord→action resolution + validation is **owned by** 03-01; this doc is the routing/precedence.
- `setGlobalCol`/`onToggleRow`/`onRangeToRow`/`onOpenFilter`/`controller.beginEdit` are existing seams
  (RD-05/06/07/08) — reused verbatim, not redefined.

## Verification hooks

Spec: ST-7…ST-13b ([07 §B](07-testing-strategy.md)) — every default binding, the remap, the no-`keymap`
regression oracle, and the frozen-panel per-panel ownership guard (ST-13b, PF-006).
