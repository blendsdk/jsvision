/**
 * `surface-view.ts` — the `SurfaceView`, a **passive** `View` that displays a `delta`-offset viewport
 * onto a bound {@link Surface}. Its draw geometry is a **faithful decode** of Turbo Vision's
 * `TSurfaceView::draw()` (`source/tvision/tsurface.cpp:93-141`); the pure clip/margin math lives in
 * `surface-geometry.ts`. Reactive binding (RD-01) + a two-way `delta` signal are the jsvision
 * extensions TV couldn't have.
 *
 * ## TV decode (GATE-1 — `TSurfaceView::draw()`, `tsurface.cpp:93-141`; palette `surface.h:56-71`)
 *   • **Degenerate view** (`:95`): `if (size.x <= 0 || size.y <= 0) return;` → draw nothing.
 *   • **Empty-area colour** (`:98`): `cEmpty = mapColor(1)` = palette entry 1 = "TWindow's and TDialog's
 *     frame passive colour" (`surface.h:71`) → jsvision **`windowInactive`** (`theme.ts:335`, `0x17`
 *     lightGray-on-blue). No new theme role (AC-10).
 *   • **Clip rect** (`:105-107`): `TRect(0,0,surface->size).move(-delta).intersect(TRect(0,0,size))`
 *     → {@link computeClip}. **Non-empty guard** (`:108-109`): `0 <= clip.a.x < clip.b.x && …y`.
 *   • **First visible cell** (`:111`): `&surface->at(max(delta.y,0), max(delta.x,0))` — negative delta
 *     clamped to 0 (the surface is inset into the view, not scrolled).
 *   • **Direct copy** (`:112-115`): when `clip == extent` (surface fills the view) copy each row
 *     straight — no margins.
 *   • **Margin bands** (`:118-132`): else fill the top rows `[0, clip.a.y)` + bottom rows `[clip.b.y,
 *     size.y)` full width with `cEmpty` spaces, then per surface row the left `[0, clip.a.x)` + right
 *     `[clip.b.x, size.x)` side bands → {@link marginRects}.
 *   • **Null surface** (`:136-140`): fill the whole view with `cEmpty` spaces.
 *
 * **Deviation (PA-3):** TV's non-empty guard (`:108-109`) leaves a surface scrolled **fully outside**
 * the viewport (empty clip) **undrawn** (stale cells). jsvision maps an empty clip to the null-surface
 * case → fills the whole view with `cEmpty` spaces (AC-9). A safe, deterministic extension.
 *
 * ## GATE-2 AFTER-diff — recorded in Phase 4 (`surface-view.impl` + this JSDoc), see the execution plan.
 *
 * SECURITY (AC-13/AC-14): `computeClip`/`marginRects` are integer + bounds-clamped; the blit indexes
 * only `[srcX0, srcX0+clipW) × [srcY0, srcY0+clipH)`, which `computeClip` guarantees ⊆ surface. Surface
 * cells are already sanitize-clean (`Surface` write paths) and `ctx.text` re-sanitizes, so no raw
 * control byte reaches the buffer.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type { Point } from '../view/geometry.js';
import { Surface } from './surface.js';
import { computeClip, marginRects, clampDelta } from './surface-geometry.js';

/** A static surface, `null`, or a reactive accessor of either (PA-6). */
export type SurfaceSource = Surface | null | (() => Surface | null);

/** Options for a {@link SurfaceView}. (03-02, PA-6) */
export interface SurfaceViewOptions {
  /** The bound surface (static, `null`, or a reactive accessor — swap-aware). */
  surface: SurfaceSource;
  /** Two-way scroll offset `{x,y}`; defaults to `signal({x:0,y:0})`. The caller drives it (e.g. a `ScrollBar`). */
  delta?: Signal<Point>;
  /** Fired when `delta` changes (Should-Have, PA-9). */
  onScroll?: (delta: Point) => void;
}

/**
 * A passive `delta`-viewport onto a {@link Surface}. Not focusable and handles **no** input (TV
 * `TSurfaceView` is passive) — scroll it by writing `delta` (e.g. bind a `ScrollBar.value` to it). The
 * draw is the `tsurface.cpp` decode; see the module doc. Reactive: a pan, a surface swap, or a surface
 * content bump each schedule one coalesced repaint (AC-5/AC-6).
 */
export class SurfaceView extends View {
  /** TV `TSurfaceView` takes no input — the view is passive (AC-8). */
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
      // Repaint on a pan (delta), a surface swap (readSurface), or a content mutation (version) — draw()
      // is NOT auto-tracked (render-root.ts:137), so the view must bind to repaint (AC-5/AC-6).
      this.bind(() => {
        this.delta();
        const s = this.readSurface();
        if (s) s.version();
      });
      // onScroll — change-only (skips the initial run + same-coordinate no-op sets), PA-9.
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

  // ── Should-Have scroll helpers (PA-9) ────────────────────────────────────────────────────────────

  /**
   * Scroll so `target` becomes the top-left of the viewport, **clamped** to `[0, max(0, surface−view)]`
   * per axis (via `clampDelta`). Raw `delta.set` stays available for the unclamped (TV-faithful) case.
   *
   * @param target The desired scroll offset `{x,y}`.
   */
  scrollTo(target: Point): void {
    const s = this.readSurface();
    const view = { x: this.bounds.width, y: this.bounds.height };
    const next = s ? clampDelta(target, s.size, view) : { x: Math.max(0, target.x), y: Math.max(0, target.y) };
    this.delta.set(next);
  }

  /** Pan by `(dx, dy)` from the current offset, clamped (Should-Have, PA-9). */
  panBy(dx: number, dy: number): void {
    const d = this.delta();
    this.scrollTo({ x: d.x + dx, y: d.y + dy });
  }

  // ── Draw (the tsurface.cpp:93-141 decode) ────────────────────────────────────────────────────────

  /** Paint the `delta`-offset surface window + the empty-area margins (`windowInactive` spaces). */
  draw(ctx: DrawContext): void {
    const V = { x: ctx.size.width, y: ctx.size.height };
    if (V.x <= 0 || V.y <= 0) return; // degenerate view (:95)
    const cEmpty = ctx.color('windowInactive'); // mapColor(1) (:98, AC-4/AC-10)
    const s = this.readSurface();
    const d = this.delta();
    const clip = s ? computeClip(s.size, d, V) : { x: 0, y: 0, width: 0, height: 0 };
    if (!s || clip.width <= 0 || clip.height <= 0) {
      // null surface (:136-140) OR fully-outside (PA-3, the :108-109 guard failing) → whole view empty.
      ctx.fillRect(0, 0, V.x, V.y, ' ', cEmpty);
      return;
    }
    // Empty-area margins (:120-132) — spaces in cEmpty.
    for (const m of marginRects(clip, V)) ctx.fillRect(m.x, m.y, m.width, m.height, ' ', cEmpty);
    // Blit the surface cells inside clip → view-local (clip.x, clip.y) (:114 / :123-132).
    const srcX0 = Math.max(d.x, 0); // (:111)
    const srcY0 = Math.max(d.y, 0);
    const buf = s.buffer;
    for (let vy = clip.y; vy < clip.y + clip.height; vy += 1) {
      for (let vx = clip.x; vx < clip.x + clip.width; vx += 1) {
        const cell = buf.get(srcX0 + (vx - clip.x), srcY0 + (vy - clip.y));
        if (!cell || cell.width === 0) continue; // skip wide continuation — its lead drew it (PA-11)
        ctx.text(vx, vy, cell.char, { fg: cell.fg, bg: cell.bg, attrs: cell.attrs });
      }
    }
  }
}
