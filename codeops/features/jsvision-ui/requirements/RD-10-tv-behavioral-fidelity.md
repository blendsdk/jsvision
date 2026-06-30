# RD-10: Turbo Vision Behavioral Fidelity — status press/release · cascade · tile · left-grow resize

> **Document**: RD-10-tv-behavioral-fidelity.md
> **Status**: Draft
> **Created**: 2026-06-30
> **Project**: jsvision UI (`@jsvision/ui`)
> **Depends On**: RD-05 (App shell — done; this completes its behaviors), RD-04 (Event loop — done; pointer-capture seam AR-82), RD-03/RD-02/RD-01 (done), `@jsvision/core` (done)
> **CodeOps Skills Version**: 3.1.0

---

## Feature Overview

The TV-fidelity **drawing** pass (commit `1caa188`) brought the desktop, window
frame, menu, and status-line **rendering** into 1:1 agreement with the original
Turbo Vision source (`magiblot/tvision`) — colors, glyphs, chrome geometry, hotkey
accents, the two-column drop shadow. That pass deliberately **deferred** four
**behavioral** items because they are interaction/geometry (not drawing), each
carries more risk, and three of them change a shipped behavior or supersede a
prior explicit decision. RD-10 captures those four so they ship as a single,
auditable fidelity-completion increment.

The four behaviors, all grounded in the original C++ source:

1. **Status-line press feedback + emit-on-release** (`tstatusl.cpp` `drawSelect`) —
   today the status line emits a command on mouse-**down** with no pressed-state
   feedback. TV repaints the held item **black-on-green** (`cSelect`), tracks the
   drag, and emits the command on mouse-**up** only if the cursor is still over the
   same enabled item (dragging off cancels).
2. **Cascade geometry** (`tdesktop.cpp:67-98`) — TV staggers each window's top-left
   by **+1 col / +1 row** while keeping the desktop's bottom-right corner, so windows
   extend to the corner and shrink as they stack. RD-05's `cascade` uses a compact
   preset (+2 col / +1 row, fixed 2/3×2/3 boxes — AR-87).
3. **Tile topology** (`tdesktop.cpp:127-235`) — TV's `mostEqualDivisors` + `dividerLoc`
   split the desktop **proportionally with no remainder** and `leftOver` gives trailing
   columns an extra row; **n=2 stacks** (1 col × 2 rows). RD-05's `tile` uses a
   `ceil(sqrt(n))` floor-grid that leaves a remainder strip and tiles n=2 side-by-side.
4. **Left-grow resize gesture** (`tframe.cpp:117-122`, `dmDragGrowLeft`) — the
   bottom-left grip `└─` is **drawn** faithfully but inert; only the SE corner resizes.
   TV's left grip resizes by moving the **left + bottom** edges (anchoring the right).

**Scope boundary:** RD-10 is purely the four behaviors above on the existing RD-05
shell. It ships **no** new widgets, no new theming surface beyond re-adding the
`statusSelected` role the drawing pass reverted (now consumed by item 1), and no new
public types beyond what these behaviors require. It **supersedes** AR-87 (the
cascade/tile preset) and the emit-on-press status behavior, with the user's explicit
approval (AR-88/AR-89/AR-90), and updates the affected spec oracles accordingly.

Complexity: **M** (two pointer-capture-driven interaction behaviors + two arrangement
algorithms ported from a known source; each is self-contained and individually testable).

---

## Functional Requirements

### Must Have

#### Status-line press feedback + emit-on-release (AR-88)

- [ ] **Held-item highlight** — a mouse-down on an enabled status item repaints that
  item (its full ` text ` span, pads included) in a **selected** style — black-on-green
  with a red-on-green hotkey run — matching TV's `cSelect`/`cSelDisabled`
  (`tstatusl.cpp` `drawSelect`). (AR-88)
- [ ] **Drag tracking** — while the button is held, moving the cursor onto a different
  item moves the highlight to it; moving off all items clears the highlight. The status
  line uses the loop's **pointer-capture** seam (`setCapture`/`releaseCapture`, AR-82) so
  it receives the move/up events even when the cursor leaves the bar. (AR-88)
- [ ] **Emit on release** — the item's command is emitted on mouse-**up** only if the
  cursor is still over the **same enabled** item it was pressed on; a release off the item
  (or on a disabled item) emits nothing. This **supersedes** today's emit-on-press. (AR-88)
- [ ] **`statusSelected` theme role** — re-add the additive core `Theme` role reverted by
  the drawing pass: `statusSelected = { fg black, bg green, hotkey red }` (TV `0x20`/`0x24`),
  consumed by the held-item highlight. (AR-88)

#### Cascade — TV-exact geometry (AR-89, supersedes AR-87)

- [ ] **TV cascade** — `cascade` arranges all tileable, visible windows so that window *i*
  has its **top-left** at the desktop origin + `(i, i)` (equal +1 col / +1 row stagger) and
  its **bottom-right** at the desktop's bottom-right corner — so each window extends to the
  corner and is one row/col smaller than the one behind it (`tdesktop.cpp:67-98`). A zoomed
  window is un-zoomed first; 0 windows is a no-op; 1 fills the desktop. (AR-89)

#### Tile — TV-exact topology (AR-90, supersedes AR-87)

- [ ] **TV tile** — `tile` packs all tileable, visible windows into a grid sized by
  `mostEqualDivisors(n)` (the most-square cols×rows), with column/row dividers placed by
  `dividerLoc` so the cells **exactly fill** the desktop (no remainder strip), and `leftOver`
  giving the trailing columns one extra row when `n` doesn't divide evenly. **n=2 stacks**
  (1 col × 2 rows). A zoomed window is un-zoomed first; 0 = no-op, 1 = fill (`tdesktop.cpp:127-235`). (AR-90)

#### Left-grow resize gesture (AR-91)

- [ ] **Functional bottom-left grip** — a mouse-down on the bottom-left grip `└─` (cols 0-1
  of the bottom row, on an active resizable window) begins a **left-grow** resize: dragging
  moves the window's **left and bottom** edges while the **right** edge stays anchored, floored
  at the window minimum size (TV `dmDragGrowLeft` + `dmDragGrow`, `tframe.cpp:117-122`,
  `tframe.cpp:192-193`). Uses the same pointer-capture seam as the SE resize. (AR-91)
- [ ] **Left-resize hit-zone** — `frameZoneAt` classifies the bottom-left grip cells as a
  distinct resize zone (e.g. `resize-left`) so the Window can begin the left-grow gesture; the
  SE corner keeps its existing `resize` (grow-bottom-right) behavior. (AR-91)

#### Acceptance & demos

- [ ] **Updated spec oracles** — the ST-11 desktop oracle (cascade stagger + tile topology)
  and the status-line press/emit spec/impl tests are updated to the TV-faithful expectations;
  the change is recorded as user-approved supersession of AR-87 + emit-on-press (AR-88…AR-90).
- [ ] **Demo coverage** — `demo:shell` (and/or `demo:tvision`) exercises cascade and tile so the
  new geometry is visible in the headless ASCII walkthrough; the status press/release and
  left-grow resize are covered by the interactive real-TTY demo.

### Should Have

- [ ] **`activeWindow()`/gesture introspection** as needed for the new tests (reuse existing
  desktop introspection; add none unless a test requires it).

### Won't Have (Out of Scope)

- **New widgets / controls** — RD-10 is behavior-only on the existing shell; controls remain RD-06+.
- **Keyboard-driven move/resize mode** — still deferred (AR-85); RD-10's resize work is the
  mouse left-grow gesture only, not a `Commands.move`/`resize` keyboard mode.
- **Other TV drag modes** — TV's `TFrame` exposes only the title (move), the SE grip (grow-BR),
  and the SW grip (grow-BL); RD-10 adds the SW grip. No top/left-edge or 8-handle resize.
- **Status help-context ranges** — still deferred (AR-72); the item list stays static.
- **Re-drawing changes** — all glyph/color/geometry drawing already shipped in `1caa188`; RD-10
  changes only behavior + the two arrangement algorithms (and re-adds one theme role for item 1).

---

## Technical Requirements

### Touched surfaces (all intra-package except one additive core role)

```ts
// --- core (additive, the only cross-package edit — re-adds the role reverted in 1caa188) ---
// On @jsvision/core Theme: statusSelected: ThemeRole = { fg: black, bg: green, hotkey: red }  (AR-88)

// --- @jsvision/ui status (AR-88) ---
interface StatusLoopSeam {
  // … existing emitCommand / isCommandEnabled …
  setCapture(view: View): void;     // reuse the RD-05 loop capture seam (AR-82)
  releaseCapture(): void;
}
// StatusLine gains a pressed-item index + move/up handling; emits on up, not down.

// --- @jsvision/ui desktop arrange (AR-89/AR-90) ---
// arrange.ts: cascade() → TV +1/+1 extend-to-corner; tile() → mostEqualDivisors/dividerLoc/leftOver.

// --- @jsvision/ui window frame + gestures (AR-91) ---
type FrameZone = … | 'resize-left';                 // new SW-grip zone (frame.ts)
// gestures.ts: a left-grow resize mode (anchor right edge, move left+bottom, floor at min size).
// Window.onEvent maps 'resize-left' → manager.beginResizeLeft(this); Desktop adds the gesture.
```

> These are the same shapes the deferred-items audit identified against the live code
> (`statusline.ts`, `arrange.ts`, `frame.ts`/`gestures.ts`/`desktop.ts`). Exact signatures are
> finalized in planning; the loop is **not** re-shaped (it already exposes `setCapture`/`releaseCapture`).

### Behavior notes

- **Status press/release** — `StatusLine` is post-process. On mouse-down over an enabled item it
  captures the pointer, records the pressed item, and repaints it in `statusSelected`; captured
  move re-targets the highlight; mouse-up releases the capture and emits the command iff still over
  the same enabled item. One coalesced frame per tick is preserved (RD-04 AR-54). (AR-88)
- **Cascade/tile** — ported algorithms operate on the desktop's tileable visible windows, un-zoom
  any maximized window first (PF-006 convention retained), and mutate each window's `layout.rect`
  then `invalidateLayout()` (the existing RD-05 mechanism). Only the geometry differs. (AR-89/AR-90)
- **Left-grow resize** — mirrors the existing SE free-resize gesture but anchors the right edge:
  new width = `rightEdge − pointerX`, new x = `pointerX`, floored at the min width (and bottom edge
  as today). Reuses the Desktop gesture/pointer-capture machinery. (AR-91)

---

## Integration Points

- **RD-05 (App shell — done)** — RD-10 modifies RD-05's `StatusLine`, `Desktop.arrange`, and
  `Window`/`Frame` behavior in place; it composes nothing new. It **supersedes** AR-87 (cascade/tile
  preset) and the emit-on-press status behavior; the active/inactive theming, chrome drawing, and WM
  structure are unchanged.
- **RD-04 (Event loop — done)** — reuses the additive `setCapture`/`releaseCapture` pointer-capture
  seam (AR-82) for the status press/release and the left-grow resize; no new loop surface.
- **`@jsvision/core` (done)** — the **only** cross-package edit is re-adding the `statusSelected`
  `Theme` role (additive, the same pattern as RD-05's `windowInactive`). All glyphs still reach the
  screen through RD-03's `DrawContext` → core `serialize`/`sanitize` boundary.
- **RD-06+ widgets (backlog)** — independent; RD-10 does not block or depend on the widget tiers and
  may be implemented before or after them.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Status emit timing | emit on release (TV) · keep emit-on-press + highlight | **emit on release** (held-item green highlight, command on mouse-up if still over the enabled item, drag-off cancels) | TV-faithful `drawSelect`; the drawing pass left the only behavioral status gap here | AR-88 |
| Cascade geometry | TV-exact · keep AR-87 preset | **TV-exact** (+1/+1 stagger, extend to corner, shrink as stacked) — supersedes AR-87 | the fidelity directive governs geometry; AR-87's preset was a deliberate-but-non-faithful shortcut | AR-89 |
| Tile topology | TV-exact · keep AR-87 preset | **TV-exact** (`mostEqualDivisors`/`dividerLoc`/`leftOver`; n=2 stacks) — supersedes AR-87 | same; the preset's floor-grid leaves a remainder strip and the wrong n=2 orientation | AR-90 |
| Left-grow resize | functional left-grow · leave decorative | **functional left-grow** (move left+bottom, anchor right) — the grip is already drawn | completes the resize affordance TV draws; all four items chosen Must-Have | AR-91 |
| RD placement | dedicated RD-10 · take RD-06 + shift widgets · `T-NN` tasks | **dedicated RD-10** after the reserved widget tiers | non-colliding; multi-phase + touches spec oracles (RD-worthy); numbering ≠ execution order | AR-92 |

> **Traceability:** AR-88…AR-92 are explicit user choices (RD-10 `add_requirement` interview,
> 2026-06-30). AR-89/AR-90 **supersede** AR-87; AR-88 supersedes the emit-on-press status behavior
> shipped in RD-05.

---

## Security Considerations

> RD-10 changes interaction behavior and window-arrangement math on the existing in-process shell. It
> adds **no** new untrusted-input surface, no network, no persistence.

- **Data sensitivity / auth / encryption / rate limiting / infrastructure**: N/A — same posture as RD-05.
- **Input validation**: all new geometry (cascade stagger, tile dividers, left-grow drag) is clamped to
  the desktop and the window minimum size and treats degenerate inputs (0/1 windows, off-desktop drags,
  releases off the item) as clamped no-ops — never throws. The pressed-item index is a bounded array
  index re-validated each event.
- **Injection**: no new output path; status text still reaches the screen via the RD-03 `DrawContext` →
  core `sanitize` boundary. Command names remain opaque keys compared by equality.
- **Availability**: each new interaction is a single bounded pass + one coalesced flush (RD-04 AR-54);
  pointer capture is always released on mouse-up (and a handler throw is isolated by the loop, AR-66).

---

## Acceptance Criteria

1. [ ] **Status held-highlight** — a mouse-down on an enabled status item repaints its full span in
   `statusSelected` (black-on-green, red-on-green hotkey run); no command is emitted yet. (AR-88)
2. [ ] **Status drag re-target + cancel** — while held, moving onto another item moves the highlight;
   moving off all items clears it; the status line tracks these via pointer capture. (AR-88)
3. [ ] **Status emit-on-release** — releasing over the same enabled item emits its command exactly once;
   releasing off the item, or on a disabled item, emits nothing. (AR-88)
4. [ ] **`statusSelected` role** — `defaultTheme.statusSelected` exists as `{ fg black, bg green, hotkey
   red }` and encodes without throwing; it is the only cross-package edit. (AR-88)
5. [ ] **TV cascade** — with the desktop W×H and n windows, after `cascade` window *i* has top-left
   `(i, i)` and bottom-right at `(W-1, H-1)` (extends to the corner, shrinks per step); a zoomed window
   un-zooms first; 0 = no-op, 1 = fill. (AR-89)
6. [ ] **TV tile** — after `tile`, the cells **exactly fill** the desktop (no remainder strip) using
   `mostEqualDivisors`/`dividerLoc`/`leftOver`; **n=2 yields 1 col × 2 rows (stacked)**; a zoomed window
   un-zooms first; 0 = no-op, 1 = fill. (AR-90)
7. [ ] **Left-grow resize** — a drag from the bottom-left grip moves the window's left + bottom edges
   while the right edge stays fixed, floored at the minimum size; the SE corner still grows bottom-right. (AR-91)
8. [ ] **Left-resize hit-zone** — `frameZoneAt` returns the distinct left-resize zone for the bottom-left
   grip cells (only on an active resizable window); other zones are unchanged. (AR-91)
9. [ ] **Spec oracles updated** — the ST-11 desktop oracle (cascade/tile) and the status press/emit
   spec/impl tests assert the TV-faithful behavior; `yarn verify` is green. (AR-88…AR-90)
10. [ ] **Demos** — `demo:shell` shows the TV cascade + tile geometry in its ASCII walkthrough; the
    interactive demo exercises status press/release and left-grow resize. No regression in the drawing
    fidelity shipped in `1caa188`.
11. [ ] **Packaging** — no new runtime dependency; the only cross-package edit is the additive
    `statusSelected` `Theme` role; `yarn check:deps`/`lint` pass. (AR-88)

---

> **Next step:** run the make_plan skill on RD-10 to produce the implementation plan (spec-first:
> update ST-11 + status specs RED → implement → GREEN → impl tests), then preflight, then exec_plan.
