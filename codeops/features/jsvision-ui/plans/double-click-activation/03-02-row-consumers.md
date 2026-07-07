# 03-02 — Row consumers (`ListRows` / `GridRows` / `TreeRows`)

> Realizes FR-3/FR-4/FR-5/FR-6/FR-7. Decisions AR-6/AR-7/AR-5/AR-9/AR-10. TV-derived ⇒ GATE-2 diff.

Each consumer reads `ev.clickCount` (from 03-01) inside its existing mouse-`down` branch. The
single-click path is untouched (focus + select); a `clickCount === 2` additionally activates.

## `ListRows` (`list-rows.ts:269-288`)

After the existing `focusTo(newItem)` + `select(newItem)`, add the double-click activate:

```ts
this.focusTo(newItem);
this.select(newItem);              // single click focuses + selects (ST-06) — unchanged
if (ev.clickCount === 2) this.activate(ev);   // double-click = activate (TV tlstview.cpp:276)
```

`activate(ev)` (`:365-372`) already selects + calls `onSelect?.(index, item)` + `ev.emit?.(command)`.
Cascades automatically to `ListView`, `ListBox`, `FileList`, `DirList`, and the `ComboBox`/`History`
popups (all built on `ListRows`).

- **File dialog (FR-6):** `FileList.onSelect → openEntry` (`file-dialog.ts:242-256`) now fires on a
  double-click — folder → enter, file → resolve + close. **No file-dialog code changes** (AR-9).
- **`ComboBox`/`History` (FR-7):** they pick on the `selected`-signal change from the **first**
  click and close the popup; the 2nd down lands after close, so `activate` on `=== 2` is inert — no
  regression (AR-10). Verified by ST-7.

## `GridRows` (`grid-rows.ts:250-262`)

Symmetric — after `focusTo(newItem)` + `select(newItem)`:

```ts
this.focusTo(newItem);
this.select(newItem);              // unchanged (AR-177 no-emit single click)
if (ev.clickCount === 2) this.activate(ev);   // double-click = activate
```

`DataGrid` inherits it (its body is `GridRows`).

## `TreeRows` (`tree-rows.ts:251-264`) — the fidelity fix (AR-5)

**Before** (non-TV single-click text emit):

```ts
this.focusTo(index);                                          // always focus the clicked row (:257)
if (local.x < graphWidth(row.level)) this.toggle(row.node);   // graph zone → toggle
else this.select(index, ev);                                  // text → select + onSelect + EMIT  ← NON-TV
```

**After** — single text click focuses only; graph-zone toggles; text double-click activates
(`toutline.cpp:465` `selected(foc)`):

```ts
this.focusTo(index);                                          // always focus the clicked row
if (local.x < graphWidth(row.level)) {
  this.toggle(row.node);                                      // graph zone → toggle expand (any click; see AR-15)
} else if (ev.clickCount === 2) {
  this.select(index, ev);                                     // text double-click → activate (emit)
}
// single text click → focus only (TV-faithful). A graph-zone double-click toggles twice (no emit) —
// an accepted deviation from TV's meDoubleClick-first structure: our two-down model (cc1 then cc2)
// already toggled on the first down, so a single meDoubleClick can't be reconstructed (AR-15).
```

- `this.select(index, ev)` (`tree-rows.ts:366`) is the activate path (sets `selected` + `onSelect` +
  `ev.emit`; it does **not** focus); `focusTo(index)` is the focus-only path called first. Adjust
  names to the actual methods when implementing.
- The graph-zone single-click toggle is preserved exactly (TV `:472`).
- Update the class JSDoc (`tree-rows.ts:223`) — the `(PA-14, no double-click)` note is now wrong;
  replace with the AR-5 decode reference.

## GATE-2 AFTER-diff (record in code + commit)

Re-open both `.cpp` and diff cell-for-cell / branch-for-branch:

- `tlstview.cpp:271-277` — down-loop `break`s on `meDoubleClick`, then `selectItem(newItem)` iff
  `range > newItem`. Our `clickCount === 2 ⇒ activate(ev)` (which guards `index < display.length`)
  matches the `range > newItem` guard. ✅
- `toutline.cpp:465-472` — `meDoubleClick ⇒ selected(foc)` **first, in any zone**, else graph-zone
  single-click toggle, else nothing. Our port matches for **text** (double → activate, single → focus
  only) and **graph single-click** (→ toggle). It **deviates** on a **graph-zone double-click**: TV
  activates, our port toggles twice (no emit). This is the **accepted AR-15 deviation** — the
  two-event decomposition (cc1 then cc2) already toggled on the first down, so a single `meDoubleClick`
  cannot be reconstructed; a reorder would yield toggle-then-activate, still unlike TV. Recorded here
  per GATE-2 rather than claimed as a clean match. ⚠️ text path ✅

Record the diff — text path ✅, graph-zone double-click = accepted AR-15 deviation — in the
`TreeRows`/`ListRows` JSDoc and the commit body.

## What stays unchanged (regression guard)

- Single-click focus + select on all three (dropdowns depend on `selected` being set).
- Enter/Space activation (`:332-335`, `:297-300`, tree key path).
- Wheel scrolling.
- No `@jsvision/core` change; no theme role.
