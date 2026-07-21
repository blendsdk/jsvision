/**
 * `Desktop` — the interactive window manager that hosts an application's windows.
 *
 * It is a group whose children are its windows in back-to-front order, filling its area with the
 * desktop background pattern. It handles raising a window to the front on click, dragging and
 * resizing (through the loop's pointer capture), zooming, cascading and tiling, and switching windows
 * with the `next`/`prev` commands or Alt+number. The window-management commands
 * (`zoom`/`close`/`next`/`prev`/`cascade`/`tile`) are handled after the focused window has had its
 * chance at the event.
 *
 * `createApplication` owns the desktop; reach it as `app.desktop`. Add windows with
 * {@link Desktop.addWindow}.
 */
import { Group } from '../view/index.js';
import type { DrawContext, DispatchEvent, View, Point } from '../view/index.js';
import type { Size2D } from '../layout/index.js';
import { Window } from '../window/index.js';
import { Commands } from '../status/index.js';
import { applyMove, applyResize, applyResizeLeft, MIN_WIDTH, MIN_HEIGHT } from './gestures.js';
import type { Gesture } from './gestures.js';
import { cascade, tile, nextWindow, prevWindow, windowByNumber } from './arrange.js';

/**
 * The slice of the event loop the desktop needs, injected by `createApplication`: pointer capture for
 * drag/resize, command emit/enablement, and focus for raise-on-click.
 */
export interface DesktopLoopSeam {
  /** Capture the pointer to a view for the duration of a drag or resize. */
  setCapture(view: View): void;
  /** Release the pointer capture. */
  releaseCapture(): void;
  /** Emit a command through the loop. */
  emitCommand(command: string, arg?: unknown): void;
  /** Whether a command is currently enabled. */
  isCommandEnabled(command: string): boolean;
  /** Focus a view. */
  focusView(view: View): void;
  /** Focus into a container, descending to its inner focusable view. */
  focusInto(view: View): void;
}

/** Matches the Alt+digit window-switch keys (1–9). */
const DIGIT_KEY = /^[1-9]$/;

/**
 * The window manager and desktop background. Its children are its windows, in back-to-front order.
 *
 * @example
 * import { createApplication, Window } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile; // ambient: reads process.env + process.platform
 * const app = createApplication({ caps });
 *
 * // Open two windows on the desktop.
 * const editor = new Window('Editor');
 * editor.number = 1;
 * editor.setLayout({ rect: { x: 1, y: 1, width: 30, height: 8 } });
 * app.desktop.addWindow(editor);
 *
 * const output = new Window('Output');
 * output.number = 2;
 * output.setLayout({ rect: { x: 10, y: 4, width: 30, height: 8 } });
 * app.desktop.addWindow(output);
 *
 * // Arrange them and switch between them.
 * app.desktop.tile();
 * app.desktop.focusNextWindow();
 * app.desktop.shadow = true; // give every window a drop shadow
 */
export class Desktop extends Group {
  /** Handle the window-management commands after the focused window has had a chance at the event. */
  override postProcess = true;

  /** @internal The event-loop seam; `null` until the app attaches it. */
  protected loop: DesktopLoopSeam | null = null;
  /** @internal The active (front-most, focused) window; tracked across raise/add/remove. */
  protected active: Window | null = null;
  /** @internal The in-flight drag/resize, or `null` when none. */
  protected gesture: Gesture | null = null;

  /** @internal Backing field for {@link shadow}. */
  protected _shadow = false;

  /**
   * Whether every window casts a drop shadow. Shadows are painted in z-order, so a front window's
   * shadow falls correctly over the windows behind it. Off by default. Setting it updates every
   * current window, and windows added later inherit it.
   */
  get shadow(): boolean {
    return this._shadow;
  }
  set shadow(on: boolean) {
    this._shadow = on;
    for (const win of this.windows()) win.castsShadow = on;
  }

  /** The desktop's windows in z-order (every child is a `Window`; the filter keeps it type-safe). */
  protected windows(): Window[] {
    return this.children.filter((c): c is Window => c instanceof Window);
  }

  /**
   * Re-fit every window to the desktop's new size: maximized windows re-maximize to the new area and
   * each window's restored rect is clamped back on-screen. The app calls this on a viewport resize.
   */
  handleViewportResize(): void {
    const size: Size2D = { width: this.bounds.width, height: this.bounds.height };
    for (const win of this.windows()) win.onDesktopResize(size);
  }

  /** Paint the desktop background: fill the whole area with the repeating desktop pattern. */
  override draw(ctx: DrawContext): void {
    const role = ctx.role('desktop');
    ctx.fill(role.pattern, ctx.color('desktop'));
  }

  /**
   * Attach the event-loop seam. `createApplication` calls this after building the loop; you do not
   * call it yourself.
   *
   * @param seam The loop operations the desktop needs (capture, commands, focus).
   */
  attachLoop(seam: DesktopLoopSeam): void {
    this.loop = seam;
  }

  /** The active (front-most, focused) window, or `null` if there are none. */
  activeWindow(): Window | null {
    return this.active;
  }

  /** Add a window to the desktop, bring it to the front, and focus it. */
  addWindow(w: Window): void {
    // The desktop-wide shadow toggle only adds shadows; it must never remove a window's own shadow
    // (a Dialog always casts one), so OR it in rather than overwrite.
    w.castsShadow ||= this._shadow;
    this.add(w);
    w.attachManager(this);
    this.raise(w);
  }

  /** Remove a window from the desktop; the next window down becomes active. */
  removeWindow(w: Window): void {
    const wasActive = this.active === w;
    this.remove(w);
    if (wasActive) {
      w.active.set(false);
      const windows = this.windows();
      this.active = windows.length > 0 ? windows[windows.length - 1] : null;
      if (this.active !== null) {
        this.active.active.set(true);
        this.loop?.focusInto(this.active); // focus the newly active window's inner view
      } else {
        // No window remains: run a tick so the emptied desktop repaints. removeWindow can be called
        // from an async modal teardown (a dialog's `finally`), outside any loop tick, and the loop
        // only flushes a frame at tick end — without this the closed window's stale frame would
        // linger on screen until the next input event.
        this.loop?.focusInto(this);
      }
    }
  }

  /** Bring `w` to the front, focus it, and re-theme the active/inactive window frames. */
  raise(w: Window): void {
    const i = this.children.indexOf(w);
    if (i === -1) return;
    this.children.splice(i, 1);
    this.children.push(w);
    // Exactly one window is active at a time: deactivate the previous one and activate this one.
    if (this.active !== null && this.active !== w) this.active.active.set(false);
    w.active.set(true);
    this.active = w;
    // Focus into the window so the inner view that owns the caret and highlight gets focus, not the
    // window group itself. A window with no focusable child falls back to focusing itself.
    this.loop?.focusInto(w);
    this.invalidateLayout(); // z-order changed — repaint so both frames re-theme
  }

  /** Cascade all windows from the top-left. */
  cascade(): void {
    cascade(this.windows(), this.bounds.width, this.bounds.height);
    this.invalidateLayout();
  }

  /** Tile all windows into a grid filling the desktop. */
  tile(): void {
    tile(this.windows(), this.bounds.width, this.bounds.height);
    this.invalidateLayout();
  }

  /** Bring the next window in z-order to the front. */
  focusNextWindow(): void {
    const w = nextWindow(this.windows(), this.active);
    if (w !== null) this.raise(w);
  }

  /** Bring the previous window in z-order to the front. */
  focusPrevWindow(): void {
    const w = prevWindow(this.windows(), this.active);
    if (w !== null) this.raise(w);
  }

  /** Bring the window whose `number === n` to the front (Alt+n); a no-op if there is no such window. */
  focusWindowNumber(n: number): void {
    const w = windowByNumber(this.windows(), n);
    if (w !== null) this.raise(w);
  }

  /** Start dragging a window: record the grab offset and capture the pointer. */
  beginMove(w: Window, grabLocal: Point): void {
    if (!w.movable) return;
    w.commitPlacement(); // fix a still-centered window into its rect before dragging it
    this.gesture = { kind: 'move', target: w, grabDX: grabLocal.x, grabDY: grabLocal.y };
    w.dragging.set(true);
    this.loop?.setCapture(this);
  }

  /** Start resizing a window from its bottom-right corner: fix the top-left and capture the pointer. */
  beginResize(w: Window): void {
    if (!w.resizable) return;
    w.commitPlacement(); // fix a still-centered window into its rect so the top-left is known
    const rect = w.layout.rect ?? { x: 0, y: 0, width: 0, height: 0 };
    this.gesture = { kind: 'resize', target: w, originX: rect.x, originY: rect.y };
    w.dragging.set(true);
    this.loop?.setCapture(this);
  }

  /**
   * Start resizing a window from its bottom-left corner: anchor the right edge and top and capture
   * the pointer, so the drag grows the bottom-left corner.
   */
  beginResizeLeft(w: Window): void {
    if (!w.resizable) return;
    w.commitPlacement(); // fix a still-centered window into its rect so the right edge is known
    const rect = w.layout.rect ?? { x: 0, y: 0, width: MIN_WIDTH, height: MIN_HEIGHT };
    this.gesture = { kind: 'resize-left', target: w, anchorRight: rect.x + rect.width - 1, originY: rect.y };
    w.dragging.set(true);
    this.loop?.setCapture(this);
  }

  /**
   * Handle a captured drag (move/resize), the window-management commands, and the Alt+digit
   * window-switch keys. During a drag, mouse events arrive here directly with desktop-local coordinates.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;

    if (this.gesture !== null && inner.type === 'mouse') {
      // If the pointer capture was lost externally mid-drag (a modal opened, the window was removed),
      // the drag is stale — drop it so the window does not jump.
      if (ev.hasCapture !== undefined && !ev.hasCapture(this)) {
        this.gesture.target.dragging.set(false);
        this.gesture = null;
        return;
      }
      if ((inner.kind === 'move' || inner.kind === 'drag') && ev.local !== undefined) {
        if (this.gesture.kind === 'move') applyMove(this.gesture, ev.local, this.bounds.width, this.bounds.height);
        else if (this.gesture.kind === 'resize') applyResize(this.gesture, ev.local);
        else applyResizeLeft(this.gesture, ev.local);
        ev.handled = true;
        return;
      }
      if (inner.kind === 'up') {
        this.gesture.target.dragging.set(false);
        this.gesture = null;
        this.loop?.releaseCapture();
        ev.handled = true;
        return;
      }
    }

    if (inner.type === 'command') {
      // Mark a handled command consumed. The desktop is an ancestor of the focused window, so it is
      // visited both in the focus chain and in the post-process sweep; without this the action would
      // otherwise run twice.
      if (this.handleCommand(inner.command)) ev.handled = true;
      return;
    }

    if (inner.type === 'key' && inner.alt && DIGIT_KEY.test(inner.key)) {
      this.focusWindowNumber(Number(inner.key));
      ev.handled = true;
    }
  }

  /**
   * Run a window-management command (a disabled command never reaches here). Returns `true` when the
   * command was one the desktop handles, so the caller can mark it consumed.
   */
  protected handleCommand(command: string): boolean {
    if (command === Commands.zoom) this.active?.zoom();
    // Close the active window through the same path its [×] button uses, which re-focuses the next
    // window. A no-op when the desktop is empty.
    else if (command === Commands.close) this.active?.close();
    else if (command === Commands.next) this.focusNextWindow();
    else if (command === Commands.prev) this.focusPrevWindow();
    else if (command === Commands.cascade) this.cascade();
    else if (command === Commands.tile) this.tile();
    else return false;
    return true;
  }
}
