/**
 * The shared **internal** anchored-popup primitive behind the `History` and `ComboBox` dropdowns
 * (and the anchored calendar/color popups). Not part of the public API.
 *
 * `openAnchoredPopup` mounts a caller-supplied fixed-size view in a small framed window anchored just
 * below a field, plus a transparent full-viewport catcher that dismisses the popup on any outside
 * click. The popup is non-modal: the rest of the UI keeps updating. It gives the content focus, wires
 * pick/dismiss, and disposes the whole reactive scope on close.
 *
 * The placement clamps the window to the overlay extent (which is the only thing that can reduce its
 * height near the bottom edge); it never flips above the anchor.
 */
import type { Style } from '@jsvision/core';
import { View, Group, intersect } from '../view/index.js';
import type { DrawContext, DispatchEvent, PopupHost } from '../view/index.js';
import { cover } from '../view/dsl/index.js';
import type { Rect, LayoutProps } from '../layout/index.js';
import { effect, createRoot } from '../reactive/index.js';
import { syncOverlayVisible } from '../app/index.js';

/** Re-export the popup host seam (declared with the dispatch envelope) for the dropdown API. */
export type { PopupHost } from '../view/index.js';

/** Default max visible list rows in a dropdown popup. */
export const DEFAULT_MAX_ROWS = 6;

/** The 3 visible cells of the dropdown button icon `▐↓▌`. */
export const DROPDOWN_ICON = { left: '▐', arrow: '↓', right: '▌' } as const;

/**
 * Draw the shared `▐↓▌` dropdown button icon at column `x` — `▐`/`▌` sides in the `historyButtonSides`
 * role, the `↓` arrow in `historyButtonArrow`. Used by both the `History` button and the `ComboBox`
 * trailing button, so their glyphs and colours never drift apart.
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

/** Whether `view` is `ancestor` or a descendant of it (walks the parent chain). */
function isWithin(view: View, ancestor: View): boolean {
  let node: View | null = view;
  while (node !== null) {
    if (node === ancestor) return true;
    node = node.parent;
  }
  return false;
}

/** One open anchored popup instance — the caller's handle to dismiss it. */
export interface AnchoredPopup {
  /** Dismiss the popup (idempotent): unmount the list + catcher, restore the saved focus, no pick. */
  dismiss(): void;
}

/**
 * Options for {@link openAnchoredPopup}. The primitive can host any fixed-size `View` — the dropdown
 * lists, an anchored calendar, a colour swatch — not just a list.
 */
export interface AnchoredPopupOptions {
  /** The overlay host + focus save/restore seam (the app shell, or a bare `Dialog`). */
  host: PopupHost;
  /** The anchor rect — the linked field's bounds, in overlay-local coordinates. */
  anchor: Rect;
  /**
   * Build the hosted view. It is built **inside** the popup's reactive owner, so any computeds/effects
   * its constructor creates are owned by the popup and disposed on dismiss — do not build the content
   * in the caller's click handler (which runs outside any reactive owner and would leak it). The popup
   * passes in a `commit` trigger: the content wires its own activation callback (a list's pick, a
   * calendar's day-commit) to call `commit()`, which is the only channel that closes the popup.
   */
  buildContent(commit: () => void): View;
  /**
   * The hosted content's intrinsic size. `height` = the content's visible row count **+ 1** (the `+1`
   * absorbs the placement formula's border — see {@link placePopup}): a list passes `maxRows + 1`, an
   * 8-row calendar passes `9`. `width` = the content's column count (defaults to the anchor width);
   * the frame adds its own ±1 border.
   */
  contentSize: { width?: number; height: number };
  /** What receives focus on open (for the dropdowns, the list's rows renderer). */
  focusTarget(content: View): View;
  /** Called on any dismissal (Esc / outside click / content losing focus). */
  onDismiss?(): void;
}

/**
 * The transparent full-viewport outside-click catcher: a child that dismisses the popup on any
 * mouse-down and **consumes** it (so the click does not also reach the control behind it). It stays
 * visible so it can be hit-tested.
 */
class PopupCatcher extends View {
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
 * hosts the content inside the 1-cell inset. Catches **Esc** in the focus-chain bubble to dismiss.
 */
class PopupFrame extends Group {
  override layout: LayoutProps = { position: 'absolute', padding: 1 };
  /** The popup casts a drop shadow, like any window. */
  override castsShadow = true;

  constructor(private readonly onEsc: () => void) {
    super();
  }

  /** Fill the interior and draw the border box in the `historyWindow` (blue-frame) role. */
  override draw(ctx: DrawContext): void {
    const role = ctx.role('historyWindow');
    const fill: Style = { fg: role.fg, bg: role.bg };
    const border: Style = { fg: role.border, bg: role.bg };
    ctx.fill(' ', fill);
    ctx.box(0, 0, ctx.size.width, ctx.size.height, border);
  }

  /** Esc bubbles up the focus chain (the content does not consume it) and dismisses the popup. */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'key' && inner.key === 'escape') {
      this.onEsc();
      ev.handled = true;
    }
  }
}

/**
 * The absolute rect of a mounted view: the sum of parent-relative `bounds.x/y` up the tree (the root
 * bounds are absolute). Used to anchor a popup in overlay-local coordinates — the overlay is the
 * full-viewport top-z group at the origin, so overlay-local coordinates equal absolute coordinates.
 *
 * @param view The mounted view (the field a dropdown is anchored to).
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

/**
 * Compute the popup window rect: grow the anchor by one cell on each side in x, start one row above
 * the anchor top, size it to the content plus its border, then clamp to the overlay extent. The
 * final `-1` is applied AFTER the clamp so a popup truncated at the bottom edge ends up one row
 * shorter than the clamp — computing the height before clamping would be off-by-one at that edge. The
 * clamp is the only thing that reduces the height; the popup never flips above the anchor.
 *
 * @param anchor      The field bounds (overlay-local).
 * @param contentSize The hosted content's intrinsic size (`height` = visible rows + 1).
 * @param viewport    The overlay extent to clamp within.
 * @returns The clamped popup window rect.
 */
function placePopup(anchor: Rect, contentSize: { width?: number; height: number }, viewport: Rect): Rect {
  const grown: Rect = {
    x: anchor.x - 1,
    y: anchor.y - 1,
    width: (contentSize.width ?? anchor.width) + 2, // one border cell on each side
    height: contentSize.height + 2,
  };
  const clamped = intersect(grown, viewport);
  return { x: clamped.x, y: clamped.y, width: clamped.width, height: Math.max(0, clamped.height - 1) };
}

/**
 * Open an anchored popup hosting the caller's fixed-size `View` below `anchor`. Non-modal: the rest of
 * the UI keeps updating, and after a dismissing outside-click the UI is interactable on the next event.
 *
 * The popup passes a `commit` trigger to `buildContent` — the content wires its own activation
 * callback (a list's pick, a calendar's day-commit) to set the value and then call `commit()` to
 * close. That trigger is the only channel the content uses to dismiss the popup.
 *
 * @param opts The host, anchor, `buildContent(commit)`, `contentSize`, `focusTarget`, and `onDismiss`.
 * @returns The {@link AnchoredPopup} handle (idempotent `dismiss()`).
 */
export function openAnchoredPopup(opts: AnchoredPopupOptions): AnchoredPopup {
  const { host, anchor, contentSize, focusTarget, onDismiss } = opts;
  const overlay = host.overlay;
  const viewport = overlay.layout.rect ?? FALLBACK_VIEWPORT;

  const savedFocus = host.getFocused();
  let dismissed = false;

  // One reactive owner for the whole popup: the content is built inside this root so its constructor
  // computeds and the focus-loss effect share a single scope that `dispose()` tears down on dismiss.
  // Building it here (not in the caller's click handler, which runs outside any reactive owner) is what
  // keeps those computeds from leaking.
  return createRoot((dispose) => {
    /** Idempotent teardown: unmount the views, dispose the scope, restore focus, then notify. */
    function dismiss(): void {
      if (dismissed) return;
      dismissed = true;
      overlay.remove(frame);
      overlay.remove(catcher);
      syncOverlayVisible(overlay);
      dispose(); // dispose the content computeds + the focus-loss effect BEFORE restoring focus
      if (savedFocus !== null) host.focusView(savedFocus);
      onDismiss?.();
    }

    // Pass the commit trigger to the content: the only channel from a content activation to dismissal.
    // The content sets its value in its own callback before calling this, so pick-then-close is
    // preserved without the popup needing to read anything content-specific.
    const content = opts.buildContent(() => {
      if (!dismissed) dismiss();
    });
    const target = focusTarget(content);

    const frame = new PopupFrame(dismiss);
    frame.setLayout({ position: 'absolute', padding: 1, rect: placePopup(anchor, contentSize, viewport) });
    // The content must fill the frame's padded interior: `size:fr` fills the main axis (otherwise the
    // frame collapses it to its `auto` height) and the frame's default stretch fills the cross axis.
    // Only the size is set, so a list keeps its own row layout ([rows | bar]).
    content.setLayout({ size: { kind: 'fr', weight: 1 } });
    frame.add(content);

    const catcher = new PopupCatcher(dismiss);
    // A full-viewport cover overlay: it fills the app overlay (itself the whole viewport), so an
    // outside click anywhere dismisses. It paints nothing; only the frame is placed at the anchor.
    cover(catcher);

    // Add the catcher first (bottom-most, catches outside clicks) then the frame (paints and hits above
    // it); derive the overlay's visibility from its new child count.
    overlay.add(catcher);
    overlay.add(frame);
    syncOverlayVisible(overlay);

    host.focusView(target); // the focus target receives focus on open (prior focus saved above)

    // Dismiss when focus leaves the popup SUBTREE, not merely when the initial `focusTarget` blurs — so
    // a popup with several focusable parts (e.g. a grid plus a hex input) can move focus internally
    // (Tab / click) without closing itself. The effect follows focus while it stays inside `frame` and
    // dismisses only once it moves out. `focusSignal()` fires on both gain and loss; the open-time run
    // sees the target focused (inside) and does not dismiss.
    effect(() => {
      const focused = host.getFocused();
      const inside = focused !== null && isWithin(focused, frame);
      // Subscribe to the focus ticks of whichever popup view currently holds focus (so its next loss
      // re-runs this effect); fall back to `target` when focus is already outside.
      (inside ? focused! : target).focusSignal()();
      if (!dismissed && !inside) dismiss();
    });

    return { dismiss };
  });
}
