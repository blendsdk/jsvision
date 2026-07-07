/**
 * `Window` — a titled, framed, movable/resizable/zoomable/closable container (RD-05 AR-67/AR-74).
 *
 * A `Group` placed `position:'absolute'` (the WM mutates `layout.rect`) with `padding:1` so content
 * children inset inside the 1-cell border. `draw` paints the frame chrome via the `frame.ts` helper,
 * choosing the active (`window`) or inactive (`windowInactive`) role per `manager.activeWindow()`.
 * `onEvent` raises the window on a mouse-down and maps the frame hit-zone to move/resize/close/zoom.
 *
 * The Window talks to its desktop through the injected {@link WindowManager} back-reference (set by
 * `Desktop.addWindow`), not by importing `Desktop` — so there is no `window`↔`desktop` import cycle.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group } from '../view/index.js';
import type { DrawContext, DispatchEvent, Point } from '../view/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type { Rect, LayoutProps, Size2D } from '../layout/index.js';
import { drawFrame, frameZoneAt } from './frame.js';

/**
 * The window-manager seam a {@link Window} needs from its `Desktop` (injected by `addWindow`). A
 * structural subset of `Desktop`, so no `Window`→`Desktop` import is needed (avoids a cycle).
 */
export interface WindowManager {
  /** Raise the window to the top of z-order + focus it (AR-78). */
  raise(w: Window): void;
  /** Remove the window from the desktop (disposes its scope, AR-71). */
  removeWindow(w: Window): void;
  /** The active (top-most focused) window, or `null` (AR-78). */
  activeWindow(): Window | null;
  /** Begin a drag-move gesture (PA-5/PA-10). */
  beginMove(w: Window, grabLocal: Point): void;
  /** Begin a drag-resize gesture from the SE corner (PA-5/PA-10). */
  beginResize(w: Window): void;
  /** Begin a left-grow resize gesture from the SW grip — right edge anchored (RD-10 AR-91). */
  beginResizeLeft(w: Window): void;
}

/** Default restored size for a window with no explicit rect (degenerate guard). */
const FALLBACK_RECT: Rect = { x: 0, y: 0, width: 10, height: 3 };

/**
 * Clamp a stored restore rect into `size` (HR-41): shrink the extent to fit, then pull the origin so
 * the whole rect stays on-screen. Keeps a window's un-zoom target visible after the desktop shrinks.
 */
function clampRestoredRect(rect: Rect, size: Size2D): Rect {
  const width = Math.min(rect.width, size.width);
  const height = Math.min(rect.height, size.height);
  const x = Math.max(0, Math.min(rect.x, size.width - width));
  const y = Math.max(0, Math.min(rect.y, size.height - height));
  return { x, y, width, height };
}

/** A titled, framed container; content children compose in the interior inset (AR-67, AR-74). */
export class Window extends Group {
  /** A window is a focus target so `raise → focusView(w)` works and `activeWindow()` resolves (PF-05). */
  override focusable = true;
  /** Free-floating placement; the WM mutates `layout.rect` (PA-15 / PF-01). `padding:1` insets content. */
  override layout: LayoutProps = { position: 'absolute', padding: 1 };
  /** Reactive title centered in the top border (repaints on change). */
  readonly title: Signal<string>;
  /**
   * Reactive drag state — TV's `sfDragging` made a signal (RD-08 PA-3). The Desktop gesture
   * lifecycle writes it: `true` in `beginMove`/`beginResize`/`beginResizeLeft`, `false` at BOTH
   * clear sites (mouse-up and the stale-capture abort). Consumers (the RD-08 `Indicator`'s ═↔─
   * swap) bind it; a manager-less window stays `false`.
   */
  readonly dragging: Signal<boolean>;
  /**
   * Reactive active state — TV's `sfActive` made a signal (RD-08 PA-19), Desktop-maintained on
   * raise/focus-change/add/remove. {@link draw} and the RD-08 EditWindow gadget visibility share
   * this one source. Defaults `true` so a manager-less (standalone) window renders active and
   * hosts visible gadgets.
   */
  readonly active: Signal<boolean>;
  /** 1–9, shown in the frame for Alt-N; `undefined` = no accelerator. */
  number?: number;
  movable = true;
  resizable = true;
  zoomable = true;
  closable = true;
  /**
   * Minimum resize extent (TV `TView::sizeLimits`, twindow.cpp:212 `minWinSize {16,6}` — here the WM
   * default `{10,3}`). The drag-resize gestures floor the window to this; a subclass with a larger
   * fixed layout (e.g. a file dialog whose child rects assume 49×19) raises it. Kept in sync with the
   * `gestures.ts` fallback defaults (duplicated to avoid a `window`→`desktop` import cycle).
   */
  minWidth = 10;
  minHeight = 3;

  /** @internal The desktop seam, injected by `Desktop.addWindow`; `null` before placement. */
  protected manager: WindowManager | null = null;
  /** @internal The restored rect saved while zoomed; `null` when not zoomed (PA-10/PA-15). */
  protected restoredRect: Rect | null = null;

  /**
   * @param title Initial window title (default empty).
   */
  constructor(title?: string) {
    super();
    this.title = signal(title ?? '');
    this.dragging = signal(false);
    this.active = signal(true); // manager-less default (RD-08 PA-19); the Desktop maintains it
    // Repaint when the reactive title changes (bound on mount, when the scope exists — PA-2).
    this.onMount(() => this.bind(() => this.title()));
  }

  /** @internal Inject the desktop seam (called by `Desktop.addWindow`). */
  attachManager(manager: WindowManager): void {
    this.manager = manager;
  }

  /**
   * Hook called by the WM immediately after a drag-resize mutated `layout.rect` (TV
   * `TGroup::changeBounds` → each child's `calcBounds`). The base window has nothing to do — its
   * content reflows automatically. A subclass with `growMode`-anchored absolute children (the
   * resizable file dialogs) overrides this to reposition them before the next reflow. No-op default.
   */
  onResized(): void {
    /* no-op — content children reflow via RD-02 absolute placement */
  }

  /**
   * Freeze the current on-screen rect into `layout.rect` and clear {@link View.centered}, if this
   * window is still auto-centered. Called by the WM at the START of a move/resize gesture so the
   * gesture reads a correct origin: a `centered` view's origin lives in `bounds` (written by the
   * reflow pass) but NOT in `layout.rect` (which stays `{0,0,…}`), so a gesture reading `layout.rect`
   * would otherwise snap the window to the top-left. TV centers once at insert (`ofCentered`); we
   * center-until-touched, then the window becomes a normal manually-placed window. No-op if already
   * placed (not `centered`).
   */
  commitPlacement(): void {
    if (!this.centered) return;
    this.layout = { ...this.layout, rect: { ...this.bounds } };
    this.centered = false;
  }

  /** The window's current WM rect (the layout rect, or a degenerate fallback before placement). */
  protected currentRect(): Rect {
    return this.layout.rect ?? FALLBACK_RECT;
  }

  /** Whether the window is currently zoomed (maximized). */
  isZoomed(): boolean {
    return this.restoredRect !== null;
  }

  /** Clear the zoom bookkeeping without restoring the rect (used by cascade/tile un-zoom — AR-87). */
  resetZoom(): void {
    this.restoredRect = null;
  }

  /**
   * Toggle maximized ↔ restored (AR-67). Maximizing saves the current rect and fills the desktop;
   * restoring re-applies the exact saved rect. No-op if `!zoomable` or not parented to a desktop.
   */
  zoom(): void {
    if (!this.zoomable || this.parent === null) return;
    if (this.restoredRect === null) {
      this.restoredRect = { ...this.currentRect() };
      this.layout.rect = { x: 0, y: 0, width: this.parent.bounds.width, height: this.parent.bounds.height };
    } else {
      this.layout.rect = { ...this.restoredRect };
      this.restoredRect = null;
    }
    this.invalidateLayout();
  }

  /**
   * Re-fit to a resized desktop (HR-41): a zoomed window re-maximizes to the new desktop rect, and its
   * stored `restoredRect` is clamped so a later unzoom still lands on-screen. A non-zoomed window is
   * left where it is (RD-02 tolerates a window overflowing the desktop edge).
   *
   * @param size The new desktop content size.
   */
  onDesktopResize(size: Size2D): void {
    if (this.restoredRect === null) return; // not zoomed
    this.layout.rect = { x: 0, y: 0, width: size.width, height: size.height }; // re-maximize
    this.restoredRect = clampRestoredRect(this.restoredRect, size); // keep the un-zoom target on-screen
    this.invalidateLayout();
  }

  /** Close the window: remove it from the desktop (disposes its scope → `onCleanup`, AR-71). No-op if `!closable`. */
  close(): void {
    if (!this.closable) return;
    this.manager?.removeWindow(this);
  }

  /** Paint the frame chrome in the active (`window`) or inactive (`windowInactive`) role. */
  override draw(ctx: DrawContext): void {
    // The reactive `active` signal is the ONE active-state source (RD-08 PA-19): the Desktop
    // maintains it at raise/add/remove, so frame chrome and the RD-08 EditWindow gadgets can never
    // disagree. Repaint on raise rides the Desktop's invalidateLayout (unchanged).
    const active = this.active();
    const role = active ? 'window' : 'windowInactive';
    drawFrame(
      ctx,
      ctx.size,
      {
        title: this.title(),
        number: this.number,
        active,
        zoomed: this.isZoomed(),
        resizable: this.resizable,
        closable: this.closable,
        zoomable: this.zoomable,
      },
      role,
    );
  }

  /**
   * Raise the window on a mouse-down and map the frame hit-zone to move/resize/close/zoom (AR-67/78).
   * Non-down mouse events and non-mouse events are ignored (the captured drag is handled by the Desktop).
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'mouse' || inner.kind !== 'down' || this.manager === null) return;
    // HR-09 / tframe.cpp:150-193 — TFrame gates the close/zoom/resize-grip affordances on
    // `state & sfActive`: an inactive window's first click only selects/activates it. Capture the
    // active-ness BEFORE raising so the first click on an inactive window's affordance columns is
    // inert (raise+activate only) and the second (now-active) click performs the action.
    const wasActive = this.manager.activeWindow() === this;
    this.manager.raise(this); // AR-78: raise-on-click (z + focus)

    const local = ev.local;
    if (local !== undefined) {
      const size = { width: this.bounds.width, height: this.bounds.height };
      const flags = {
        movable: this.movable,
        resizable: this.resizable,
        zoomable: this.zoomable,
        closable: this.closable,
      };
      let zone = frameZoneAt(size, local, flags);
      // Inactive: neutralize the active-gated affordances (close/zoom/grips → inert) so the first
      // click can never close/zoom/resize — only raise+activate. (Title-drag stays live; TV's
      // ungated `wfMove`. The close/zoom columns fall to `interior` here rather than to a move
      // because the discrete-click model must leave no capture that swallows the second click.)
      if (!wasActive && (zone === 'close' || zone === 'zoom' || zone === 'resize' || zone === 'resize-left')) {
        zone = 'interior';
      }
      if (zone === 'close') this.close();
      else if (zone === 'zoom') this.zoom();
      else if (zone === 'title' && this.movable) this.manager.beginMove(this, local);
      else if (zone === 'resize' && this.resizable) this.manager.beginResize(this);
      else if (zone === 'resize-left' && this.resizable) this.manager.beginResizeLeft(this);
    }
    ev.handled = true;
  }
}
