/**
 * `Scroller` — a Turbo Vision `TScroller` viewport over an oversized content view (RD-11 AC-2/AC-3,
 * PA-8/PA-17/AR-105).
 *
 * TV decode (`source/tvision/tscrolle.cpp`, GATE-1 verified BEFORE + GATE-2 diffed AFTER — every
 * geometry/range fact below matches the source; the bar `value` broadcast is realized as a shared
 * reactive signal, and keyboard/wheel are documented jsvision extensions, not TV drawing):
 *   • **`scrollDraw`** `:95` — `delta = { x: hScrollBar.value, y: vScrollBar.value }`; on a change,
 *     shift the content and redraw. Here `delta` is two signals shared with the owned bars' `value`.
 *   • **`setLimit(x,y)`** `:131` — sets each bar `setParams(value, 0, limit−size, size−1, arStep)` ⇒
 *     range `[0, extent − viewport]`, `pageStep = viewport − 1`. Re-applied every `draw()` from the
 *     live viewport size (TV re-applies it in `changeBounds`).
 *   • **Palette** `cpScroller` `:35` — the *content* decides its own colours; the Scroller draws none.
 *
 * `Scroller` is a `Group` holding the content child + one auto-owned `ScrollBar` per requested axis in
 * the reserved edge cells (vertical → rightmost column, horizontal → bottom row). Because the RD-02
 * layout engine clamps absolute-rect coords to ≥0, the `-delta` content offset cannot go through
 * `layout.rect`; instead **`draw()` positions the content + bars each compose** (PA-17) — the compose
 * walker draws a parent then descends into its children at their current `bounds`, so the offset is
 * live for mount/scroll/resize with no engine edit.
 *
 * **Keyboard is a jsvision extension (PF-004/PF-008):** TV's `TScroller` has no keys of its own (they
 * live on the selectable `TScrollBar`/the derived viewer), but jsvision's `ScrollBar` is passive/
 * non-focusable (PA-14), so the focusable `Scroller` drives the owned bars from ↑↓/←→/PgUp/PgDn/Home/
 * End. **Wheel** routes to the top-most view only (`hit-test.ts` PF-007 — wheel never bubbles), so it
 * scrolls when the pointer is over the bar (handled by `ScrollBar`, sharing this Scroller's `value`
 * signal) or over blank viewport area not covered by content (handled here) — matching TV, whose
 * wheel lives on the scrollbar. Wheel directly over content is intentionally a no-op (PA-18). Drawing/
 * geometry stay TV-exact. `.js` specifiers per NodeNext.
 */
import { Group } from '../view/index.js';
import type { DrawContext, DispatchEvent, View } from '../view/index.js';
import type { Size2D } from '../layout/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { ScrollBar } from './scroll-bar.js';

/** Which owned scrollbars a {@link Scroller} creates (default `'vertical'`, AR-105). */
export type ScrollbarsMode = 'vertical' | 'horizontal' | 'both' | 'none';

/** Construction options for {@link Scroller}. */
export interface ScrollerOptions {
  /** The oversized content view (clipped to the viewport, offset by `-delta`). */
  content: View;
  /** The content's natural size = the scroll limit; a thunk is re-read each `draw()` for dynamic content. */
  extent: Size2D | (() => Size2D);
  /** Which owned bars to create (default `'vertical'`). */
  scrollbars?: ScrollbarsMode;
}

/** A scrolling viewport: an oversized content child + auto-owned scroll bar(s) in the reserved edges. */
export class Scroller extends Group {
  override focusable = true; // the focusable owner drives the passive bars (PA-8 keyboard extension)
  /** The content view (clipped + offset by `-delta`). */
  protected readonly content: View;
  /** The content extent (scroll limit), resolved each `draw()`. */
  protected readonly extentOf: () => Size2D;
  /** Scroll offset on x, shared as the horizontal bar's `value` (PA-8). */
  protected readonly dx: Signal<number>;
  /** Scroll offset on y, shared as the vertical bar's `value` (PA-8). */
  protected readonly dy: Signal<number>;
  /** The owned vertical bar (rightmost column), when the mode includes it. */
  protected readonly vbar?: ScrollBar;
  /** The owned horizontal bar (bottom row), when the mode includes it. */
  protected readonly hbar?: ScrollBar;

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
   * Position the content + owned bars for the live viewport (PA-17). Runs each compose, before the
   * walker descends into the children, so the `-delta` offset (which the layout engine would clamp)
   * is applied here. Also re-limits the bars from the current viewport vs extent (TV `setLimit`).
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

    // TV setLimit: bar range [0, extent − viewport], pageStep = viewport − 1.
    this.vbar?.setRange(0, this.maxY, Math.max(1, this.vpH - 1));
    this.hbar?.setRange(0, this.maxX, Math.max(1, this.vpW - 1));

    // Offset the content by −delta (clamped for positioning; the signals are clamped on write).
    const offX = Math.min(this.maxX, Math.max(0, this.dx()));
    const offY = Math.min(this.maxY, Math.max(0, this.dy()));
    this.content.bounds = { x: -offX, y: -offY, width: ext.width, height: ext.height };
    if (this.vbar !== undefined) this.vbar.bounds = { x: this.vpW, y: 0, width: 1, height: this.vpH };
    if (this.hbar !== undefined) this.hbar.bounds = { x: 0, y: this.vpH, width: this.vpW, height: 1 };
  }

  /**
   * Drive the owned bars from the keyboard + wheel (the jsvision extension). Arrow = ±1, PgUp/PgDn =
   * ±(viewport−1), Home/End = extremes, wheel = ±3. All clamped to the cached viewport limits.
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
