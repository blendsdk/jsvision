# Current State: Navigation & Interaction

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **CodeOps Skills Version**: 3.8.0

The exact seams RD-10 refactors, grounded in the code (file:line). Everything below was verified by a
codebase recon of `@jsvision/datagrid`, `@jsvision/ui`, and `@jsvision/core`.

## 1. The four hardcoded body handlers (what the keymap replaces)

`EditableGridRows.onEvent` (`packages/datagrid/src/editable-grid-rows.ts:322`) intercepts keys
**before** `super.onEvent` (reached only at line 356), in this precedence:

| Handler | Def | Chords → behavior |
|---------|-----|-------------------|
| `handleOpenFilter` | :421 | `Alt+Down` (guarded `!ctrl && !shift`) → `onOpenFilter(focusedCol, ev)` |
| `handleColKey` | :499 | `left`→col−1, `right`→col+1, `home`→col 0 (`Ctrl+Home` also row 0), `end`→last col (`Ctrl+End` also last row) |
| `tryBeginEdit` | :444 | `F2`/`Enter`→`beginEdit`; `F4`→`beginEdit({openDropdown})`; printable/`Space`→`beginEdit({replaceWith})` — **editable cell only** |
| `handleSelectionKey` | :366 | `Shift+↑/↓`→`onRangeToRow`; `Space` on a **read-only** cell→`onToggleRow` |

Precedence matters and must be preserved: `tryBeginEdit` runs before `handleSelectionKey`, so `Space`
begins an edit on an editable cell and toggles selection on a read-only one. The refactor keeps this
exact precedence; the keymap only makes the **chords** remappable (AR-1, AR-9).

`select()` is already a no-op override (:312) so a plain click is cursor-only — double-click-to-edit
(RD-10) builds on this, not against it.

## 2. The base `GridRows` nav helpers (what the full-coverage keymap delegates to)

`EditableGridRows extends GridRows<T>` (`packages/ui/src/table/grid-rows.ts`). The base's key logic is
`handleKey` (`grid-rows.ts:272`, a `switch (inner.key)`):

- `up`→`focusBy(-1)` (:276), `down`→`focusBy(1)` (:279)
- `pageup`→`focusBy(-rows)` / `Ctrl`→`focusTo(0)` (:281), `pagedown`→`focusBy(rows)` / `Ctrl`→`focusTo(len-1)` (:285)
- `home`/`end`→`focusTo(topItem ± rows)` (:289/:292), `left`/`right`→`indentBy(∓1)` H-scroll (:295/:298)
- `enter`/`space`→`activate(ev)` (:301)

**These helpers are all `protected`** — `focusBy`, `focusTo`, `viewportRows()` (:155), `topItem` (:105),
`updateTop()` (:165), `activate()`, `handleKey()`. So the RD-10 router can call `this.focusBy(1)` /
`this.focusTo(0)` / `this.viewportRows()` directly for `moveUp/moveDown/pageUp/pageDown/gridStart/gridEnd`
with **no re-implementation** (AR-4). The subclass already reads `this.topItem`/`this.focused`/
`this.updateTop()`, confirming access.

The base `onEvent` also handles the **wheel** (`grid-rows.ts:246`: `type==='wheel'`→`focusBy(±3)`) and
**mouse-down** (:252): `focusTo` + `select`, then `if (ev.clickCount === 2) this.activate(ev)` (:262).
The datagrid body does not override this mouse path today, so a body double-click currently *activates
the row* — RD-10 changes this to *edit the cell* on an editable cell (§4).

## 3. The framework keymap→command dispatch + the Tab swallow (the Tab mechanism)

`route()` in `packages/ui/src/event/dispatch.ts` runs two pre-view steps:

```ts
// dispatch.ts:124 — a keymapped chord becomes a command; the raw key is swallowed, never reaching a view
if (inner.type === 'key' && ctx.keymap !== undefined) {
  const name = ctx.keymap.lookup(inner);
  if (name !== undefined) { ctx.emitCommand(name); return; }
}
// dispatch.ts:134 — an UNBOUND Tab moves focus and is swallowed BEFORE the 3-phase view dispatch
if (inner.type === 'key' && inner.key === 'tab') {
  if (inner.shift) ctx.focusPrev(); else ctx.focusNext();
  return;
}
```

So `Tab` reaches a view only if the loop keymap binds it (then it becomes a command). The loop keymap is
built once at construction — `this.keymap = buildKeymap(opts.clipboardKeys, opts.keymap)`
(`event-loop.ts:187`), stored `private readonly` (:123). **There is no runtime `setKeymap`.** Therefore
the app must pass `tab`→command in `createEventLoop({ keymap })`, and the grid registers a handler for
that command — exactly the AR-2 design. Confirmed public loop API:

- `loop.register(command, handler): () => void` (`event/types.ts:179`; impl `event-loop.ts:255`).
- `loop.focusNext()` / `loop.focusPrev()` / `loop.focusView(view)` (`event/types.ts:132`/:134/:136).
- A view's focus state is readable via `view.state.focused` (`view/view.ts:92`; the datagrid's
  `gridActive()` already reads `this.state.focused`).

No View has a direct handle to `loop.register` (recon found none), so the handler registration lives in
the app-called `installGridNavigation(loop, grid)` helper, not inside the grid (AR-2, AR-12).

The core keymap primitive to build `gridKeymap` from: `createKeymap(bindings)` (`core` `input/keymap.ts`,
chord grammar `'ctrl+alt+shift+key'`), re-exported from `@jsvision/core` and `@jsvision/ui`.

## 4. Double-click — `ev.clickCount` already exists (no bespoke timer)

`DispatchEvent.clickCount` (`packages/ui/src/view/types.ts:130`) is stamped by the event loop on a
mouse-down (`event-loop.ts:264`): same cell within `MULTI_CLICK_MS` (`= 500`, :32) → increments, else
resets to 1; timed against `this.clock()` — injectable via `EventLoopOptions.now` (`event/types.ts:58`,
`this.clock = opts.now ?? Date.now`, `event-loop.ts:190`). `SortHeader` already reads it
(`sort-header.ts:391`, grip auto-fit). So RD-10 needs **no** `(lastDownCell, lastDownAt)` tracker and
**no** new timer (AR-3) — the body intercepts `ev.clickCount===2` over an editable cell → `beginEdit`.

## 5. The edit controller (the `commit-then-advance` seam)

`createEditController` (`packages/datagrid/src/editing.ts:174`). The commit path (`commit()`, :277) is
**await-close**: it stays open on veto, and on success calls `host.advanceRow()` (:309) — same column,
next row (`advanceRow` at `editable-grid-rows.ts:489`). The editor host handles `Enter`→commit /
`Esc`→cancel (`onEditorKey`, :252). RD-10's `Tab`-while-editing needs a **public** `commitEdit():
Promise<boolean>` on `EditController` (currently commit is private, reachable only via the editor's
`Enter`), and the body's `nextCell` calls it before advancing by cell (AR-7). `isEditing()` is already
public (:317).

## 6. grid.ts size + the module pattern

grid.ts is **1206 lines** against the current `< 1250` guard (re-based from 1200 in RD-09; this RD
re-bases it again to `< 1300` for the three new public delegators — PF-004, asserted in
`grid-footer.impl.test.ts` + `grid-selection.impl.test.ts`). `EditableDataGrid
extends Group` (:209) — a passive container with **no `onEvent`**; it owns the shared cursor signals
`focused`/`focusedCol` (:245/:246) and retains `_headers`/`_center`. The `keymap` option lands in
`EditableDataGridOptions` (:52) and threads to the body; `nextCell`/`prevCell` are thin delegators over
the container's cursor signals + the pure `navigation.ts` cursor math. All new logic goes in new
modules (`keymap.ts`, `navigation.ts`), keeping grid.ts thin — the established RD-05…09 pattern
(`overlay.ts`/`dev.ts`/`grid-selection.ts`/`row-mutations.ts`/`grid-footer.ts`/…). (AR-8)

## 7. `GridAction` vocabulary vs the code

The RD's proposed `GridAction` union predates RD-06's `Alt+Down` filter opener (the `filter-entry-point`
follow-up). The plan extends the union with `openFilter` so the funnel opener is remappable and part of
the one table (AR-15). `commit`/`cancel` remain editor-host-scoped (the open editor owns `Enter`/`Esc`),
documented in the table but not body-resolved. `nextCell`/`prevCell` are command-triggered (Tab), not
body-key-resolved (no key reaches the body for them).
