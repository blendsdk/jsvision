/**
 * `openAnchoredPopup` — the shared **internal** anchored-popup primitive for `History` + `ComboBox`
 * (RD-14 AR-137, input-dropdowns/03-02-anchored-popup.md).
 *
 * A non-modal overlay that anchors a caller-supplied `ListView` below a field: it computes the
 * TV-faithful clamped placement (grow ±1 in x, fixed height `maxRows + 2` — the entry count never
 * sizes it, PF-003 — `intersect`-clamp to the overlay the ONLY row reducer, never flip up; decode
 * `thistory.cpp:90-98` §3), mounts a lean framed popup + a generic outside-click catcher into the
 * host overlay, gives the list focus, and wires pick/dismiss. It generalizes the RD-05 menu overlay +
 * `CatcherView` **without** menu-specific state (the `y === 0` bar switch / multi-level stack).
 *
 * The popup **frame** here is a lean box in the `historyWindow` role (decoded in Phase 0); the
 * TV-faithful close box + shadow + cell-by-cell GATE-2 diff land with the History control (Phase 2).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { Style } from '@jsvision/core';
import { View, Group, intersect } from '../view/index.js';
import type { DrawContext, DispatchEvent, PopupHost } from '../view/index.js';
import type { Rect, LayoutProps } from '../layout/index.js';
import { effect, createRoot } from '../reactive/index.js';
import { syncOverlayVisible } from '../app/index.js';
import type { ListView } from '../list/index.js';

/** Re-export the popup host seam (declared with the dispatch envelope, PF-002) for the dropdown API. */
export type { PopupHost } from '../view/index.js';

/** Default max visible list rows in a popup (TV `THistoryWindow` shows 6 interior rows; PA-4). */
export const DEFAULT_MAX_ROWS = 6;

/** The 3 visible cells of the dropdown button icon `▐↓▌` (TV `THistory::icon`, decode §1). */
export const DROPDOWN_ICON = { left: '▐', arrow: '↓', right: '▌' } as const;

/**
 * Draw the shared `▐↓▌` dropdown button icon at column `x` — `▐`/`▌` sides in `historyButtonSides`
 * (green-on-lightGray), the `↓` arrow in `historyButtonArrow` (black-on-green). Used by the `History`
 * button and reused by the `ComboBox` trailing button (PA-11), so the glyph/colors never drift.
 *
 * @param ctx The clipped, view-local paint context.
 * @param x   The left column to draw the 3-cell icon at (default 0).
 */
export function drawDropdownIcon(ctx: DrawContext, x = 0): void {
  const sides = ctx.color('historyButtonSides');
  const arrow = ctx.color('historyButtonArrow');
  ctx.text(x, 0, DROPDOWN_ICON.left, sides);
  ctx.text(x + 1, 0, DROPDOWN_ICON.arrow, arrow);
  ctx.text(x + 2, 0, DROPDOWN_ICON.right, sides);
}

/** A safe fallback viewport when the overlay has no rect yet (never reached once composed). */
const FALLBACK_VIEWPORT: Rect = { x: 0, y: 0, width: 80, height: 24 };

/** One open anchored popup instance — the caller's handle to dismiss it. */
export interface AnchoredPopup {
  /** Dismiss the popup (idempotent): unmount the list + catcher, restore the saved focus, no pick. */
  dismiss(): void;
}

/** Options for {@link openAnchoredPopup}. Generic over the hosted list's item type `T`. */
export interface AnchoredPopupOptions<T> {
  /** The overlay host + focus save/restore seam (the app shell, or a bare `Dialog`; PA-9). */
  host: PopupHost;
  /** The anchor rect — the linked field's bounds, in overlay-local coordinates. */
  anchor: Rect;
  /**
   * Factory building the list to host (History: `ListView<string>`; ComboBox: its `ListView<T>`).
   * Called **inside** the popup's reactive owner so the list's constructor computeds (its sorted
   * display) are owned and disposed on dismiss — never leaked (they must NOT be created in the caller's
   * click handler, which runs outside any `createRoot` scope).
   */
  buildList(): ListView<T>;
  /** Max visible rows (default {@link DEFAULT_MAX_ROWS}); the window height is `maxRows + 2`. PA-4. */
  maxRows?: number;
  /** Called on activation (Enter/Space/click) with the list's selected display index. */
  onPick(index: number): void;
  /** Called on any dismissal (Esc / outside-down / list-focus-loss). */
  onDismiss?(): void;
}

/**
 * The generic outside-click catcher — the menu `CatcherView` shape minus the `y === 0` bar switch
 * (03-02). A transparent, full-viewport overlay child that dismisses on any mouse-down and **consumes**
 * it (no pass-through to the control behind — PA-15). It must stay visible to hit-test.
 */
class PopupCatcher extends View {
  /** Free-floating, full-viewport; the popup sets `rect`. */
  override layout: LayoutProps = { position: 'absolute' };

  constructor(private readonly onOutside: () => void) {
    super();
  }

  /** Paint nothing — the catcher only intercepts outside clicks. */
  draw(): void {
    // intentionally empty (transparent)
  }

  /** A mouse-down anywhere not covered by the popup (which paints above): dismiss + consume. */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'mouse' && inner.kind === 'down') {
      this.onOutside();
      ev.handled = true;
    }
  }
}

/**
 * The framed popup window: an absolute, `padding:1` group that draws the `historyWindow` frame and
 * hosts the list inside the 1-cell inset. Catches **Esc** in the focus-chain bubble → dismiss.
 */
class PopupFrame extends Group {
  override layout: LayoutProps = { position: 'absolute', padding: 1 };
  /**
   * Cast the TV-faithful drop shadow (`shadowSize {2,1}`): `THistoryWindow`/`ComboBox` popups are
   * `TWindow`s, which shadow like any other window. The compose walker paints the L-shaped shadow in
   * the `shadow` role under the overlay clip (render-root.ts `drawDropShadow`).
   */
  override castsShadow = true;

  constructor(private readonly onEsc: () => void) {
    super();
  }

  /** Fill the interior + draw the border box in the `historyWindow` role (blue frame; decode §4). */
  override draw(ctx: DrawContext): void {
    const role = ctx.role('historyWindow');
    const fill: Style = { fg: role.fg, bg: role.bg };
    const border: Style = { fg: role.border, bg: role.bg };
    ctx.fill(' ', fill);
    ctx.box(0, 0, ctx.size.width, ctx.size.height, border);
  }

  /** Esc bubbles up the focus chain (the list does not consume it) → dismiss the popup. */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'key' && inner.key === 'escape') {
      this.onEsc();
      ev.handled = true;
    }
  }
}

/**
 * Compute the TV-faithful popup rect — the exact `THistory::handleEvent` sequence
 * (`thistory.cpp:90-98`, GATE-1/GATE-2 verified), generalized for `maxRows`:
 *   `r.a.x--; r.b.x++;` — grow ±1 in x (width = field + 2).
 *   `r.a.y--;` — top 1 row above the anchor top (never flips up).
 *   `r.b.y += 7;` — for TV's 6 visible rows; generalized the intermediate height is `maxRows + 3`.
 *   `r.intersect(owner->getExtent());` — clamp to the overlay (truncate near the bottom edge).
 *   `r.b.y--;` — the final decrement, applied AFTER the clamp — so a bottom-clamped popup is
 *     `clampedHeight − 1` tall (an unclamped popup is `maxRows + 2`). This ordering is load-bearing:
 *     computing the height before clamping would be off-by-one at the bottom edge.
 * The `intersect`-then-`−1` is the ONLY thing that reduces rows; there is never an upward flip (PA-15).
 *
 * @param anchor   The field bounds (overlay-local).
 * @param maxRows  Max visible list rows.
 * @param viewport The overlay extent to clamp within.
 * @returns The clamped popup window rect.
 */
/**
 * The absolute rect of a mounted view: the sum of parent-relative `bounds.x/y` up the tree (the root
 * bounds are absolute). Used to anchor a popup in overlay-local coordinates — the overlay is the
 * full-viewport top-z group at the origin, so overlay-local ≡ absolute.
 *
 * @param view The mounted view (a linked `Input` for History, the `ComboBox` field for ComboBox).
 * @returns The view's absolute rect.
 */
export function absoluteRect(view: View): Rect {
  let x = 0;
  let y = 0;
  let node: View | null = view;
  while (node !== null) {
    x += node.bounds.x;
    y += node.bounds.y;
    node = node.parent;
  }
  return { x, y, width: view.bounds.width, height: view.bounds.height };
}

function placePopup(anchor: Rect, maxRows: number, viewport: Rect): Rect {
  const grown: Rect = {
    x: anchor.x - 1,
    y: anchor.y - 1,
    width: anchor.width + 2,
    height: maxRows + 3, // TV's `r.b.y += 7` (maxRows 6 → 9); the `-1` below lands the final height
  };
  const clamped = intersect(grown, viewport);
  return { x: clamped.x, y: clamped.y, width: clamped.width, height: Math.max(0, clamped.height - 1) };
}

/**
 * Open an anchored popup hosting `list` below `anchor`. Non-modal (AR-132): the rest of the UI keeps
 * updating; after a dismissing outside-click the UI is interactable on the next event.
 *
 * @param opts The host, anchor, list, `maxRows`, and the `onPick`/`onDismiss` callbacks.
 * @returns The {@link AnchoredPopup} handle (idempotent `dismiss()`).
 */
export function openAnchoredPopup<T>(opts: AnchoredPopupOptions<T>): AnchoredPopup {
  const { host, anchor, onPick, onDismiss } = opts;
  const maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
  const overlay = host.overlay;
  const viewport = overlay.layout.rect ?? FALLBACK_VIEWPORT;

  const savedFocus = host.getFocused();
  let dismissed = false;

  // One reactive owner for the WHOLE popup: the hosted list is built inside this root so its
  // constructor computeds (the sorted display) plus the focus-loss + pick effects all belong to a
  // single scope that `dispose()` tears down on dismiss. Building the list here (not in the caller's
  // click handler) is what keeps its computeds from leaking outside any `createRoot` (RD-14 defect).
  return createRoot((dispose) => {
    const list = opts.buildList();

    /** Idempotent teardown: unmount views, dispose the scope, restore focus, notify (PA-15). */
    function dismiss(): void {
      if (dismissed) return;
      dismissed = true;
      overlay.remove(frame);
      overlay.remove(catcher);
      syncOverlayVisible(overlay);
      dispose(); // dispose the list computeds + the focus-loss/pick effects BEFORE restoring focus
      if (savedFocus !== null) host.focusView(savedFocus);
      onDismiss?.();
    }

    const frame = new PopupFrame(dismiss);
    frame.layout = { position: 'absolute', padding: 1, rect: placePopup(anchor, maxRows, viewport) };
    // The hosted list must FILL the frame's padded interior: `size:fr` fills the main axis (else the
    // frame sizes it to its collapsed `auto` width), `align:stretch` (the frame default) fills the
    // cross axis. Merge so the ListView keeps its own `direction:'row'` ([rows | bar]) split.
    list.layout = { ...list.layout, size: { kind: 'fr', weight: 1 } };
    frame.add(list);

    const catcher = new PopupCatcher(dismiss);
    catcher.layout = {
      position: 'absolute',
      rect: { x: viewport.x, y: viewport.y, width: viewport.width, height: viewport.height },
    };

    // Mount catcher first (bottom-most, catches outside clicks) then the frame (paints/hits above it),
    // matching the menu z-order; derive the overlay visibility from the new child count (PA-5).
    overlay.add(catcher);
    overlay.add(frame);
    syncOverlayVisible(overlay);

    host.focusView(list.rows); // the list receives focus on open (saved prior focus above)

    // Focus-loss dismissal (PF-004): `focusSignal()` is a void tick firing on both gain AND loss, and
    // this effect runs once immediately on creation — so dismiss ONLY when the list is now unfocused,
    // ignoring the open-time focus gain + the initial run (else the popup self-dismisses on open).
    effect(() => {
      list.rows.focusSignal()();
      if (!dismissed && !list.rows.state.focused) dismiss();
    });
    // Pick on activation: Enter/Space/click set `list.selected` (nav via arrows does not) — skip the
    // initial value so a pre-existing selection never auto-picks on open.
    let firstSelection = true;
    effect(() => {
      const index = list.selected();
      if (firstSelection) {
        firstSelection = false;
        return;
      }
      if (!dismissed && index >= 0) {
        onPick(index);
        dismiss();
      }
    });

    return { dismiss };
  });
}
