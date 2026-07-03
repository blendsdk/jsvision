/**
 * `Spinner` — an indeterminate, caller-driven progress spinner (RD-18, AR-187/190/191).
 *
 * RD-18 has NO Turbo Vision counterpart (GATE-1, AR-186), so this is a *documented new component*.
 * Pinned pieces (GATE-1 decode, plans/feedback/03-02 §PA-5/PA-2):
 *
 * - **`SPINNERS` presets** (frozen `readonly string[]`s):
 *   - `dots` *(default)* = `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` (U+2800 Braille Patterns) — needs `unicode.utf8`.
 *   - `line` = `| / - \` (ASCII) — safe on every terminal.
 *   - `blocks` = `▏▎▍▌▋▊▉█` (U+258F…U+2588 Block Elements) — needs `utf8` + `halfBlocks`; deliberately
 *     reuses the {@link ProgressBar} eighth-block set (cohesive decode).
 *   `dots`/`blocks` are the acknowledged modern extension (ora/Ink convention; no TV precedent).
 * - **ASCII fallback (PA-2)** — under `asciiOnly(caps)` **any** non-`line` preset swaps to `line`
 *   (a widget-level preset swap, never a static glyph — animation is preserved). `line` is pure ASCII.
 * - **Frame** is caller-owned and reduced by a **negative-safe mod** `(((f % n) + n) % n)` into
 *   `0..n-1`, so any integer (incl. negatives/large) is a valid index (AC-6/AC-14) — no OOB.
 * - **Glyph** in `staticText`, an optional **label** at column 2 (glyph width 1 + a 1-cell gap) in the
 *   `label` role, routed through `ctx.text` → core `sanitize` + width-clip (AC-9/AC-14).
 *
 * The widget never imports a timer — purity (AR-190). Animation is caller-driven (advance `frame`);
 * {@link runSpinner} is the optional timer helper. The `.js` extension in import specifiers is
 * required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import type { Signal } from '../reactive/index.js';
import { asciiOnly } from './progress-bar.js';

/** The named spinner presets (PA-5). */
export type SpinnerName = 'dots' | 'line' | 'blocks';

/**
 * The frozen frame tables for each preset (PA-5). Deeply frozen — the map and each array are
 * immutable. `dots` (braille) needs UTF-8; `blocks` (eighth blocks) needs UTF-8 + half-blocks;
 * `line` is pure ASCII and is the `asciiOnly` fallback target.
 */
export const SPINNERS: Readonly<Record<SpinnerName, readonly string[]>> = Object.freeze({
  dots: Object.freeze(['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']),
  line: Object.freeze(['|', '/', '-', '\\']),
  blocks: Object.freeze(['▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']),
});

/** Construction options for {@link Spinner}. */
export interface SpinnerOptions {
  /** Reactive frame index (caller-owned; reduced mod n, negative-safe). Advancing it repaints. */
  readonly frame: Signal<number>;
  /** Named preset. Default `dots`. Falls back to `line` when `asciiOnly(caps)`. */
  readonly preset?: SpinnerName;
  /** Optional trailing label, a literal string or a reactive getter. */
  readonly label?: string | (() => string);
}

/**
 * An indeterminate spinner. Non-focusable leaf; renders `frames[frame() mod n]` with an optional
 * trailing label. Animation is driven by the caller advancing `frame` (or {@link runSpinner}).
 */
export class Spinner extends View {
  private readonly frame: Signal<number>;
  private readonly preset?: SpinnerName;
  private readonly label?: string | (() => string);

  /**
   * @param opts `frame` (caller-owned signal) + optional `preset` (default `dots`) + optional `label`.
   */
  constructor(opts: SpinnerOptions) {
    super();
    this.frame = opts.frame;
    this.preset = opts.preset;
    this.label = opts.label;
    // Advancing `frame` (or a reactive label) repaints (the `Text` idiom; canonical site: onMount).
    this.onMount(() => {
      this.bind(() => this.frame());
      if (typeof this.label === 'function') this.bind(this.label);
    });
  }

  /**
   * Paint the current spinner glyph at column 0, plus the optional label at column 2. The active
   * preset falls back to `line` under `asciiOnly` caps (any non-`line` preset), preserving animation.
   *
   * @param ctx The clipped, view-local paint context (carries `caps` for the preset decision).
   */
  override draw(ctx: DrawContext): void {
    const chosen = this.preset ?? 'dots';
    const preset: SpinnerName = asciiOnly(ctx.caps) && chosen !== 'line' ? 'line' : chosen; // AC-8
    const frames = SPINNERS[preset];
    const n = frames.length; // > 0 for every preset
    const i = ((this.frame() % n) + n) % n; // AC-6: negative-safe mod
    ctx.text(0, 0, frames[i] ?? '', ctx.color('staticText'));
    const label = typeof this.label === 'function' ? this.label() : this.label;
    if (label !== undefined && label !== '') ctx.text(2, 0, label, ctx.color('label')); // AC-9: gap of 1 cell
  }
}
