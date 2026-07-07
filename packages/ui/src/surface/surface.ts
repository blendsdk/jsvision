/**
 * {@link Surface} — an offscreen cell buffer you draw into once and then display through a
 * {@link SurfaceView} viewport. Useful for content larger than its on-screen window (a scrollable
 * canvas, a diagram, a zoomable map).
 *
 * Notable behaviours:
 * - **`resize` preserves content** — it keeps the overlapping region and blanks the newly-exposed
 *   area, rather than clearing the whole buffer.
 * - **`clear` blanks to spaces** in the default (or a supplied) style.
 * - **`at(x, y)` is bounds-checked and read-only** — out-of-range reads return `undefined`, and the
 *   returned cell is a frozen copy that cannot be mutated. All writes go through {@link Surface.set}
 *   or the {@link Surface.getDrawContext} paint facade.
 *
 * Every write path sanitizes control bytes at write time, so a surface cell can never hold a raw
 * control byte. A private version counter bumps on every mutation, so a bound {@link SurfaceView}
 * repaints automatically when the surface changes.
 */
import { ScreenBuffer, resolveCapabilities, defaultTheme, charWidth } from '@jsvision/core';
import type { Cell, Style, Theme, CapabilityProfile } from '@jsvision/core';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { makeDrawContext } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import type { Point } from '../view/geometry.js';

/** The paint-facade default capabilities — a conservative 16-colour, ASCII-safe profile. */
const DEFAULT_CAPS: CapabilityProfile = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** The default cell fill / clear style (a space in terminal-default colours). */
const DEFAULT_FILL: Style = { fg: 'default', bg: 'default' };

/** Options for a {@link Surface}. */
export interface SurfaceOptions {
  /** Buffer size `{x: width, y: height}` (clamped to at least 1×1). */
  size: Point;
  /** Default theme for the paint facade; defaults to the built-in theme. */
  theme?: Theme;
  /** Default capabilities for the paint facade; defaults to a conservative ASCII-safe profile. */
  caps?: CapabilityProfile;
  /** Initial cell fill; defaults to a space in terminal-default colours. */
  fill?: Style & { char?: string };
}

/** Sum of the display widths of a string's code points (wide glyphs count 2). */
function displayWidth(str: string): number {
  let total = 0;
  for (const glyph of str) total += charWidth(glyph.codePointAt(0) ?? 0x20, 'wcwidth');
  return total;
}

/**
 * An offscreen, freely-writable cell buffer. Draw into it via the {@link Surface.getDrawContext}
 * paint facade (the primary API) or the raw {@link Surface.buffer}; a bound {@link SurfaceView}
 * displays a scrollable window onto it. Every mutation bumps a version counter so a bound view
 * repaints automatically.
 *
 * @example
 * import { Surface, SurfaceView, signal } from '@jsvision/ui';
 *
 * // A canvas larger than the viewport that will display it.
 * const surface = new Surface({ size: { x: 96, y: 36 } });
 * const ctx = surface.getDrawContext();
 * ctx.text(2, 1, 'Hello from the offscreen canvas', { fg: 'brightCyan', bg: 'default' });
 *
 * // Show a scrollable window onto it; write `delta` to pan.
 * const delta = signal({ x: 0, y: 0 });
 * const view = new SurfaceView({ surface, delta });
 * view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 12 } };
 *
 * // Or build one straight from text rows:
 * const banner = Surface.from(['+--------+', '| hello  |', '+--------+']);
 */
export class Surface {
  /** The wrapped core buffer — swapped out for a new one on `resize`. */
  private buf: ScreenBuffer;
  /** Current size `{x,y}`; mirrors `buf.width`/`buf.height`. */
  size: Point;

  private readonly theme: Theme;
  private readonly caps: CapabilityProfile;
  private readonly fill: Style & { char?: string };

  // Reactive content-version counter. `_v` is a plain mirror of the signal's value so that bumping
  // it (a write) never accidentally reads — and thus subscribes to — the signal.
  private readonly _version: Signal<number> = signal(0);
  private _v = 0;

  /**
   * @param opts The `size` (clamped ≥ 1) + optional paint-facade `theme`/`caps` defaults + initial `fill`.
   */
  constructor(opts: SurfaceOptions) {
    this.fill = opts.fill ?? DEFAULT_FILL;
    this.buf = new ScreenBuffer(opts.size.x, opts.size.y, this.fill);
    this.size = { x: this.buf.width, y: this.buf.height };
    this.theme = opts.theme ?? defaultTheme;
    this.caps = opts.caps ?? DEFAULT_CAPS;
  }

  /**
   * Build a `Surface` from an array of text rows. Sizes to `max(displayWidth(row)) × rows.length`
   * (wide glyphs count as 2; at least 1×1) and writes each row through the sanitizing text writer, so
   * no control byte becomes a cell.
   *
   * @param rows The text rows (top to bottom).
   * @param opts Optional `theme`/`caps`/`fill` (size is derived from `rows`).
   * @returns A surface sized to fit the rows, with each row written at the left edge.
   */
  static from(rows: readonly string[], opts?: Omit<SurfaceOptions, 'size'>): Surface {
    let width = 0;
    for (const row of rows) width = Math.max(width, displayWidth(row));
    const height = rows.length;
    const s = new Surface({ size: { x: Math.max(1, width), y: Math.max(1, height) }, ...opts });
    for (let y = 0; y < rows.length; y += 1) s.buf.text(0, y, rows[y], DEFAULT_FILL);
    s.bump();
    return s;
  }

  /** The raw wrapped buffer — an escape hatch; poke it directly, then call {@link invalidate}. */
  get buffer(): ScreenBuffer {
    return this.buf;
  }

  /**
   * Resize to `size`, **preserving the overlapping region** and blanking the newly-exposed area.
   * Allocates a fresh buffer and copies the overlap cell-by-cell (wide glyphs are re-emitted so their
   * continuation cell is recreated), then swaps in the new buffer and bumps the version. A non-positive
   * dimension clamps to 1, so the buffer is never unusable.
   */
  resize(size: Point): void {
    const next = new ScreenBuffer(size.x, size.y, this.fill);
    const minW = Math.min(this.buf.width, next.width);
    const minH = Math.min(this.buf.height, next.height);
    for (let y = 0; y < minH; y += 1) {
      for (let x = 0; x < minW; x += 1) {
        const c = this.buf.get(x, y);
        // Skip a wide glyph's trailing continuation cell — re-emitting the lead recreates it.
        if (!c || c.width === 0) continue;
        next.set(x, y, c.char, { fg: c.fg, bg: c.bg, attrs: c.attrs });
      }
    }
    this.buf = next;
    this.size = { x: next.width, y: next.height };
    this.bump();
  }

  /** Grow (or shrink) by a per-axis delta — equivalent to `resize(size + delta)`. */
  grow(delta: Point): void {
    this.resize({ x: this.size.x + delta.x, y: this.size.y + delta.y });
  }

  /** Blank every cell to a space in `style` (default terminal colours). Bumps the version. */
  clear(style: Style = DEFAULT_FILL): void {
    this.buf.fillRect(0, 0, this.size.x, this.size.y, ' ', style);
    this.bump();
  }

  /**
   * Read the cell at `(x, y)` as a **read-only** frozen copy, or `undefined` when out of bounds. The
   * returned cell is a copy, not a live handle, so it cannot be mutated. Writes go through
   * {@link Surface.set} or the paint facade.
   */
  at(x: number, y: number): Readonly<Cell> | undefined {
    const c = this.buf.get(x, y);
    if (!c) return undefined;
    return Object.freeze({ char: c.char, fg: c.fg, bg: c.bg, attrs: c.attrs, width: c.width });
  }

  /**
   * Write one glyph at `(x, y)` in `style` — the single-cell write path. Out-of-bounds writes are a
   * no-op, and control bytes are sanitized to a space. Bumps the version.
   */
  set(x: number, y: number, char: string, style: Style): void {
    this.buf.set(x, y, char, style);
    this.bump();
  }

  /**
   * A `DrawContext` covering the whole surface — the primary way to author content (the same paint
   * facade a `View.draw` receives). Its writers sanitize input, stay width-correct, and bump the
   * version so a bound {@link SurfaceView} repaints. `theme`/`caps` default to the construction values
   * and may be overridden per call.
   *
   * @param overrides Optional per-call `theme`/`caps`.
   * @returns A draw context whose mutating writers also bump the surface's version.
   */
  getDrawContext(overrides?: { theme?: Theme; caps?: CapabilityProfile }): DrawContext {
    const rect = { x: 0, y: 0, width: this.size.x, height: this.size.y };
    const inner = makeDrawContext(this.buf, rect, rect, overrides?.theme ?? this.theme, overrides?.caps ?? this.caps);
    const bump = (): void => this.bump();
    // Wrap the mutating writers so any facade paint bumps the version; reads pass straight through.
    return {
      ...inner,
      text: (x, y, str, style) => {
        inner.text(x, y, str, style);
        bump();
      },
      fillRect: (x, y, w, h, char, style) => {
        inner.fillRect(x, y, w, h, char, style);
        bump();
      },
      fill: (char, style) => {
        inner.fill(char, style);
        bump();
      },
      box: (x, y, w, h, style, title) => {
        inner.box(x, y, w, h, style, title);
        bump();
      },
      shadow: (x, y, w, h, style) => {
        inner.shadow(x, y, w, h, style);
        bump();
      },
    };
  }

  /**
   * Reactive content-version read. A bound {@link SurfaceView} tracks this in its draw, so reading it
   * subscribes the caller to future mutations — every surface change then schedules a repaint.
   */
  version(): number {
    return this._version();
  }

  /** Manually bump the version — for callers that poke {@link Surface.buffer} directly. */
  invalidate(): void {
    this.bump();
  }

  /** A deep, independent copy of the current buffer. */
  snapshot(): ScreenBuffer {
    return this.buf.clone();
  }

  /** Increment the version signal (via the plain mirror `_v`, so a bump never self-subscribes). */
  private bump(): void {
    this._v += 1;
    this._version.set(this._v);
  }
}
