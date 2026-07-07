/**
 * A scrolling viewport over an oversized content view — a `Group` that clips a larger child to its own
 * bounds and pans it, with one auto-owned {@link ScrollBar} per requested axis drawn in the reserved
 * edge cells (vertical → rightmost column, horizontal → bottom row).
 *
 * The `Scroller` is focusable and drives the scroll from the keyboard (↑↓/←→/PgUp/PgDn/Home/End) and
 * the mouse wheel; the owned bars can also be dragged/clicked directly, sharing the same scroll-offset
 * signals. Give it the content view and its natural `extent` (a fixed size or a thunk for dynamic
 * content); the offset is clamped to `[0, extent − viewport]` on each axis so it never over-scrolls.
 *
 * The content view must be laid out to its full `extent` (it is drawn shifted by `-delta` and clipped
 * to the viewport), not to the viewport — otherwise there is nothing to scroll.
 */
import { Group, View as BaseView } from '../view/index.js';
import type { DrawContext, DispatchEvent, View } from '../view/index.js';
import type { Size2D } from '../layout/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { ScrollBar } from './scroll-bar.js';

/** Which owned scrollbars a {@link Scroller} creates (default `'vertical'`). */
export type ScrollbarsMode = 'vertical' | 'horizontal' | 'both' | 'none';

/**
 * The 1×1 bottom-right corner cell between a Scroller's two bars. Painted in the bar-background role
 * and composed on top of the content so scrolled content never bleeds into the corner cell.
 */
class CornerCell extends BaseView {
  draw(ctx: DrawContext): void {
    ctx.fill(' ', ctx.color('scrollBarPage'));
  }
}

/** Construction options for {@link Scroller}. */
export interface ScrollerOptions {
  /** The oversized content view (clipped to the viewport, offset by `-delta`). */
  content: View;
  /** The content's natural size = the scroll limit; a thunk is re-read each `draw()` for dynamic content. */
  extent: Size2D | (() => Size2D);
  /** Which owned bars to create (default `'vertical'`). */
  scrollbars?: ScrollbarsMode;
}

/**
 * A scrolling viewport: an oversized content child + auto-owned scroll bar(s) in the reserved edges.
 *
 * @example
 * import { Scroller, Group, Text, createEventLoop, signal } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const content = new Group();
 * for (let i = 0; i < 20; i += 1) {
 *   const line = new Text(`Line ${i + 1}`);
 *   line.layout = { position: 'absolute', rect: { x: 0, y: i, width: 30, height: 1 } };
 *   content.add(line);
 * }
 * const scroller = new Scroller({ content, extent: { width: 30, height: 20 }, scrollbars: 'vertical' });
 * scroller.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 24, height: 8 } };
 *
 * const root = new Group();
 * root.add(scroller);
 * const loop = createEventLoop({ width: 24, height: 8 }, { caps });
 * loop.mount(root);
 * loop.focusView(scroller);
 * loop.dispatch({ type: 'key', key: 'pagedown', ctrl: false, alt: false, shift: false }); // reveals lower lines
 */
export class Scroller extends Group {
  override focusable = true; // the focusable owner drives the passive bars from the keyboard
  /** The content view (clipped + offset by `-delta`). */
  protected readonly content: View;
  /** The content extent (scroll limit), resolved each `draw()`. */
  protected readonly extentOf: () => Size2D;
  /** Scroll offset on x, shared as the horizontal bar's `value`. */
  protected readonly dx: Signal<number>;
  /** Scroll offset on y, shared as the vertical bar's `value`. */
  protected readonly dy: Signal<number>;
  /** The owned vertical bar (rightmost column), when the mode includes it. */
  protected readonly vbar?: ScrollBar;
  /** The owned horizontal bar (bottom row), when the mode includes it. */
  protected readonly hbar?: ScrollBar;
  /** The reserved bottom-right corner cell between both bars, present only in `'both'` mode. */
  protected readonly corner?: CornerCell;

  // Viewport metrics cached from the last `draw()` (compose runs before events), so the keyboard/wheel
  // handlers clamp against the current viewport + extent without re-measuring.
  protected vpW = 0;
  protected vpH = 0;
  protected maxX = 0;
  protected maxY = 0;

  /**
   * @param opts `content` + `extent` (size or thunk) + optional `scrollbars` mode.
   */
  constructor(opts: ScrollerOptions) {
    super();
    this.content = opts.content;
    this.extentOf = typeof opts.extent === 'function' ? opts.extent : () => opts.extent as Size2D;
    this.dx = signal(0);
    this.dy = signal(0);
    const mode = opts.scrollbars ?? 'vertical';
    if (mode === 'vertical' || mode === 'both') this.vbar = new ScrollBar({ value: this.dy, orientation: 'vertical' });
    if (mode === 'horizontal' || mode === 'both') {
      this.hbar = new ScrollBar({ value: this.dx, orientation: 'horizontal' });
    }

    // z-order: content first (back), bars on top so their reserved edges win overlap + hit-test.
    this.add(this.content);
    if (this.vbar !== undefined) this.add(this.vbar);
    if (this.hbar !== undefined) this.add(this.hbar);
    // The corner cell exists only when both bars reserve an edge; add it LAST so it composes above the
    // content (which spans the full viewport) — the corner never shows scrolled content.
    if (mode === 'both') {
      this.corner = new CornerCell();
      this.add(this.corner);
    }

    // Repaint (⇒ re-`draw()`, re-position) whenever the scroll offset changes (a bar drag or our keys).
    this.onMount(() => {
      this.bind(
        () => {
          this.dx();
          this.dy();
        },
        () => undefined,
      );
    });
  }

  /** The current scroll offset (read-only view of the shared `dx`/`dy` signals). */
  get delta(): { readonly x: number; readonly y: number } {
    return { x: this.dx(), y: this.dy() };
  }

  /**
   * Position the content + owned bars for the live viewport. Runs on each compose, before the walker
   * descends into the children, so the `-delta` content offset is applied here rather than through the
   * layout rect (which would clamp negatives to 0). Also re-limits the bars from the current viewport
   * vs extent, so a resize keeps the ranges correct.
   *
   * @param ctx The clipped, view-local paint context (its `size` is the Scroller's viewport).
   */
  override draw(ctx: DrawContext): void {
    super.draw(ctx); // paint the optional background, if any
    const ext = this.extentOf();
    const hasV = this.vbar !== undefined;
    const hasH = this.hbar !== undefined;
    this.vpW = Math.max(0, ctx.size.width - (hasV ? 1 : 0));
    this.vpH = Math.max(0, ctx.size.height - (hasH ? 1 : 0));
    this.maxX = Math.max(0, ext.width - this.vpW);
    this.maxY = Math.max(0, ext.height - this.vpH);

    // Each bar's range is [0, extent − viewport] with a page step of viewport − 1.
    this.vbar?.setRange(0, this.maxY, Math.max(1, this.vpH - 1));
    this.hbar?.setRange(0, this.maxX, Math.max(1, this.vpW - 1));

    // Offset the content by −delta (clamped for positioning; the signals are clamped on write).
    const offX = Math.min(this.maxX, Math.max(0, this.dx()));
    const offY = Math.min(this.maxY, Math.max(0, this.dy()));
    this.content.bounds = { x: -offX, y: -offY, width: ext.width, height: ext.height };
    if (this.vbar !== undefined) this.vbar.bounds = { x: this.vpW, y: 0, width: 1, height: this.vpH };
    if (this.hbar !== undefined) this.hbar.bounds = { x: 0, y: this.vpH, width: this.vpW, height: 1 };
    if (this.corner !== undefined) this.corner.bounds = { x: this.vpW, y: this.vpH, width: 1, height: 1 };
  }

  /**
   * Drive the owned bars from the keyboard + wheel. Arrow = ±1, PgUp/PgDn = ±(viewport−1), Home/End =
   * the extremes, wheel = ±3. All clamped to the viewport limits cached by the last `draw()`.
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'wheel') {
      if (inner.dir === 'up') this.scrollByY(-3);
      else if (inner.dir === 'down') this.scrollByY(3);
      else if (inner.dir === 'left') this.scrollByX(-3);
      else this.scrollByX(3);
      ev.handled = true;
      return;
    }
    if (inner.type !== 'key') return;
    if (this.handleKey(inner.key)) ev.handled = true;
  }

  /** Map a navigation key to a scroll delta; returns whether it was consumed. */
  protected handleKey(k: string): boolean {
    switch (k) {
      case 'up':
        this.scrollByY(-1);
        return true;
      case 'down':
        this.scrollByY(1);
        return true;
      case 'left':
        this.scrollByX(-1);
        return true;
      case 'right':
        this.scrollByX(1);
        return true;
      case 'pageup':
        this.scrollByY(-Math.max(1, this.vpH - 1));
        return true;
      case 'pagedown':
        this.scrollByY(Math.max(1, this.vpH - 1));
        return true;
      case 'home':
        this.dy.set(0);
        return true;
      case 'end':
        this.dy.set(this.maxY);
        return true;
      default:
        return false;
    }
  }

  /** Scroll the y axis by `d`, clamped to `[0, maxY]`. */
  protected scrollByY(d: number): void {
    this.dy.set(Math.min(this.maxY, Math.max(0, this.dy() + d)));
  }

  /** Scroll the x axis by `d`, clamped to `[0, maxX]`. */
  protected scrollByX(d: number): void {
    this.dx.set(Math.min(this.maxX, Math.max(0, this.dx() + d)));
  }
}
