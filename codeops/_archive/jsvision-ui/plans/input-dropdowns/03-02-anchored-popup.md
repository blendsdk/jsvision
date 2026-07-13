# Anchored Popup Primitive: Input Dropdowns

> **Document**: 03-02-anchored-popup.md
> **Parent**: [Index](00-index.md)

## Overview

The shared **internal** anchored-popup primitive (DRY — one implementation for both `History` and
`ComboBox`, AR-137): a non-modal overlay that anchors a `ListView` below a field, computes the
TV-faithful clamped placement, and routes pick/dismiss. It generalizes the RD-05 menu overlay +
`CatcherView` (`menu/controller.ts`) **without** inheriting menu-specific state.

## Architecture

### Current Architecture

`menu/controller.ts` mounts a `MenuPopup` + a transparent `CatcherView` into the app overlay,
toggling `overlay.state.visible` explicitly and hard-coding menu semantics (the `local.y === 0`
bar-row switch `:210`, `popup.highlight`/`onPick` `:177/:181`, the multi-level stack `:142`). The
`CatcherView` shape (`:71-95`) and focus save/restore (`:225/:251`) are the reusable parts.

### Proposed Changes

A new `dropdown/popup.ts` implements a generic `openAnchoredPopup(...)` (or an `AnchoredPopup`
controller object) that mounts a caller-supplied `ListView` + a fresh generic catcher into the
overlay host, gives the list focus, and returns a `dismiss()` handle. It reuses the derived
overlay-visibility seam (PA-5, [03-04](03-04-seams-and-theme.md)) so it coexists with the menu.
No edit to `menu/controller.ts` beyond the shared PA-5 migration.

## Implementation Details

### New Types/Interfaces

```ts
/** The overlay host + loop seam a popup needs (supplied by the app shell or a bare Dialog). PA-9. */
export interface PopupHost {
  /** The full-viewport overlay Group to mount into (top-z). */
  readonly overlay: Group;
  /** Save/restore focus + focus a view (subset of the loop seam). */
  focusView(view: View): void;
  getFocused(): View | null;
}

/** One anchored popup instance. */
export interface AnchoredPopup {
  /** Dismiss the popup (idempotent): unmount list + catcher, restore focus, no pick. */
  dismiss(): void;
}

/** Open an anchored popup hosting `list` below `anchor`. */
export function openAnchoredPopup(opts: {
  host: PopupHost;
  /** Anchor rect (the linked field's bounds, in overlay-local coords). */
  anchor: Rect;
  /** The list to host (History: ListView<string>; ComboBox: its ListView<T>). */
  list: ListView<unknown>;
  /** Max visible rows (default 6); window height = maxRows + 2. PA-4. */
  maxRows?: number;
  /** Called on Enter/double-click with the focused row index. */
  onPick(index: number): void;
  /** Called on any dismissal (Esc / outside-down / list-focus-loss). */
  onDismiss?(): void;
}): AnchoredPopup;
```

### Host acquisition — additive RD-04 envelope seam (PF-002)

A `History`/`ComboBox` is an app-created **leaf** placed inside a `Window`/`Dialog`; unlike the
`MenuBar` (which `application.ts:176-183` explicitly `attach()`es to the overlay), a leaf control has
**no path** to the overlay or the focus manager today: `DispatchEvent` (`view/types.ts:100-143`)
exposes `emit`/`focusView`/`setCapture`/`releaseCapture`/`hasCapture`/`setClipboard` — but **not**
`getFocused` and not the overlay — and `View.host` is only the render-root dirty-set seam
(`markRepaint`/`markRelayout`/`healFocus`). So the popup's `PopupHost` must be reached the same way
`emit`/`focusView`/`setCapture` already reach leaves: an **additive envelope seam**.

- Extend `DispatchEvent` (RD-04, additive — same pattern as `emit`/`focusView`/`setCapture`) with a
  `getFocused(): View | null` and an overlay-host accessor (a `popupHost?: PopupHost`, or an
  `overlay` + `getFocused` pair), sourced in the loop's `routeContext` beside the existing seams
  (`event/event-loop.ts:302-306`, `event/dispatch.ts:133-135`).
- A control opens the popup from inside `onEvent` via `ev` (present during real dispatch; absent in
  bare unit-constructed envelopes, so called optional-chained like `ev.emit?.(…)`). This keeps the
  host-less usage examples in [00-index](00-index.md) intact — no `host` field on
  `HistoryOptions`/`ComboBoxOptions`.
- The app-shell overlay (`application.ts:139-142`) is the default host it resolves to; a bare RD-11
  `Dialog` without a shell supplies its own `PopupHost` via the same seam (documented, PA-9).

This is a **third intra-`ui` seam** (beyond the Input linkage + derived-overlay seams); the additive
surface inventory in [00-index](00-index.md) / [01-requirements](01-requirements.md) is updated to
count it, and Phase 0 lands it ([99-execution-plan](99-execution-plan.md) 0.2.6).

### Placement (TV-faithful, decode §3 in [03-01](03-01-history.md))

Grow the anchor **±1 in x**, set height = **`maxRows + 2`** (window = frame + visible rows; the
**entry count never sizes the window** — TV's `r.b.y += 7` is unconditional, decode §3, so a
short list shows blank interior rows), position the top 1 row above the anchor top (matching
`r.a.y--`), then **`intersect`-clamp to the overlay extent** — the clamp is the *only* thing that
reduces rows: truncate near the bottom edge (fewer visible rows), **never flip upward** (PA-15,
decode note 3). The hosted `ListView` sits inside the frame inset (`grow(-1,-1)`), reserving edges
for its owned ScrollBar (RD-11) when entries overflow.

### Dismissal (concrete — AR-166/PA-15)

The list **receives focus on open** (`host.focusView(list.rows)`; save the prior focus first).
Dismiss on:
1. **Esc** — routed from the list/popup key handling → `dismiss()`.
2. **Outside mouse-down** — a generic full-viewport catcher (the `CatcherView` shape, minus the
   `y === 0` switch) → `dismiss()` **and** `ev.handled = true` (consumed, no pass-through).
3. **List-focus-loss** — an effect over `list.rows.focusSignal()` (PF-009) dismisses when the list
   loses focus (e.g. Tab-away). **Guard (PF-004):** `focusSignal()` is a `void` tick that fires on
   both gain *and* loss (`view.ts:88-90`) and the driving `bind`/effect runs once immediately on
   creation — so the effect calls `dismiss()` **only when `list.rows.state.focused === false`**,
   ignoring the open-time focus *gain* and the initial run (else the popup self-dismisses the instant
   it opens).

`dismiss()` is **idempotent** (guards against the double-fire of outside-down + focus-loss),
unmounts the list + catcher, and restores the saved focus. **Non-modal** (AR-132): the rest of the
UI keeps updating; after a dismissing outside-click the UI is interactable on the next event.

### Integration Points

- Mounts into `host.overlay` via `overlay.add(...)`; visibility is **derived** (PA-5) — mounting a
  visible child shows the overlay, `dismiss()` unmounting it hides the overlay iff no other popup
  (e.g. an open menu) remains.
- `onPick(index)` is wired by each control: `History` writes+`selectAll`s the linked field;
  `ComboBox` sets `value`/`text`.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Open with zero entries | Popup shows the empty list (or the control declines to open) | AR-130 |
| Anchor near the bottom edge | `intersect` truncates the popup (fewer rows); never flips up | PA-15 |
| Double dismissal (outside-down + focus-loss race) | `dismiss()` idempotent (first call wins) | PA-15 |
| No overlay host (bare Dialog, no shell) | Caller supplies a `PopupHost`; documented seam (PA-9) | PA-9 |

## Testing Requirements

- One primitive drives both controls; placement grows ±1 + clamps + scrolls; list takes focus on
  open; Enter/double-click → `onPick`; Esc / outside-down (consumed) / focus-loss → `dismiss` (once);
  non-modal (background updates during an open popup). (ST-cases in [07](07-testing-strategy.md).)
