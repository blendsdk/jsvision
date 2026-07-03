/**
 * `ProgressBar` — a determinate progress bar with smooth sub-cell fill (RD-18, AR-187/189).
 *
 * RD-18 has NO Turbo Vision counterpart (GATE-1, AR-186 — a whole-tree search of magiblot/tvision
 * finds no gauge/progress/meter class), so this is a *documented new component* whose pieces are
 * grounded in shipped conventions, pinned here (GATE-1 decode, plans/feedback/03-01 §PA-4/PA-2/PA-3):
 *
 * - **Fill glyphs** — full block `█` = U+2588; eighth-block partials `PARTIAL[1..7]` = U+258F, U+258E,
 *   U+258D, U+258C, U+258B, U+258A, U+2589 (`▏▎▍▌▋▊▉`); track `░` = U+2591. Unicode Block Elements —
 *   the same CP437 shade/block convention TV uses for `TScrollBar` (`▒`/`■`) and the `▄█▀` shadow.
 * - **Fill math (round-first, PA-4)** — `e = round(v·width·8)`, `full = floor(e/8)`, `part = e % 8`:
 *   `full` full blocks, then one `PARTIAL[part]` when `part ∈ 1..7`, then the `░` track.
 * - **ASCII fallback (PA-2)** — when `asciiOnly(caps)` the bar draws whole cells only: `#` fill / `-`
 *   track (distinct). Selected at draw time from `ctx.caps` — NOT the serialize-time `fallbackGlyph`
 *   map (which lacks 6 of the 7 partials and collapses `█`/`░` to a single `#`; preflight PF-001).
 * - **Colours (PA-3)** — `progressFill` (`0x1B` brightCyan-on-blue) for `█`/partials/`#`;
 *   `progressTrack` (`0x13` cyan-on-blue = `scrollBarPage`) for `░`/`-`. Documented extension colours.
 * - **Caption (AC-4)** — an optional centred ` NN% ` overlay in the existing `staticText` role.
 *
 * **GATE-1 AFTER-diff (verified):** the composed buffer matches this decode cell-by-cell — ST-2
 * asserts `full`×`█` + `PARTIAL[6]=▊` (U+258A) + `░` at `(v=0.28,w=10)` plus the `progressFill`/
 * `progressTrack` styles pre-serialize; ST-3 asserts the distinct `#`/`-` ASCII branch. No divergence.
 *
 * Leaf `View` (no children, no `onEvent`), caller-owned `value` signal (the `Input`/`RadioGroup`
 * idiom); `value` is clamped on every read (NaN/±∞/OOB → 0/1) so `full ∈ 0..width` and `part ∈ 0..7`
 * never overflow or index out of range (AC-5/AC-14). The `.js` extension in import specifiers is
 * required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import type { Signal } from '../reactive/index.js';
import type { CapabilityProfile } from '@jsvision/core';

/** Full block (U+2588) — a fully-filled cell. */
const FULL = '█';
/** Light shade (U+2591) — the empty track cell. */
const TRACK = '░';
/**
 * Eighth-block partials indexed by the number of filled eighths, `1..7` = U+258F…U+2589 (`▏▎▍▌▋▊▉`).
 * Index `0` is a `''` sentinel so `PARTIAL[part]` is total over `part ∈ 0..7` and index `0` (no
 * partial) is never dereferenced. Frozen — a shared immutable table.
 */
export const PARTIAL: readonly string[] = Object.freeze(['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']);

/** NaN → 0 (any other number passes through). Exported (module-level) for impl unit tests. */
export function clampNaN(n: number): number {
  return Number.isNaN(n) ? 0 : n;
}

/** Clamp to `[0,1]`, mapping NaN → 0 first (so ±∞/OOB/NaN are all safe). Exported for impl tests. */
export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, clampNaN(n)));
}

/**
 * The unified ASCII-fallback predicate (PA-2), shared with {@link Spinner}. The bar's `█`/`░`/eighth
 * blocks are Unicode Block Elements needing both `unicode.utf8` and `glyphs.halfBlocks`; the spinner's
 * braille/block presets need `utf8`. The conservative union covers both.
 *
 * @param caps The resolved terminal capabilities (from `ctx.caps`).
 * @returns `true` when the widget must fall back to a pure-ASCII glyph form.
 */
export const asciiOnly = (caps: CapabilityProfile): boolean => !caps.unicode.utf8 || !caps.glyphs.halfBlocks;

/** Construction options for {@link ProgressBar}. */
export interface ProgressBarOptions {
  /** Reactive progress in `[0,1]` (caller-owned; clamped on read). Writing it repaints. */
  readonly value: Signal<number>;
  /** Show a centred ` NN% ` caption over the bar. Default `false`. */
  readonly caption?: boolean;
}

/**
 * A determinate progress bar. Non-focusable leaf; paints a proportional fill (smooth sub-cell under
 * Unicode caps, whole-cell `#`/`-` under ASCII caps) with an optional centred percent caption.
 */
export class ProgressBar extends View {
  private readonly value: Signal<number>;
  private readonly caption: boolean;

  /**
   * @param opts `value` (caller-owned signal in `[0,1]`) + optional `caption`.
   */
  constructor(opts: ProgressBarOptions) {
    super();
    this.value = opts.value;
    this.caption = opts.caption === true;
    // Repaint when the bound value changes (the `Text` idiom; canonical site: onMount, PA-2).
    this.onMount(() => this.bind(() => this.value()));
  }

  /** Write the bound signal (Should-Have). Clamped on read, so any number is safe. */
  set(value: number): void {
    this.value.set(value);
  }

  /** `round(clamp(value,0,1)·100)` — the integer percent (Should-Have). */
  get percent(): number {
    return Math.round(clamp01(this.value()) * 100);
  }

  /**
   * Paint the bar across the full view. Under Unicode caps: `full`×`█` + one `PARTIAL[part]` + `░`
   * track (round-first fill). Under ASCII caps: whole-cell `#` fill + `-` track. The same row is
   * repeated for every `y` (a taller bar repeats the row). An optional caption overlays the fill.
   *
   * @param ctx The clipped, view-local paint context (carries `caps` for the glyph decision).
   */
  override draw(ctx: DrawContext): void {
    const { width, height } = ctx.size;
    if (width <= 0 || height <= 0) return;
    const v = clamp01(this.value());
    const fillStyle = ctx.color('progressFill');
    const trackStyle = ctx.color('progressTrack');

    if (asciiOnly(ctx.caps)) {
      const filled = Math.round(v * width); // whole cells only, no partials
      for (let y = 0; y < height; y += 1) {
        ctx.fillRect(0, y, filled, 1, '#', fillStyle);
        ctx.fillRect(filled, y, width - filled, 1, '-', trackStyle);
      }
    } else {
      const e = Math.round(v * width * 8); // width in eighths (round-first, PA-4)
      const full = Math.floor(e / 8);
      const part = e % 8; // 0..7
      for (let y = 0; y < height; y += 1) {
        ctx.fillRect(0, y, full, 1, FULL, fillStyle);
        let x = full;
        if (part >= 1 && part <= 7) {
          ctx.text(x, y, PARTIAL[part] ?? '', fillStyle);
          x += 1;
        }
        if (x < width) ctx.fillRect(x, y, width - x, 1, TRACK, trackStyle);
      }
    }

    if (this.caption) this.drawCaption(ctx, v, width, height);
  }

  /** Draw a centred ` NN% ` label over the bar in `staticText` (AC-4); width-clipped by `ctx.text`. */
  private drawCaption(ctx: DrawContext, v: number, width: number, height: number): void {
    const pct = Math.round(v * 100); // 0..100 (v already clamped)
    const label = ` ${pct}% `;
    const lx = Math.max(0, Math.floor((width - label.length) / 2)); // ASCII label → length == display width
    ctx.text(lx, Math.floor(height / 2), label, ctx.color('staticText'));
  }
}
