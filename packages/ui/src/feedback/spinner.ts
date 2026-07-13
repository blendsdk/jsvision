/**
 * An indeterminate, caller-driven progress spinner.
 *
 * Three built-in presets (see {@link SPINNERS}):
 * - `dots` *(default)* — braille dots `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`; needs a UTF-8 terminal.
 * - `line` — ASCII `| / - \`; safe on every terminal.
 * - `blocks` — a growing eighth block `▏▎▍▌▋▊▉█`; needs UTF-8 and half-block support.
 *
 * On a terminal that can't render the chosen preset, any non-`line` preset automatically swaps to
 * `line`, so animation is preserved rather than falling back to a frozen glyph.
 *
 * The spinner holds no clock: you advance its caller-owned `frame` signal and it renders the matching
 * glyph. A rotating preset (`dots`, `line`) loops — `…, n-1, 0, 1, …`. A growing preset (`blocks`)
 * ping-pongs — `…, n-1, n-2, …, 1, 0, 1, …` — so the block pulses (grows, then shrinks) and reverses
 * at each end instead of snapping back to the thin sliver. Any integer frame is valid (negatives and
 * large values are handled safely). Drive it yourself, or use {@link runSpinner} to advance it on a timer.
 */
import { View } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import type { Signal } from '../reactive/index.js';
import { asciiOnly } from './progress-bar.js';

/** The named spinner presets. */
export type SpinnerName = 'dots' | 'line' | 'blocks';

/**
 * The frozen frame tables for each preset. Deeply frozen — the map and each array are immutable.
 * `dots` (braille) needs UTF-8; `blocks` (eighth blocks) needs UTF-8 and half-blocks; `line` is pure
 * ASCII and is the fallback target when the terminal can't render the others.
 */
export const SPINNERS: Readonly<Record<SpinnerName, readonly string[]>> = Object.freeze({
  dots: Object.freeze(['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']),
  line: Object.freeze(['|', '/', '-', '\\']),
  // Growing eighth blocks; the spinner animates these as a ping-pong (grow then shrink), not a loop.
  blocks: Object.freeze(['▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']),
});

/**
 * Presets whose glyphs grow rather than rotate, so the spinner animates them as a ping-pong (reverse
 * at each end) instead of looping back to the first frame. Rotating presets (`dots`, `line`) are absent
 * and loop as usual.
 */
const BOUNCE_PRESETS: ReadonlySet<SpinnerName> = new Set<SpinnerName>(['blocks']);

/**
 * Map a caller's monotonic `frame` counter to a glyph index in `0..n-1`.
 *
 * `bounce: false` loops (`0, 1, …, n-1, 0, …`) via a negative-safe modulo — right for rotating presets.
 * `bounce: true` ping-pongs (`0, 1, …, n-1, n-2, …, 1, 0, 1, …`) via a triangle wave, so a growing
 * preset reverses at each end. Both are safe for any integer frame (including negatives).
 *
 * @param frame  The caller-owned frame counter.
 * @param n      The preset's frame count (> 0).
 * @param bounce Whether to ping-pong (`true`) or loop (`false`).
 * @returns A valid index in `0..n-1`.
 */
function frameIndex(frame: number, n: number, bounce: boolean): number {
  if (n <= 1) return 0;
  if (!bounce) return ((frame % n) + n) % n;
  const period = 2 * (n - 1); // one full up-and-back sweep; endpoints hit once, interior frames twice
  const p = ((frame % period) + period) % period; // negative-safe position within the sweep
  return p < n ? p : period - p; // ascending up to the peak, then descending back down
}

/** Construction options for {@link Spinner}. */
export interface SpinnerOptions {
  /**
   * Reactive frame index (caller-owned; negative-safe). Advancing it repaints. It is mapped to a glyph
   * per preset — looping for `dots`/`line`, ping-pong for `blocks`.
   */
  readonly frame: Signal<number>;
  /** Named preset. Default `dots`. Falls back to `line` when `asciiOnly(caps)`. */
  readonly preset?: SpinnerName;
  /** Optional trailing label, a literal string or a reactive getter. */
  readonly label?: string | (() => string);
}

/**
 * An indeterminate spinner. Non-focusable leaf; renders the preset's current glyph with an optional
 * trailing label. Rotating presets (`dots`, `line`) loop; the growing `blocks` preset ping-pongs.
 * Animation is driven by the caller advancing `frame` (or {@link runSpinner}).
 *
 * @example
 * import { Group, Spinner, runSpinner, signal } from '@jsvision/ui';
 *
 * const g = new Group();
 * const frame = signal(0);
 *
 * const spinner = new Spinner({ frame, preset: 'dots', label: 'Loading…' });
 * spinner.layout = { position: 'absolute', rect: { x: 1, y: 0, width: 20, height: 1 } };
 * g.add(spinner);
 *
 * // Advance it on a timer (see runSpinner); `stop()` halts the animation.
 * const stop = runSpinner(frame, { timer: app.runtime, intervalMs: 80 });
 * // …later: stop();
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
    // Advancing `frame` (or a reactive label) repaints. The binding must be set up on mount, when
    // this view's reactive scope exists (not in the constructor).
    this.onMount(() => {
      this.bind(() => this.frame());
      if (typeof this.label === 'function') this.bind(this.label);
    });
  }

  /**
   * Paint the current spinner glyph at column 0, plus the optional label at column 2. The active
   * preset falls back to `line` under `asciiOnly` caps (any non-`line` preset), preserving animation.
   * A growing preset (`blocks`) animates as a ping-pong; rotating presets loop.
   *
   * @param ctx The clipped, view-local paint context (carries `caps` for the preset decision).
   */
  override draw(ctx: DrawContext): void {
    const chosen = this.preset ?? 'dots';
    // On a terminal that can't render the chosen preset, swap to `line` (keeps animating).
    const preset: SpinnerName = asciiOnly(ctx.caps) && chosen !== 'line' ? 'line' : chosen;
    const frames = SPINNERS[preset];
    const n = frames.length; // > 0 for every preset
    // Loop rotating presets; ping-pong growing ones so a `blocks` bar pulses instead of snapping back.
    const i = frameIndex(this.frame(), n, BOUNCE_PRESETS.has(preset));
    ctx.text(0, 0, frames[i] ?? '', ctx.color('staticText'));
    const label = typeof this.label === 'function' ? this.label() : this.label;
    if (label !== undefined && label !== '') ctx.text(2, 0, label, ctx.color('label')); // column 2 = glyph + 1-cell gap
  }
}
