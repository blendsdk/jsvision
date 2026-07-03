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
 * - **Fill math (round-first, PA-4)** — `e = fillEighths(v,width)`, `full = floor(e/8)`, `part = e%8`:
 *   `full` full blocks, then one `PARTIAL[part]` when `part ∈ 1..7`, then the `░` track. `fillEighths`
 *   is `round(v·width·8)` in the mid-range but **snaps the 0%/100% boundaries** so the fill agrees
 *   with the rounded percent — a value that rounds to 100% fills the last cell completely (fixes a
 *   bar that reads "100%" yet shows a `▉` partial), and one that rounds to 0% is completely empty.
 * - **ASCII fallback (PA-2)** — when `asciiOnly(caps)` the bar draws whole cells only: `#` fill / `-`
 *   track (distinct). Selected at draw time from `ctx.caps` — NOT the serialize-time `fallbackGlyph`
 *   map (which lacks 6 of the 7 partials and collapses `█`/`░` to a single `#`; preflight PF-001).
 * - **Colours (PA-3)** — `progressFill` (`0x1B` brightCyan-on-blue) for `█`/partials/`#`;
 *   `progressTrack` (`0x13` cyan-on-blue = `scrollBarPage`) for `░`/`-`. Documented extension colours.
 *
 * **Caption — knockout percent (PA-12, supersedes the AC-4 staticText draft).** The optional centred
 * `NN%` reads *on* the bar, not in a contrasting box: each digit cell's background matches what it
 * sits on — the fill colour where the fill has swept over it, the track's background where it hasn't
 * — and the digit's foreground inverts for contrast. This kills the "two input fields split by a
 * number" artifact the grey `staticText` box produced. Reuses only `progressFill`/`progressTrack`.
 *
 * **Label — positioned text around the bar (PA-13, RD-18 extension).** An optional `label` (literal
 * or accessor, the `Text` idiom) placed by `labelPosition`: `left`/`right` reserve columns beside the
 * bar on the same row (the bar shrinks); `top`/`top-left` reserve row 0 above the bar (two rows;
 * `top` centred, `top-left` flush-left). Drawn in `staticText` (dialog text). The `measure()` seam
 * advertises height 2 for a top label so an `auto`-sized bar claims the second row. Caption + label
 * compose freely. No TV counterpart — a modern convenience, cited as an extension (AR-186).
 *
 * **GATE-1 AFTER-diff (verified):** the composed bar matches this decode cell-by-cell — ST-2 asserts
 * `full`×`█` + `PARTIAL[6]=▊` (U+258A) + `░` at `(v=0.28,w=10)` plus the `progressFill`/`progressTrack`
 * styles pre-serialize; ST-3 asserts the distinct `#`/`-` ASCII branch; ST-4 pins the knockout caption.
 *
 * Leaf `View` (no children, no `onEvent`), caller-owned `value` signal (the `Input`/`RadioGroup`
 * idiom); `value` is clamped on every read (NaN/±∞/OOB → 0/1) so `full ∈ 0..width` and `part ∈ 0..7`
 * never overflow or index out of range (AC-5/AC-14). The `.js` extension in import specifiers is
 * required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import type { Signal } from '../reactive/index.js';
import type { Size2D } from '../layout/index.js';
import type { CapabilityProfile, Style } from '@jsvision/core';
import { stringWidth } from '../controls/measure.js';

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
 * Fill amount in **eighths** for a `w`-cell bar. The mid-range is the round-first `round(v·w·8)`
 * (PA-4), but the **0%/100% boundaries are snapped** so the visual fill agrees with the rounded
 * percent: a value that rounds to 100% fills completely — no lingering partial in the last cell
 * (the user-reported bug: a bar driven by a real fraction reads "100%" while the final cell is a
 * `▉`) — and one that rounds to 0% is completely empty. `v` is clamped first. Exported for impl tests.
 *
 * @param v Progress (clamped to `[0,1]`).
 * @param w Bar width in cells.
 * @returns Filled eighths in `0..w*8` (`w*8` = full, `0` = empty).
 */
export function fillEighths(v: number, w: number): number {
  const c = clamp01(v);
  const pct = Math.round(c * 100);
  if (pct <= 0) return 0; // reads 0% ⇒ completely empty (no leading sliver)
  if (pct >= 100) return w * 8; // reads 100% ⇒ completely full (last cell not a partial)
  return Math.round(c * w * 8); // round-first sub-cell fill (PA-4)
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

/** Where an optional {@link ProgressBarOptions.label} sits relative to the bar. */
export type LabelPosition = 'left' | 'right' | 'top' | 'top-left';

/** Construction options for {@link ProgressBar}. */
export interface ProgressBarOptions {
  /** Reactive progress in `[0,1]` (caller-owned; clamped on read). Writing it repaints. */
  readonly value: Signal<number>;
  /** Show a centred `NN%` knockout caption over the bar (PA-12). Default `false`. */
  readonly caption?: boolean;
  /**
   * Optional text placed around the bar (literal or reactive accessor). Repaints on change. A
   * `left`/`right` label reserves `width(label)+1` columns beside the bar, so a **variable-width**
   * label reflows the bar as its text grows/shrinks (e.g. `9%`→`10%`→`100%` retreats the bar a cell).
   * Pad such a label to a stable width — e.g. `` () => `${pct}%`.padStart(4) `` — to keep the bar fixed.
   */
  readonly label?: string | (() => string);
  /** Where {@link label} sits (PA-13). Default `'left'` — the only position that fits one row. */
  readonly labelPosition?: LabelPosition;
}

/**
 * A determinate progress bar. Non-focusable leaf; paints a proportional fill (smooth sub-cell under
 * Unicode caps, whole-cell `#`/`-` under ASCII caps) with an optional knockout percent caption and an
 * optional positioned label.
 */
export class ProgressBar extends View {
  private readonly value: Signal<number>;
  private readonly caption: boolean;
  private readonly label?: string | (() => string);
  private readonly labelPos: LabelPosition;

  /**
   * @param opts `value` (caller-owned signal in `[0,1]`) + optional `caption`/`label`/`labelPosition`.
   */
  constructor(opts: ProgressBarOptions) {
    super();
    this.value = opts.value;
    this.caption = opts.caption === true;
    this.label = opts.label;
    this.labelPos = opts.labelPosition ?? 'left';
    // Repaint when the bound value OR label accessor changes (the `Text` idiom; canonical site: onMount).
    this.onMount(() =>
      this.bind(() => {
        this.value();
        this.resolveLabel();
      }),
    );
  }

  /** Write the bound signal (Should-Have). Clamped on read, so any number is safe. */
  set(value: number): void {
    this.value.set(value);
  }

  /** `round(clamp(value,0,1)·100)` — the integer percent (Should-Have). */
  get percent(): number {
    return Math.round(clamp01(this.value()) * 100);
  }

  /** Resolve the label to a string (accessor or literal); `''` when no label was given. */
  private resolveLabel(): string {
    if (this.label === undefined) return '';
    return typeof this.label === 'function' ? this.label() : this.label;
  }

  /**
   * Intrinsic-size seam (AR-33): a top label makes the bar two rows; width fills the available track.
   * Only consulted for `auto` sizing — fixed/absolute rects are unaffected.
   */
  override measure(available: Size2D): Size2D {
    const top = this.resolveLabel() !== '' && (this.labelPos === 'top' || this.labelPos === 'top-left');
    return { width: available.width, height: top ? 2 : 1 };
  }

  /**
   * Paint the label (if any) then the bar into the remaining sub-rect, then the optional caption over
   * the bar. `left`/`right` reserve columns beside the bar; `top`/`top-left` reserve row 0 above it
   * (needs `height ≥ 2` — at one row the bar wins). See the class decode for the fill algorithm.
   *
   * @param ctx The clipped, view-local paint context (carries `caps` for the glyph decision).
   */
  override draw(ctx: DrawContext): void {
    const { width, height } = ctx.size;
    if (width <= 0 || height <= 0) return;
    const v = clamp01(this.value());
    const fillStyle = ctx.color('progressFill');
    const trackStyle = ctx.color('progressTrack');
    const text = this.resolveLabel();

    // Carve the view rect into a label region + the bar sub-rect.
    let bx = 0;
    let by = 0;
    let bw = width;
    let bh = height;
    if (text !== '') {
      const lw = stringWidth(text);
      const labelStyle = ctx.color('staticText');
      if (this.labelPos === 'top' || this.labelPos === 'top-left') {
        if (height >= 2) {
          const lx = this.labelPos === 'top' ? Math.max(0, Math.floor((width - lw) / 2)) : 0;
          ctx.text(lx, 0, text, labelStyle); // width-clipped by ctx.text
          by = 1;
          bh = height - 1;
        } // one row only → no room for a top label; the bar takes the row
      } else if (this.labelPos === 'left') {
        ctx.text(0, Math.floor((height - 1) / 2), text, labelStyle);
        const reserve = Math.min(width, lw + 1); // label + a 1-col gap
        bx = reserve;
        bw = width - reserve;
      } else {
        // 'right'
        const reserve = Math.min(width, lw + 1); // a 1-col gap + label
        bw = Math.max(0, width - reserve);
        ctx.text(bw + 1, Math.floor((height - 1) / 2), text, labelStyle);
      }
    }

    if (bw > 0 && bh > 0) {
      this.drawBar(ctx, bx, by, bw, bh, v, fillStyle, trackStyle);
      if (this.caption) this.drawCaption(ctx, v, bx, by, bw, bh, fillStyle, trackStyle);
    }
  }

  /** Paint the proportional fill into the `bw×bh` sub-rect at `(bx,by)`. Smooth or ASCII per caps. */
  private drawBar(
    ctx: DrawContext,
    bx: number,
    by: number,
    bw: number,
    bh: number,
    v: number,
    fillStyle: Style,
    trackStyle: Style,
  ): void {
    if (asciiOnly(ctx.caps)) {
      const filled = Math.round(fillEighths(v, bw) / 8); // whole cells only; 0%/100% snapped (boundary fix)
      for (let y = 0; y < bh; y += 1) {
        ctx.fillRect(bx, by + y, filled, 1, '#', fillStyle);
        ctx.fillRect(bx + filled, by + y, bw - filled, 1, '-', trackStyle);
      }
    } else {
      const e = fillEighths(v, bw); // width in eighths (round-first, PA-4; 0%/100% snapped)
      const full = Math.floor(e / 8);
      const part = e % 8; // 0..7
      for (let y = 0; y < bh; y += 1) {
        ctx.fillRect(bx, by + y, full, 1, FULL, fillStyle);
        let x = full;
        if (part >= 1 && part <= 7) {
          ctx.text(bx + x, by + y, PARTIAL[part] ?? '', fillStyle);
          x += 1;
        }
        if (x < bw) ctx.fillRect(bx + x, by + y, bw - x, 1, TRACK, trackStyle);
      }
    }
  }

  /**
   * Draw a centred `NN%` knockout caption over the bar sub-rect (PA-12). Each digit's background
   * matches what it sits on — the fill colour where the fill has swept over it, the track's background
   * where it hasn't — and the foreground inverts for contrast. Reuses only `progressFill`/
   * `progressTrack`; the fill boundary is computed in whole cells, consistent with the drawn bar.
   */
  private drawCaption(
    ctx: DrawContext,
    v: number,
    bx: number,
    by: number,
    bw: number,
    bh: number,
    fillStyle: Style,
    trackStyle: Style,
  ): void {
    const pct = Math.round(v * 100); // 0..100 (v already clamped)
    const label = `${pct}%`; // ASCII digits + '%' → display width == length
    const start = Math.max(0, Math.floor((bw - label.length) / 2));
    const cy = by + Math.floor(bh / 2);
    // Fill boundary in whole cells, matching the bar drawn for these caps (shared fillEighths → cell).
    const e = fillEighths(v, bw);
    const filledCells = asciiOnly(ctx.caps)
      ? Math.round(e / 8) // whole cells, same as the ASCII bar
      : Math.floor(e / 8) + (e % 8 >= 4 ? 1 : 0); // round the sub-cell edge to a whole cell
    for (let i = 0; i < label.length; i += 1) {
      const cx = start + i;
      if (cx >= bw) break; // width-clip: never overrun the bar
      const over = cx < filledCells; // has the fill swept over this digit?
      const style: Style = over
        ? { fg: fillStyle.bg, bg: fillStyle.fg } // inverse video: dark digit knocked into the bright fill
        : { fg: fillStyle.fg, bg: trackStyle.bg }; // bright digit on the track's own background
      ctx.text(bx + cx, cy, label[i] ?? '', style);
    }
  }
}
