/**
 * {@link SurfaceView} — a passive `View` that displays a scrollable window onto a bound
 * {@link Surface}. It takes no input of its own; you scroll it by writing its `delta` signal (e.g.
 * bind a `ScrollBar.value` to it). The clip/margin math lives in `surface-geometry.ts`.
 *
 * What it paints, given the surface, the scroll offset, and the viewport size:
 * - the visible slice of the surface, positioned in the view;
 * - the empty-area bands (top/bottom/left/right) around the surface, filled with spaces in the
 *   inactive-window colour;
 * - the whole view filled with that empty colour when there is no surface, or when the surface has
 *   been scrolled entirely out of view.
 *
 * A wide glyph that would be split by a viewport edge is dropped whole rather than leaving a half
 * cell. The view is reactive: a pan, a surface swap, or a surface content change each schedule one
 * coalesced repaint.
 */
import { View } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type { Point } from '../view/geometry.js';
import { Surface } from './surface.js';
import { computeClip, marginRects, clampDelta } from './surface-geometry.js';

/** A static surface, `null`, or a reactive accessor of either (so the surface can be swapped live). */
export type SurfaceSource = Surface | null | (() => Surface | null);

/** Options for a {@link SurfaceView}. */
export interface SurfaceViewOptions {
  /** The bound surface (static, `null`, or a reactive accessor — swap-aware). */
  surface: SurfaceSource;
  /** Two-way scroll offset `{x,y}`; defaults to `signal({x:0,y:0})`. The caller drives it (e.g. a `ScrollBar`). */
  delta?: Signal<Point>;
  /** Fired when `delta` changes (skips the initial value and same-coordinate no-op writes). */
  onScroll?: (delta: Point) => void;
}

/**
 * A passive, scrollable window onto a {@link Surface}. Not focusable and handles no input — scroll it
 * by writing its `delta` signal (for example, bind a `ScrollBar.value` to it). Reactive: a pan, a
 * surface swap, or a surface content change each schedule one coalesced repaint.
 *
 * @example
 * import { Group, Surface, SurfaceView, ScrollBar, signal, at } from '@jsvision/ui';
 *
 * const surface = Surface.from(['+----+', '| hi |', '+----+']);
 * const delta = signal({ x: 0, y: 0 });
 *
 * const g = new Group();
 * g.add(at(new SurfaceView({ surface, delta }), 0, 0, 4, 2));
 *
 * // Drive the horizontal offset from a scroll bar (or write `delta` directly).
 * const hx = signal(0);
 * const bar = new ScrollBar({ value: hx, min: 0, max: surface.size.x - 4, orientation: 'horizontal' });
 * // …bind `hx` → `delta.x` in your own handler, or use SurfaceView.scrollTo / panBy.
 * g.add(at(bar, 0, 2, 4, 1));
 */
export class SurfaceView extends View {
  /** The view is passive — it never takes focus or handles input. */
  override focusable = false;

  /** Two-way scroll offset the caller drives. */
  readonly delta: Signal<Point>;
  /** Reactive surface read (normalized from the static-or-accessor option). */
  private readonly readSurface: () => Surface | null;
  private readonly onScroll?: (delta: Point) => void;

  /**
   * @param opts The bound `surface` (+ optional two-way `delta` + `onScroll`).
   */
  constructor(opts: SurfaceViewOptions) {
    super();
    const src = opts.surface;
    this.readSurface = typeof src === 'function' ? src : () => src;
    this.delta = opts.delta ?? signal<Point>({ x: 0, y: 0 });
    this.onScroll = opts.onScroll;

    this.onMount(() => {
      // draw() is not auto-tracked, so subscribe explicitly here to repaint on a pan (delta), a surface
      // swap (readSurface), or a content mutation (the surface's version counter).
      this.bind(() => {
        this.delta();
        const s = this.readSurface();
        if (s) s.version();
      });
      // onScroll — change-only (skips the initial run and same-coordinate no-op writes).
      if (this.onScroll) {
        let prev = this.delta();
        this.bind(
          () => this.delta(),
          (d) => {
            if (d.x !== prev.x || d.y !== prev.y) {
              prev = d;
              this.onScroll?.(d);
            }
          },
        );
      }
    });
  }

  /**
   * Scroll so `target` becomes the top-left of the viewport, **clamped** so the surface stays in view
   * (`[0, max(0, surface − view)]` per axis). Writing the `delta` signal directly bypasses the clamp if
   * you want to scroll past the edge.
   *
   * @param target The desired scroll offset `{x,y}`.
   */
  scrollTo(target: Point): void {
    const s = this.readSurface();
    const view = { x: this.bounds.width, y: this.bounds.height };
    const next = s ? clampDelta(target, s.size, view) : { x: Math.max(0, target.x), y: Math.max(0, target.y) };
    this.delta.set(next);
  }

  /** Pan by `(dx, dy)` from the current offset, clamped to keep the surface in view. */
  panBy(dx: number, dy: number): void {
    const d = this.delta();
    this.scrollTo({ x: d.x + dx, y: d.y + dy });
  }

  /** Paint the visible surface slice plus the empty-area margins (spaces in the inactive-window colour). */
  draw(ctx: DrawContext): void {
    const V = { x: ctx.size.width, y: ctx.size.height };
    if (V.x <= 0 || V.y <= 0) return; // nothing to draw into
    const cEmpty = ctx.color('windowInactive');
    const s = this.readSurface();
    const d = this.delta();
    const clip = s ? computeClip(s.size, d, V) : { x: 0, y: 0, width: 0, height: 0 };
    if (!s || clip.width <= 0 || clip.height <= 0) {
      // No surface, or the surface is scrolled entirely out of view → fill the whole view empty.
      ctx.fillRect(0, 0, V.x, V.y, ' ', cEmpty);
      return;
    }
    // Blank the empty bands around the surface.
    for (const m of marginRects(clip, V)) ctx.fillRect(m.x, m.y, m.width, m.height, ' ', cEmpty);
    // Copy the visible surface cells into the clip region. A negative delta insets the surface into
    // the view (the source starts at cell 0), so clamp the source origin to 0.
    const srcX0 = Math.max(d.x, 0);
    const srcY0 = Math.max(d.y, 0);
    const buf = s.buffer;
    for (let vy = clip.y; vy < clip.y + clip.height; vy += 1) {
      for (let vx = clip.x; vx < clip.x + clip.width; vx += 1) {
        const cell = buf.get(srcX0 + (vx - clip.x), srcY0 + (vy - clip.y));
        if (!cell || cell.width === 0) continue; // skip a wide glyph's continuation — its lead drew it
        ctx.text(vx, vy, cell.char, { fg: cell.fg, bg: cell.bg, attrs: cell.attrs });
      }
    }
  }
}
