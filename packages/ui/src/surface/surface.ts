/**
 * `surface.ts` — the `Surface`, an offscreen cell buffer for RD-19, a faithful port of Turbo Vision's
 * `TDrawSurface` (`include/tvision/surface.h`, `source/tvision/tsurface.cpp:20-75`) that **wraps**
 * `@jsvision/core`'s `ScreenBuffer` (PA-10 composition — `ScreenBuffer.width`/`height` are `readonly`
 * and it has no `resize`, so `Surface` holds one and swaps it) rather than a bare `TScreenCell` array.
 *
 * ## TV decode (GATE-1 — `TDrawSurface`)
 *   • **`resize(aSize)`** (`tsurface.cpp:40-70`) reallocates and `memset 0`s the **entire** buffer
 *     (`:60`, "Initialize the buffer, like TGroup does") — it preserves **nothing**. jsvision's
 *     `resize` instead allocates a fresh `ScreenBuffer` and **copies the overlapping region** (AC-1):
 *     a deliberate, documented **extension** (PA-2). `resize` is buffer management, not
 *     `TSurfaceView::draw` geometry, so the extension is in-scope for the fidelity directive.
 *   • **`grow(aDelta)`** (`surface.h:39-42`) = `resize(size + aDelta)` — replicated verbatim.
 *   • **`clear()`** (`tsurface.cpp:72-75`) `memset 0`s (char 0 + attr 0). jsvision blanks to a visible
 *     **space** in the default/supplied style (PA-8) — a space is the on-screen equivalent of TV's nul.
 *   • **`at(y,x)`** (`surface.h:44-52`) is an **unchecked** raw-cell reference ("Warning: no bounds
 *     checking"). jsvision's `at(x,y)` (house x,y order) is **bounds-checked** (OOB → `undefined`) AND
 *     **read-only** (returns a frozen copy, never the live `ScreenBuffer.get` handle) so no caller can
 *     mutate a cell around the sanitize boundary (PA-1 / AC-13 / AC-14). All single-cell writes go
 *     through {@link Surface.set} → `ScreenBuffer.set`, which sanitizes C0/DEL → space + bounds-checks.
 *
 * SECURITY (AC-14): every write path — `set`, the `getDrawContext` facade (`text`/`fillRect`/`box`),
 * `from`, `clear` — routes through `ScreenBuffer.set`/`text`/`fillRect`, which sanitize at write time,
 * so no surface cell can hold an unsanitized control byte. `at` is read-only. ⇒ the faithful raw-cell
 * blit in `surface-view.ts` is safe by construction.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { ScreenBuffer, resolveCapabilities, defaultTheme, charWidth } from '@jsvision/core';
import type { Cell, Style, Theme, CapabilityProfile } from '@jsvision/core';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { makeDrawContext } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import type { Point } from '../view/geometry.js';

/** The paint-facade caps default (PA-4) — the conservative 16-colour, ASCII-safe profile. */
const DEFAULT_CAPS: CapabilityProfile = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** The default cell fill / clear style (a space in terminal-default colours). */
const DEFAULT_FILL: Style = { fg: 'default', bg: 'default' };

/** Options for a {@link Surface}. (03-01) */
export interface SurfaceOptions {
  /** Buffer size `{x: width, y: height}` (clamped ≥ 1 per `ScreenBuffer`). */
  size: Point;
  /** Paint-facade default theme (PA-4); defaults to core `defaultTheme`. */
  theme?: Theme;
  /** Paint-facade default capabilities (PA-4); defaults to a conservative ASCII-safe profile. */
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
 * An offscreen, freely-writable cell buffer (a `TDrawSurface`). Draw into it via the {@link
 * Surface.getDrawContext} paint facade (the primary API) or the raw {@link Surface.buffer}; a bound
 * {@link SurfaceView} displays a `delta`-offset window onto it. A private `version` signal bumps on
 * every mutation so a bound view repaints (PA-5). See the module doc for the TV decode + security.
 */
export class Surface {
  /** The wrapped core buffer — swapped on `resize` (PA-10). */
  private buf: ScreenBuffer;
  /** Current size `{x,y}`; mirrors `buf.width`/`buf.height`. */
  size: Point;

  private readonly theme: Theme;
  private readonly caps: CapabilityProfile;
  private readonly fill: Style & { char?: string };

  /** Reactive content-version counter (PA-5). `_v` is the plain mirror so a bump never self-subscribes. */
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
   * Build a `Surface` from an array of text rows (the pannable-canvas constructor, Should-Have PA-9).
   * Sizes to `max(displayWidth(row)) × rows.length` (display-width aware; ≥ 1×1) and writes each row
   * via the sanitizing `ScreenBuffer.text`, so no control byte becomes a cell (AC-14).
   *
   * @param rows The text rows (top to bottom).
   * @param opts Optional `theme`/`caps`/`fill` (size is derived from `rows`).
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

  /** The raw wrapped buffer — the escape hatch (AR-227); poke it directly, then call {@link invalidate}. */
  get buffer(): ScreenBuffer {
    return this.buf;
  }

  // ── Faithful TDrawSurface API (decode + AC-1 overlap extension) ──────────────────────────────────

  /**
   * Resize to `size`, **preserving the overlapping region** `[0, min(oldW,newW)) × [0, min(oldH,newH))`
   * and blanking the newly-exposed region (AC-1). Allocates a fresh `ScreenBuffer` and blits the overlap
   * cell-by-cell (wide leads re-emitted via `set`, which recreates their continuation; `width:0`
   * continuations are skipped — their lead redraws them), then swaps the internal buffer and bumps the
   * version. A non-positive dimension clamps to 1 (never an unusable buffer).
   *
   * **Deviation from TV** (PA-2): `TDrawSurface::resize` `memset 0`s the whole buffer (`tsurface.cpp:60`)
   * — it preserves nothing; jsvision preserves the overlap. Documented, in-scope extension.
   */
  resize(size: Point): void {
    const next = new ScreenBuffer(size.x, size.y, this.fill);
    const minW = Math.min(this.buf.width, next.width);
    const minH = Math.min(this.buf.height, next.height);
    for (let y = 0; y < minH; y += 1) {
      for (let x = 0; x < minW; x += 1) {
        const c = this.buf.get(x, y);
        if (!c || c.width === 0) continue; // skip continuations — the lead's set() re-emits them
        next.set(x, y, c.char, { fg: c.fg, bg: c.bg, attrs: c.attrs });
      }
    }
    this.buf = next;
    this.size = { x: next.width, y: next.height };
    this.bump();
  }

  /** Grow (or shrink) by a per-axis delta — `resize(size + delta)` (`surface.h:39-42`). */
  grow(delta: Point): void {
    this.resize({ x: this.size.x + delta.x, y: this.size.y + delta.y });
  }

  /** Blank every cell to a space in `style` (default terminal colours), PA-8. Bumps the version. */
  clear(style: Style = DEFAULT_FILL): void {
    this.buf.fillRect(0, 0, this.size.x, this.size.y, ' ', style);
    this.bump();
  }

  // ── Cell access (PA-1 read / write split) ────────────────────────────────────────────────────────

  /**
   * Read the cell at `(x, y)` as a **read-only** frozen copy, or `undefined` when out of bounds. Never
   * returns the live `ScreenBuffer.get` handle, so a caller cannot mutate a cell around the sanitize
   * boundary (PA-1 / AC-14). Writes go through {@link Surface.set} or the paint facade.
   */
  at(x: number, y: number): Readonly<Cell> | undefined {
    const c = this.buf.get(x, y);
    if (!c) return undefined;
    return Object.freeze({ char: c.char, fg: c.fg, bg: c.bg, attrs: c.attrs, width: c.width });
  }

  /**
   * Write one glyph at `(x, y)` in `style` — the single-cell write path. Delegates to `ScreenBuffer.set`
   * (bounds-checked no-op when OOB; **sanitizes** C0/DEL → space) and bumps the version (AC-6/AC-14).
   */
  set(x: number, y: number, char: string, style: Style): void {
    this.buf.set(x, y, char, style);
    this.bump();
  }

  // ── Paint facade (AR-227, PA-4) ───────────────────────────────────────────────────────────────────

  /**
   * A `DrawContext` over the whole surface — the primary authoring API (same facade `View.draw` uses).
   * Its writers route through `ScreenBuffer` (sanitize + width-correct) and **bump the version** so a
   * bound {@link SurfaceView} repaints on facade paints too (AC-6). `theme`/`caps` default to the
   * construction values and may be overridden per call (PA-4).
   *
   * @param overrides Optional per-call `theme`/`caps`.
   */
  getDrawContext(overrides?: { theme?: Theme; caps?: CapabilityProfile }): DrawContext {
    const rect = { x: 0, y: 0, width: this.size.x, height: this.size.y };
    const inner = makeDrawContext(this.buf, rect, rect, overrides?.theme ?? this.theme, overrides?.caps ?? this.caps);
    const bump = (): void => this.bump();
    // Wrap the mutating writers so any facade paint bumps the version (AC-6); reads pass straight through.
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

  // ── Reactivity (PA-5) ─────────────────────────────────────────────────────────────────────────────

  /** Reactive content-version read — `SurfaceView.draw` tracks it so a mutation schedules a repaint. */
  version(): number {
    return this._version();
  }

  /** Manually bump the version — for callers that poke {@link Surface.buffer} directly (AC-6). */
  invalidate(): void {
    this.bump();
  }

  /** A deep, independent copy of the current buffer (Should-Have snapshot, PA-9) — `ScreenBuffer.clone`. */
  snapshot(): ScreenBuffer {
    return this.buf.clone();
  }

  /** Increment the version signal (via the plain mirror `_v`, so a bump never self-subscribes). */
  private bump(): void {
    this._v += 1;
    this._version.set(this._v);
  }
}
