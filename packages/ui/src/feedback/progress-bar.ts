/**
 * A determinate progress bar with smooth sub-cell fill.
 *
 * Rendering:
 * - **Smooth fill (Unicode caps)** — a proportional run of full blocks `█` followed by a single
 *   eighth-block partial (`▏▎▍▌▋▊▉`) over a light `░` track, so the bar advances a fraction of a cell
 *   at a time rather than jumping a whole cell. The 0% and 100% boundaries are snapped so the fill
 *   always agrees with the rounded percent — at 100% the last cell fills completely (no lingering
 *   partial), at 0% the bar is completely empty.
 * - **ASCII fallback** — on a terminal without the needed block glyphs the bar draws whole cells only:
 *   `#` for fill, `-` for track. The decision is made at draw time from the live terminal caps.
 *
 * Optional extras:
 * - **caption** — a centred `NN%` percent that reads *on* the bar (knockout style): each digit's
 *   background matches whatever it sits on (fill colour where the fill has reached it, track colour
 *   where it hasn't) and its foreground inverts for contrast. No separate box.
 * - **label** — free text placed beside or above the bar via `labelPosition`. `left`/`right` reserve
 *   columns on the bar's row (the bar shrinks to fit); `top`/`top-left` reserve the row above the bar,
 *   making the widget two rows tall. Caption and label can be combined.
 *
 * The bar is a non-focusable leaf driven by a caller-owned `value` signal in `[0,1]`; the value is
 * clamped on every read, so `NaN`, `±Infinity`, and out-of-range numbers are all safe and simply
 * pin to 0 or 1.
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
 * Eighth-block partials indexed by the number of filled eighths, `1..7` = `▏▎▍▌▋▊▉`. Index `0` is an
 * empty-string sentinel so `PARTIAL[part]` is safe over the whole `0..7` range (index `0` means "no
 * partial cell"). Frozen — a shared immutable table.
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
 * Fill amount in **eighths** for a `w`-cell bar. The mid-range is `round(v·w·8)`, but the 0% and 100%
 * boundaries are snapped so the visual fill agrees with the rounded percent: a value that rounds to
 * 100% fills completely (no lingering partial in the last cell), and one that rounds to 0% is
 * completely empty. `v` is clamped first.
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
  return Math.round(c * w * 8);
}

/**
 * Whether a widget must fall back to pure-ASCII glyphs on the given terminal. Shared by
 * {@link ProgressBar} and {@link Spinner}: the block/eighth-block glyphs need both UTF-8 and
 * half-block support, so this returns `true` unless the terminal advertises both.
 *
 * @param caps The resolved terminal capabilities (available from a draw context as `ctx.caps`).
 * @returns `true` when the widget must fall back to a pure-ASCII glyph form.
 */
export const asciiOnly = (caps: CapabilityProfile): boolean => !caps.unicode.utf8 || !caps.glyphs.halfBlocks;

/** Where an optional {@link ProgressBarOptions.label} sits relative to the bar. */
export type LabelPosition = 'left' | 'right' | 'top' | 'top-left';

/** Construction options for {@link ProgressBar}. */
export interface ProgressBarOptions {
  /** Reactive progress in `[0,1]` (caller-owned; clamped on read). Writing it repaints. */
  readonly value: Signal<number>;
  /** Show a centred `NN%` knockout caption over the bar. Default `false`. */
  readonly caption?: boolean;
  /**
   * Optional text placed around the bar (literal or reactive accessor). Repaints on change. A
   * `left`/`right` label reserves `width(label)+1` columns beside the bar, so a **variable-width**
   * label reflows the bar as its text grows/shrinks (e.g. `9%`→`10%`→`100%` retreats the bar a cell).
   * Pad such a label to a stable width — e.g. `` () => `${pct}%`.padStart(4) `` — to keep the bar fixed.
   */
  readonly label?: string | (() => string);
  /** Where {@link label} sits. Default `'left'` — the only position that fits on a one-row bar. */
  readonly labelPosition?: LabelPosition;
}

/**
 * A determinate progress bar. Non-focusable leaf; paints a proportional fill (smooth sub-cell on a
 * Unicode terminal, whole-cell `#`/`-` on an ASCII one) with an optional knockout percent caption and
 * an optional positioned label.
 *
 * @example
 * import { Group, Button, ProgressBar, signal, at } from '@jsvision/ui';
 *
 * const g = new Group();
 * const value = signal(0.4); // progress in [0, 1]
 *
 * // A bar with a knockout percent caption and a leading label.
 * const bar = new ProgressBar({ value, caption: true, label: 'Copying', labelPosition: 'left' });
 * g.add(at(bar, 1, 0, 24, 1));
 *
 * // Advance it — the bar repaints reactively when the signal changes.
 * const step = new Button('~S~tep', { onClick: () => value.set(Math.min(1, value() + 0.1)) });
 * g.add(at(step, 1, 2, 10, 2));
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
    // Repaint when the bound value OR the label accessor changes. The reactive binding must be
    // established on mount, when this view's reactive scope exists (not in the constructor).
    this.onMount(() =>
      this.bind(() => {
        this.value();
        this.resolveLabel();
      }),
    );
  }

  /** Write the bound signal. Clamped on read, so any number is safe. */
  set(value: number): void {
    this.value.set(value);
  }

  /** The current progress as an integer percent, `round(clamp(value, 0, 1) · 100)`. */
  get percent(): number {
    return Math.round(clamp01(this.value()) * 100);
  }

  /** Resolve the label to a string (accessor or literal); `''` when no label was given. */
  private resolveLabel(): string {
    if (this.label === undefined) return '';
    return typeof this.label === 'function' ? this.label() : this.label;
  }

  /**
   * Intrinsic size: a top label makes the bar two rows tall; otherwise one row. Width fills whatever
   * is available. Only consulted for `auto` sizing — fixed and absolute rects are unaffected.
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
      const filled = Math.round(fillEighths(v, bw) / 8); // whole cells only; 0%/100% boundaries snapped
      for (let y = 0; y < bh; y += 1) {
        ctx.fillRect(bx, by + y, filled, 1, '#', fillStyle);
        ctx.fillRect(bx + filled, by + y, bw - filled, 1, '-', trackStyle);
      }
    } else {
      const e = fillEighths(v, bw); // fill width in eighths (0%/100% boundaries snapped)
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
   * Draw a centred `NN%` knockout caption over the bar sub-rect. Each digit's background matches what
   * it sits on — the fill colour where the fill has swept over it, the track's background where it
   * hasn't — and the foreground inverts for contrast. The fill boundary is computed in whole cells,
   * consistent with the drawn bar.
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
