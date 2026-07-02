# App Shell Hardening: Runtime Hardening (RD-13)

> **Document**: 03-07-app-shell.md
> **Parent**: [Index](00-index.md)
> **Covers**: HR-08, HR-09 (Majors) · HR-14 (Major) · HR-35, HR-36, HR-37, HR-40, HR-41 (Minors)
> **Files**: `packages/ui/src/desktop/desktop.ts`, `window/{window.ts,frame.ts}`,
> `menu/controller.ts`, `status/statusline.ts`, `dialog/dialog.ts`, `event/event-loop.ts` (seam)

## Implementation Details

### HR-08 — `Commands.close` closes the active window (Major)

**Defect** (`desktop.ts:223-231`): `handleCommand` covers `zoom/next/prev/cascade/tile` only;
`close` falls through, yet `status/commands.ts:5-8` documents it as Desktop-handled and
tvision-demo binds it twice (menu + F3). Pressing F3 does nothing, silently.

**Fix spec.** `Desktop.handleCommand` handles `close`: close the active window (the same removal
path the frame's `[×]` uses — `removeWindow`, which re-focuses the next window), set `ev.handled`.
Mirrors TV `cmClose` (TV routes `cmClose` to the focused window; our Desktop-level handling of the
*active* window is the shipped chrome's documented contract). tvision-demo F3 + File→Close work.

### HR-09 — Frame affordances gated on active (Major, TV fidelity)

**Defect** (`window/window.ts:140-158` maps `frameZoneAt` unconditionally after raising;
`frame.ts:203-222` gates no zone on `active`): clicking an inactive window's title-bar left end
activates it **and instantly closes it** via the invisible close box (the boxes are *drawn* only
when active, `frame.ts:170,186`, but stay hot).

**TV decode (GATE 1).** `source/tvision/tframe.cpp` gates every affordance on `state & sfActive`:
close box `:150-153`, zoom `:168-169`, resize grips `:186-193` — an inactive frame's first click
only selects/drags. The BEFORE-decode task re-reads these lines and records the exact conditionals
(including the drag-anywhere-on-title behavior) here and in the code JSDoc; AFTER-diff re-checks.

**BEFORE-decode (recorded 2026-07-02, verified against the checked-out `magiblot/tvision`
`source/tvision/tframe.cpp` `TFrame::handleEvent`):**

- **Close box** (`tframe.cpp:150-163`): on `mouse.y == 0`, the close branch fires only when
  `(((TWindow*)owner)->flags & wfClose) != 0 && (state & sfActive) && mouse.x >= 2 && mouse.x <= 4`.
  So the close box is title-row columns **2..4**, gated on `sfActive` + `wfClose`.
- **Zoom box** (`tframe.cpp:164-176`): `else if ((flags & wfZoom) != 0 && (state & sfActive) &&
  ((mouse.x >= size.x-5 && mouse.x <= size.x-3) || (eventFlags & meDoubleClick)))`. Zoom zone is
  columns **size.x-5 .. size.x-3**, gated on `sfActive` + `wfZoom` (a double-click also zooms).
- **Move** (`tframe.cpp:177-179`): `else if ((flags & wfMove) != 0) dragWindow(event, dmDragMove)` —
  the title-row move is **not** gated on `sfActive`. So an inactive window's first title-row click
  (outside the now-skipped close/zoom columns) selects/activates then drag-moves.
- **Resize grips** (`tframe.cpp:186-193`): `else if ((state & sfActive) && mouse.y >= size.y-1 &&
  (flags & wfGrow))` → SE grip `mouse.x >= size.x-2` (`dmDragGrow`), SW grip `mouse.x <= 1`
  (`dmDragGrowLeft`). Both bottom-row grips gated on `sfActive` + `wfGrow`.

**Conclusion:** close, zoom, and both resize grips are gated on `state & sfActive`; only move is
ungated. HR-09 must make `frameZoneAt`/its consumer return `title`/`interior` for the close/zoom/grip
columns while the window is **inactive**, so the first click raises+activates only and the second
(now-active) click performs the action.

**AFTER-diff (recorded 2026-07-02):** `window.ts::onEvent` captures `wasActive` **before** `raise()`,
then when `!wasActive` neutralizes `close`/`zoom`/`resize`/`resize-left` zones to `interior`. Geometry
matches the decode cell-for-cell (close cols 2..4, zoom cols `w-5..w-3`, SW grip `x≤1`, SE grip
`x≥w-2`, bottom row `y≥h-1`) and the active-gating conditionals match `tframe.cpp:150-193`. **One
documented deviation** (dynamic behavior only, not drawing): TV's inactive title-row click on the
close/zoom columns falls through to the ungated `wfMove` drag-move; our discrete-click headless model
maps those columns to `interior` (inert) instead, because a capturing move-begin on the first click
would swallow the ST-4.b second click. Title-zone drag stays live. Cited in the `window.ts` JSDoc.

**Fix spec.** `frameZoneAt` (or its `window.ts` consumer) returns `title`/`interior` for
close/zoom/grip columns while the window is inactive — first click raises+activates only; the
second click (now active) performs the action. Oracle per the RD: click B's close column while A is
focused → B raised, not closed; second click closes.

### HR-14 — Stale gesture cleared on capture loss (Major) *(Decision per PA-13)*

**Defect** (`desktop.ts:186-203` clears `gesture` only on a delivered mouse-up; `execView`/
`endModal` clear `captureTarget` directly (`event-loop.ts:138,155`) and `routeContext`
auto-releases on unmount (`:237-239`) — none notify the Desktop): after a modal opens mid-drag, the
next desktop mouse-move teleports the window to the cursor.

**Fix spec (PA-13).** Additive envelope/route-context helper **`ev.hasCapture(view): boolean`**
(read-only query beside the existing `setCapture`/`releaseCapture` seam). The Desktop's gesture
branch, before applying, checks `ev.hasCapture(this)`; if false it **clears `gesture` and no-ops**.
`StatusLine.holding` (`statusline.ts:167-189`) gets the same guard. Intra-package additive —
consistent with RD-13's additive-only constraint.

### HR-35 — Bare top-level menu item emits+closes *(Decision per PA-17)*

**Defect** (`menu/controller.ts:249-257,184-188`): `switchTop` onto a submenu-less top-level item
leaves `openTopIndex` set with zero levels and never emits; Esc then early-returns → the menu is
stuck open, arrows/Enter dead.

**TV decode (GATE 1).** Decode `TMenuView::execute`/`handleEvent` in `source/tvision/tmnuview.cpp`
for a top-level item with `command != 0` and no submenu (selection → `endModal(command)`/emit +
close). The decode's `file:line` cites land here + in the code; if TV instead disallows arrow-onto,
the C++ wins (PA-17 records emit+close as the expected outcome pending the decode).

**Fix spec (PA-17).** Arriving on a bare top-level item via `switchTop` (arrows) highlights it;
**Enter emits the command and closes**; Esc **always** closes regardless of level state (the
early-return is removed). Clicking a bare title emits+closes directly (matching the existing
click-path expectations).

### HR-36 — Outside-click catcher tracks resize

**Defect** (`controller.ts:201-205`; `run.ts:86-91` resizes only the overlay): catcher/popups keep
open-time geometry; clicks in a region grown by a resize miss the catcher.

**Fix spec.** While a menu is open, a `resize` dispatch updates the catcher rect to the new
viewport (popup re-anchor is *not* in scope — TV closes menus on resize only if geometry demands
it; minimal fix = the catcher covers the full new viewport so outside-click semantics hold).

### HR-37 — `Dialog.modalHost` cleared at modal end

**Defect** (`dialog/dialog.ts:68-70,145-161`): `modalHost` persists after `endModal`; a retained
post-modal dialog swallows every later Esc and can end an unrelated modal with `'cancel'`.

**Fix spec.** The dialog clears its `modalHost` reference when its modal session ends (both
resolution paths — terminating command and frame-close/Esc). A retained mounted dialog then treats
Esc as any non-modal view would.

### HR-40 — One-click menu-title switch

**Defect** (the full-viewport catcher sits above the `MenuBar` in z; `controller.ts:83-89`):
clicking another top-level title while a menu is open needs two clicks.

**Fix spec.** The catcher's click handler hit-tests the menu-bar row first: a click landing on
another title **switches** to that menu directly (TV behavior); only clicks outside both popups and
the bar close-and-swallow.

### HR-41 — Zoom/restore rects track desktop resize

**Defect** (`window.ts:96-106`): a zoomed window keeps its stale size after a terminal resize;
`restoredRect` may lie off a shrunken desktop.

**Fix spec.** On desktop resize: a **zoomed** window re-maximizes to the new desktop rect;
`restoredRect` is clamped into the new desktop bounds (the existing gesture clamp logic in
`desktop/gestures.ts` is the reference for the clamp rule).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Close command with no window on the desktop | no-op, `ev.handled` not set | RD HR-08 (pinned; mirrors zoom/next which no-op empty) |
| Gesture applied after external capture loss | gesture cleared, event untouched | **PA-13** |
| Esc with a bare-item-selected menu | menu closes | **PA-17** |
| Resize while a menu is open | catcher covers the new viewport | RD HR-36 (pinned) |

## Testing Requirements

- Spec oracles ST-4.a–b, ST-3.e, ST-7.a–c,f–g ([07-testing-strategy.md](07-testing-strategy.md)).
- GATE-2 AFTER-diff for HR-09 (`tframe.cpp`) and HR-35 (`tmnuview.cpp`) recorded in code/commit.
- Impl tests: close-zone click when only one window exists; gesture across two successive modals;
  zoom→resize→unzoom rect roundtrip; title-switch with three menus.
