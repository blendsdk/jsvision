/**
 * `MatrixRain` — the famous "digital rain" effect from *The Matrix*, as a reactive `@jsvision/ui`
 * view: columns of glowing glyphs streaming down a black field, each stream led by a near-white head
 * and trailing a green gradient that fades to darkness.
 *
 * The view owns a small simulation — one falling "stream" per column, each with its own speed and
 * trail length — plus a grid of the glyph currently shown in every cell. It binds to an external
 * frame counter (see the constructor); every time that counter changes the stream advances one step
 * and the damaged cells repaint, so a single shared timer can drive any number of rain windows at
 * once with no manual redraw.
 *
 * It fills its whole slot, so give it the full window interior (it returns `available` from
 * `measure()`). Novel art — it has no Turbo Vision counterpart, so it follows no fidelity gate.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 *
 * @example
 * import { signal, Window } from '@jsvision/ui';
 * import { MatrixRain } from './matrix-rain.js';
 *
 * const frame = signal(0);
 * const win = new Window('Matrix');
 * win.setLayout({ rect: { x: 1, y: 1, width: 34, height: 13 } });
 * win.add(new MatrixRain(() => frame()));
 * // A timer that does `frame.set(frame.peek() + 1)` each tick animates the rain.
 */
import { View } from '@jsvision/ui';
import type { DrawContext, Size2D } from '@jsvision/ui';
import { Attr } from '@jsvision/core';

/** Build an inclusive array of one-character strings across a Unicode code-point range. */
function codePointRange(start: number, end: number): string[] {
  const out: string[] = [];
  for (let cp = start; cp <= end; cp += 1) out.push(String.fromCodePoint(cp));
  return out;
}

// Half-width katakana (U+FF66–U+FF9D) are the iconic Matrix glyphs and — unlike their full-width
// cousins below U+FF61 — render exactly one cell wide, so they slot cleanly into a 1-cell-per-column
// grid. They are listed twice below so the pool stays katakana-dominant after salting with the Latin
// alphabet and digits.
const KATAKANA = codePointRange(0xff66, 0xff9d);
const DIGITS = '0123456789'.split('');
const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** The Unicode glyph pool used on UTF-8 terminals. */
const GLYPHS: readonly string[] = [...KATAKANA, ...KATAKANA, ...DIGITS, ...LATIN];

/** ASCII-only fallback for terminals that do not report UTF-8. */
const GLYPHS_ASCII: readonly string[] = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*+=<>?/|'.split('');

/** Pure black backdrop. */
const BLACK = '#000000';
/** The near-white leading glyph at the front of every stream. */
const HEAD = '#e6ffe6';

/** An RGB triple with channels in `0–255`. */
type Rgb = readonly [r: number, g: number, b: number];
const TRAIL_BRIGHT: Rgb = [40, 255, 90]; // just behind the head
const TRAIL_DARK: Rgb = [0, 40, 15]; // the dim tail
const RAMP_STEPS = 24;

/** Clamp float RGB channels to a `#rrggbb` hex color. */
function hex(r: number, g: number, b: number): `#${string}` {
  const byte = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

// Precomputed green gradient from bright (just behind the head) to dark (the tail). Precomputing the
// ramp once keeps the hot draw loop allocation-free — every cell just indexes this table.
const RAMP: readonly `#${string}`[] = Array.from({ length: RAMP_STEPS }, (_, i) => {
  const t = i / (RAMP_STEPS - 1);
  return hex(
    TRAIL_BRIGHT[0] + (TRAIL_DARK[0] - TRAIL_BRIGHT[0]) * t,
    TRAIL_BRIGHT[1] + (TRAIL_DARK[1] - TRAIL_BRIGHT[1]) * t,
    TRAIL_BRIGHT[2] + (TRAIL_DARK[2] - TRAIL_BRIGHT[2]) * t,
  );
});

/** Pick a random glyph from a pool. */
function randOf(pool: readonly string[]): string {
  return pool[(Math.random() * pool.length) | 0] ?? ' ';
}

export class MatrixRain extends View {
  private frame = 0;
  private lastStep = -1;

  // Grid dimensions the current state was built for; a mismatch (a resize/zoom) triggers a rebuild.
  private gw = -1;
  private gh = -1;

  // Per-column stream state, indexed by column x.
  private head: number[] = []; // fractional y of the leading glyph (may be negative before it enters)
  private speed: number[] = []; // fall rate in cells per frame
  private trail: number[] = []; // trail length in cells
  // The glyph currently shown at each cell, column-major: glyphs[x][y].
  private glyphs: string[][] = [];

  /**
   * @param readFrame Reactive accessor for a monotonically increasing animation frame counter. The
   * stream advances one step each time it changes, so a single timer can drive many rain views.
   */
  constructor(private readonly readFrame: () => number) {
    super();
    // Bind on mount, not in the constructor: the reactive scope only exists once the view is mounted.
    // draw() reads this.frame, so the bind just records the new value and requests a repaint.
    this.onMount(() => {
      this.bind(
        () => this.readFrame(),
        (f) => {
          this.frame = f;
        },
      );
    });
  }

  /** Claim the whole window interior so the black field covers it edge to edge. */
  override measure(available: Size2D): Size2D {
    return available;
  }

  override draw(ctx: DrawContext): void {
    const { width, height } = ctx.size;
    if (width < 1 || height < 1) return;
    const pool = ctx.caps.unicode.utf8 ? GLYPHS : GLYPHS_ASCII;

    if (width !== this.gw || height !== this.gh) this.rebuild(width, height, pool);

    // Advance exactly once per new frame value: draw() can fire more than once for the same frame
    // (a partial recompose), and we must not step the simulation twice.
    if (this.frame !== this.lastStep) {
      this.step(pool);
      this.lastStep = this.frame;
    }

    ctx.fill(' ', { fg: BLACK, bg: BLACK });
    this.render(ctx);
  }

  /** (Re)allocate all per-column state for a new grid size — called on first draw and every resize. */
  private rebuild(width: number, height: number, pool: readonly string[]): void {
    this.gw = width;
    this.gh = height;
    this.lastStep = -1;
    this.head = new Array<number>(width);
    this.speed = new Array<number>(width);
    this.trail = new Array<number>(width);
    this.glyphs = [];
    for (let x = 0; x < width; x += 1) {
      const col = new Array<string>(height);
      for (let y = 0; y < height; y += 1) col[y] = randOf(pool);
      this.glyphs[x] = col;
      this.spawn(x, height, true);
    }
  }

  /**
   * (Re)seed one column's stream with a fresh speed and trail.
   *
   * @param initial On the first fill each stream starts anywhere above the screen so the columns are
   * desynchronized from the very first frame; on a respawn it starts just above the top so a new
   * stream flows straight back in.
   */
  private spawn(x: number, height: number, initial: boolean): void {
    this.head[x] = initial ? -Math.floor(Math.random() * height) : -Math.floor(Math.random() * 6);
    this.speed[x] = 0.25 + Math.random() * 0.75;
    this.trail[x] = 4 + ((Math.random() * 14) | 0);
  }

  /** Advance every stream one step: fall, drop fresh glyphs into newly entered rows, respawn, shimmer. */
  private step(pool: readonly string[]): void {
    const h = this.gh;
    for (let x = 0; x < this.gw; x += 1) {
      const prev = Math.floor(this.head[x] ?? 0);
      this.head[x] = (this.head[x] ?? 0) + (this.speed[x] ?? 0.5);
      const now = Math.floor(this.head[x] ?? 0);
      // Each row the head newly crosses gets a fresh glyph — that is what makes the leading edge churn.
      const col = this.glyphs[x];
      if (col) for (let y = prev + 1; y <= now; y += 1) if (y >= 0 && y < h) col[y] = randOf(pool);
      // Once the whole streak (head plus its trail) has fallen off the bottom, send it round again.
      if ((this.head[x] ?? 0) - (this.trail[x] ?? 0) > h) this.spawn(x, h, false);
    }
    // Shimmer: mutate a handful of random cells each frame so the standing glyphs flicker like the film.
    const mutations = Math.max(1, ((this.gw * this.gh) / 200) | 0);
    for (let i = 0; i < mutations; i += 1) {
      const x = (Math.random() * this.gw) | 0;
      const y = (Math.random() * this.gh) | 0;
      const col = this.glyphs[x];
      if (col) col[y] = randOf(pool);
    }
  }

  /** Paint each stream: a bright head, then a green trail fading up toward the tail. */
  private render(ctx: DrawContext): void {
    for (let x = 0; x < this.gw; x += 1) {
      const col = this.glyphs[x];
      if (!col) continue;
      const headY = Math.floor(this.head[x] ?? 0);
      const len = this.trail[x] ?? 1;
      for (let k = 0; k <= len; k += 1) {
        const y = headY - k;
        if (y < 0 || y >= this.gh) continue;
        const ch = col[y] ?? ' ';
        if (k === 0) {
          ctx.text(x, y, ch, { fg: HEAD, bg: BLACK, attrs: Attr.bold });
        } else {
          const idx = Math.min(RAMP.length - 1, ((k / len) * (RAMP.length - 1)) | 0);
          ctx.text(x, y, ch, { fg: RAMP[idx], bg: BLACK });
        }
      }
    }
  }
}
