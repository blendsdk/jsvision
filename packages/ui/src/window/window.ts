/**
 * A titled, framed window: a movable / resizable / zoomable / closable container you drop your
 * content into and hand to a desktop.
 *
 * A `Window` is a `Group` placed at an absolute rect (the desktop moves and resizes it by writing
 * `layout.rect`) with `padding: 1`, so content children sit inside the one-cell border. It draws its
 * own frame chrome — border, centered title, close/zoom boxes, resize grips — and picks the active or
 * inactive look automatically based on whether it is the desktop's top window. A mouse-down on the
 * frame raises the window and, depending on where it lands, starts a drag-move, drag-resize, closes,
 * or zooms it.
 *
 * A window learns about its desktop only after `desktop.addWindow(w)` injects the manager seam; until
 * then it renders as a standalone, always-active frame and its move/close/zoom actions are no-ops.
 */
import { Group } from '../view/index.js';
import type { DrawContext, DispatchEvent, Point } from '../view/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type { Rect, LayoutProps, Size2D } from '../layout/index.js';
import { drawFrame, frameZoneAt } from './frame.js';

/**
 * The set of desktop operations a {@link Window} calls back into. The desktop injects itself under
 * this narrow interface (via `addWindow`) so a window never has to import the desktop directly.
 * You rarely implement this yourself — `Desktop` already does.
 */
export interface WindowManager {
  /** Raise the window to the top of the z-order and focus it. */
  raise(w: Window): void;
  /** Remove the window from the desktop, disposing its reactive scope. */
  removeWindow(w: Window): void;
  /** The active (top-most focused) window, or `null` if none. */
  activeWindow(): Window | null;
  /** Start a drag-move gesture, grabbing the window at the given window-local point. */
  beginMove(w: Window, grabLocal: Point): void;
  /** Start a drag-resize gesture from the bottom-right corner. */
  beginResize(w: Window): void;
  /** Start a resize gesture from the bottom-left grip: the left edge grows while the right stays put. */
  beginResizeLeft(w: Window): void;
}

/** Default restored size for a window with no explicit rect (degenerate guard). */
const FALLBACK_RECT: Rect = { x: 0, y: 0, width: 10, height: 3 };

/**
 * Clamp a stored restore rect into `size`: shrink the extent to fit, then pull the origin so the
 * whole rect stays on-screen. Keeps a window's un-zoom target visible after the desktop shrinks.
 */
function clampRestoredRect(rect: Rect, size: Size2D): Rect {
  const width = Math.min(rect.width, size.width);
  const height = Math.min(rect.height, size.height);
  const x = Math.max(0, Math.min(rect.x, size.width - width));
  const y = Math.max(0, Math.min(rect.y, size.height - height));
  return { x, y, width, height };
}

/**
 * A titled, framed container. Add your content children and give it to a desktop with
 * `desktop.addWindow(w)`; the desktop then manages its z-order, focus, and drag gestures.
 *
 * @example
 * import { createApplication, Window, Text, Commands, statusLine, statusItem } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const app = createApplication({
 *   caps,
 *   statusLine: statusLine([statusItem('~Q~uit', Commands.quit, 'Alt+X')]),
 * });
 *
 * const w = new Window('Editor');
 * w.number = 1;                                  // shows "1" in the frame; Alt+1 activates it
 * w.setLayout({ rect: { x: 1, y: 2, width: 30, height: 10 } });
 * w.add(new Text('Hello from a window.'));
 * app.desktop.addWindow(w);                      // raises + focuses it
 */
export class Window extends Group {
  /** A window is a focus target so raising it (and resolving the active window) works. */
  override focusable = true;
  /** Absolute placement — the desktop writes `layout.rect`; `padding: 1` insets content past the border. */
  override readonly layout: Readonly<LayoutProps> = { position: 'absolute', padding: 1 };
  /** The window title, centered in the top border. Set it to repaint the frame. */
  readonly title: Signal<string>;
  /**
   * `true` while the window is being dragged (moved or resized), `false` otherwise. The desktop
   * flips it around a gesture; bind to it if you want to react to drag start/end. A standalone
   * window (never added to a desktop) stays `false`.
   */
  readonly dragging: Signal<boolean>;
  /**
   * `true` when this is the active (top-most, focused) window, `false` when it sits behind another.
   * The desktop keeps it in sync as windows are raised, added, and removed; the frame chrome reads
   * it to switch between the active and inactive look. A standalone window defaults to `true`.
   */
  readonly active: Signal<boolean>;
  /** An accelerator number 1–9 shown in the frame (Alt+N activates the window); `undefined` = none. */
  number?: number;
  /** Whether the title bar can be dragged to move the window. */
  movable = true;
  /** Whether the window can be resized via the corner grips. */
  resizable = true;
  /** Whether the window can be maximized/restored (shows the zoom box). */
  zoomable = true;
  /** Whether the window can be closed (shows the close box). */
  closable = true;
  /**
   * The smallest size a resize gesture will shrink the window to. Raise these in a subclass whose
   * content assumes a fixed minimum (e.g. a dialog whose child rects need at least 49×19).
   */
  minWidth = 10;
  minHeight = 3;

  /** @internal The desktop seam, injected by `Desktop.addWindow`; `null` before placement. */
  protected manager: WindowManager | null = null;
  /** @internal The rect to restore to when un-zooming; `null` while not zoomed. */
  protected restoredRect: Rect | null = null;
  /**
   * @internal Whether this window was already active when the current mouse-down selected it. The
   * hit-test records it (before the event is delivered) so the first click on an inactive window
   * only raises it, and a following click on the now-active window performs the frame action.
   */
  protected wasActiveOnPress = false;

  /**
   * @param title Initial window title (default empty).
   */
  constructor(title?: string) {
    super();
    this.title = signal(title ?? '');
    this.dragging = signal(false);
    this.active = signal(true); // standalone default; a desktop takes over maintaining it
    // Bind the reactive title so a title change repaints the frame. Bound on mount, because the
    // view's reactive scope does not exist yet in the constructor.
    this.onMount(() => this.bind(() => this.title()));
  }

  /** @internal Inject the desktop seam (called by `Desktop.addWindow`). */
  attachManager(manager: WindowManager): void {
    this.manager = manager;
  }

  /**
   * Called by the desktop right after a resize changed `layout.rect`, before the next reflow. The
   * base window does nothing — flow-laid content reflows on its own. Override it in a subclass whose
   * absolutely-placed children must be repositioned to track the new size (e.g. anchoring a button
   * to the bottom-right corner).
   */
  onResized(): void {
    /* no-op — flow-laid content reflows automatically */
  }

  /**
   * Freeze the current on-screen position into `layout.rect` and stop auto-centering, if this window
   * is still centered. The desktop calls this at the start of a move/resize gesture: a centered
   * window's real position lives in `bounds` (computed each reflow) rather than in `layout.rect`
   * (which stays at the origin), so a gesture that read `layout.rect` would snap it to the top-left.
   * After this runs once, the window behaves as a normally-placed window. No-op if not centered.
   */
  commitPlacement(): void {
    if (!this.centered) return;
    this.setLayout({ rect: { ...this.bounds } });
    this.centered = false;
  }

  /**
   * The window's current WM rect (the layout rect, or a degenerate fallback before placement).
   *
   * Returned read-only: this hands out the live layout rect, so a mutable alias would let a subclass
   * move the window a field at a time without requesting a reflow. Copy it (`{ ...currentRect() }`)
   * if you need a scratch rect.
   */
  protected currentRect(): Readonly<Rect> {
    return this.layout.rect ?? FALLBACK_RECT;
  }

  /** Whether the window is currently zoomed (maximized). */
  isZoomed(): boolean {
    return this.restoredRect !== null;
  }

  /** Forget the zoom state without restoring the rect (used by cascade/tile, which place the window). */
  resetZoom(): void {
    this.restoredRect = null;
  }

  /**
   * Toggle maximized ↔ restored. Maximizing saves the current rect and fills the desktop; restoring
   * re-applies the exact saved rect. No-op if the window is not zoomable or has no desktop parent.
   */
  zoom(): void {
    if (!this.zoomable || this.parent === null) return;
    if (this.restoredRect === null) {
      this.restoredRect = { ...this.currentRect() };
      this.setLayout({ rect: { x: 0, y: 0, width: this.parent.bounds.width, height: this.parent.bounds.height } });
    } else {
      this.setLayout({ rect: { ...this.restoredRect } });
      this.restoredRect = null;
    }
  }

  /**
   * Re-fit to a resized desktop: a zoomed window re-maximizes to the new desktop size, and its saved
   * restore rect is clamped so a later un-zoom still lands on-screen. A non-zoomed window is left
   * where it is (a window may overflow the desktop edge).
   *
   * @param size The new desktop content size.
   */
  onDesktopResize(size: Size2D): void {
    if (this.restoredRect === null) return; // not zoomed
    this.setLayout({ rect: { x: 0, y: 0, width: size.width, height: size.height } }); // re-maximize
    this.restoredRect = clampRestoredRect(this.restoredRect, size); // keep the un-zoom target on-screen
    this.onResized(); // let a subclass re-pin its absolute children to the new size
    // Not redundant with `setLayout`'s own reflow request: that one fires before `onResized()`
    // re-pins, so this is the one that schedules a pass seeing the re-pinned children.
    this.invalidateLayout();
  }

  /** Close the window, removing it from the desktop (which disposes its scope). No-op if not closable. */
  close(): void {
    if (!this.closable) return;
    this.manager?.removeWindow(this);
  }

  /** Paint the frame chrome, choosing the active or inactive colours from the current active state. */
  override draw(ctx: DrawContext): void {
    // `active` is the single source of truth for the active/inactive look; the desktop keeps it
    // current as windows are raised, added, and removed.
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
   * Select and raise the window on a mouse-down. The hit-test calls this before the event descends
   * into the window's interior, so the window comes to the front even when an interior child ends up
   * consuming the click. It first records whether the window was already active (so {@link onEvent}
   * can make the first click on an inactive window only raise it, not act on a frame button). A
   * standalone window (no desktop) is a safe no-op; re-selecting the already-active window just
   * re-raises it harmlessly.
   */
  override selectByClick(): void {
    if (this.manager === null) return;
    this.wasActiveOnPress = this.manager.activeWindow() === this;
    this.manager.raise(this); // bring to front + focus
  }

  /**
   * On a frame mouse-down, act on the zone the click landed in: close, zoom, start a title drag-move,
   * or start a corner resize. The window has already been raised by {@link selectByClick}, so this is
   * affordance-only. Non-mouse events and mouse events other than a press are ignored (an in-flight
   * drag is driven by the desktop, not here).
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'mouse' || inner.kind !== 'down' || this.manager === null) return;
    // First-click rule: the close/zoom/resize buttons only work on an already-active window. The
    // first click on an inactive window just raises + activates it (done in the select pass); a
    // following click then performs the action. The title-drag stays live even on the first click.
    const wasActive = this.wasActiveOnPress;

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
      // Inactive window: neutralize the active-only buttons so the first click can never
      // close/zoom/resize — only raise + activate. Falling them to `interior` (not `title`) avoids
      // starting any drag that would swallow the follow-up click.
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
