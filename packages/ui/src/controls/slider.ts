/**
 * {@link Slider} — a focusable value control: a horizontal or vertical groove with a draggable thumb
 * bound to a numeric `Signal`. It is the framework's trackbar, so its look is a
 * fresh design: the groove draws in the `sliderTrack` role (`─` across, `│` down) and the single thumb
 * cell in the `sliderThumb` role (`█`), with no end-arrows. Its value↔position math is the shared
 * `track.ts` helper, so it stays consistent with `ScrollBar` by construction.
 *
 * Interaction:
 * - **Keyboard** (when focused) — the along-axis arrows step `±step` (→/← horizontal, ↓/↑ vertical,
 *   toward the groove end = increasing); `Home`/`End` jump to `min`/`max`; `PgUp`/`PgDn` step
 *   `∓pageStep`.
 * - **Mouse** — click the groove to place the thumb, press-drag with pointer capture to track
 *   continuously, wheel to step `±step` (up = increase).
 * - **Callbacks** — every live change fires `onInput`; a commit (each discrete key/wheel step, and the
 *   pointer-up ending a drag) fires `onChange`. A clamped no-op fires neither.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import type { Size2D } from '../layout/index.js';
import type { Signal } from '../reactive/index.js';
import { clampValue, valueToOffset, offsetToValue, stepValue } from './track.js';

/** Horizontal groove glyph (`─`) — the rule the thumb travels along. */
const H_GROOVE = '─';
/** Vertical groove glyph (`│`). */
const V_GROOVE = '│';
/** The thumb glyph (`█`) — a solid block marking the current value. */
const THUMB = '█';
/** Fallback along-axis length advertised by {@link Slider.measure} when the layout gives no explicit size. */
const MIN_LENGTH = 10;

/** Construction options for a {@link Slider}. */
export interface SliderOptions {
  /** Two-way numeric value: reading renders the thumb, an external write repaints and is clamped on read. */
  value: Signal<number>;
  /** Range minimum (default 0). */
  min?: number;
  /** Range maximum (default 100). */
  max?: number;
  /** Arrow/wheel step (default 1). */
  step?: number;
  /** Page step for PgUp/PgDn (default `max(1, round((max - min) / 10))`). */
  pageStep?: number;
  /** Long axis (default `'horizontal'`). */
  orientation?: 'horizontal' | 'vertical';
  /** Fired on every live change (drag move, arrow/page key, wheel). */
  onInput?: (v: number) => void;
  /** Fired on each commit — a discrete key/wheel step, or the pointer-up ending a drag. */
  onChange?: (v: number) => void;
}

/**
 * A focusable value slider bound two-way to a numeric `Signal` (see the module docs for glyphs and
 * interaction).
 *
 * @example
 * import { Group, Slider, signal, createEventLoop, at } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const green = signal(170);
 * const slider = at(
 *   new Slider({
 *     value: green,
 *     min: 0,
 *     max: 255,
 *     orientation: 'horizontal',
 *     onInput: (v) => console.log('previewing', v), // live: drag / arrow / wheel
 *     onChange: (v) => console.log('committed', v), // commit: key step, wheel, pointer-up
 *   }),
 *   0,
 *   0,
 *   16,
 *   1,
 * );
 *
 * const root = new Group();
 * root.add(slider);
 * const loop = createEventLoop({ width: 16, height: 1 }, { caps });
 * loop.mount(root);
 * green.set(255); // move externally — the thumb jumps to the far end
 */
export class Slider extends View {
  /** The slider takes focus so its arrow-key stepping is scoped to it. */
  override focusable = true;

  /** Two-way numeric value (source of truth). */
  protected readonly value: Signal<number>;
  protected readonly min: number;
  protected readonly max: number;
  protected readonly step: number;
  protected readonly pageStepVal: number;
  protected readonly vertical: boolean;
  protected readonly onInput?: (v: number) => void;
  protected readonly onChange?: (v: number) => void;
  /** True while a thumb-drag gesture holds the pointer capture. */
  protected dragging = false;

  /**
   * @param opts The two-way `value` plus optional `min`/`max`/`step`/`pageStep`/`orientation` and the
   *   `onInput` (live) / `onChange` (commit) callbacks.
   */
  constructor(opts: SliderOptions) {
    super();
    this.value = opts.value;
    this.min = opts.min ?? 0;
    this.max = opts.max ?? 100;
    this.step = opts.step ?? 1;
    this.pageStepVal = opts.pageStep ?? Math.max(1, Math.round((this.max - this.min) / 10));
    this.vertical = (opts.orientation ?? 'horizontal') === 'vertical';
    this.onInput = opts.onInput;
    this.onChange = opts.onChange;
    // Repaint when the value changes externally (a bound signal write elsewhere).
    this.onMount(() =>
      this.bind(
        () => this.value(),
        () => undefined,
      ),
    );
  }

  /** Advertise a 1-cell cross axis and a sensible along-axis default for `auto` sizing. */
  override measure(): Size2D {
    return this.vertical ? { width: 1, height: MIN_LENGTH } : { width: MIN_LENGTH, height: 1 };
  }

  /** Programmatically set the value: clamps, then (if it changed) fires both `onInput` and `onChange`. */
  select(value: number): void {
    this.commit(value);
  }

  /** The current value, clamped into `[min, max]` (a stray external write can't render out of range). */
  protected readValue(): number {
    return clampValue({ min: this.min, max: this.max }, this.value());
  }

  /** The groove length in cells along the long axis. */
  protected axisLen(): number {
    return this.vertical ? this.bounds.height : this.bounds.width;
  }

  /** Paint the groove, then the thumb cell at the value's mapped offset. */
  override draw(ctx: DrawContext): void {
    const track = ctx.color('sliderTrack');
    const thumb = ctx.color('sliderThumb');
    const len = this.vertical ? ctx.size.height : ctx.size.width;
    if (this.vertical) ctx.fillRect(0, 0, 1, len, V_GROOVE, track);
    else ctx.fillRect(0, 0, len, 1, H_GROOVE, track);
    const off = valueToOffset({ min: this.min, max: this.max, length: len, thumbSize: 1 }, this.readValue());
    if (this.vertical) ctx.text(0, off, THUMB, thumb);
    else ctx.text(off, 0, THUMB, thumb);
  }

  /** Set the value live (drag/press): clamp, and if it changed, write it and fire `onInput` only. */
  protected live(next: number): void {
    const clamped = clampValue({ min: this.min, max: this.max }, next);
    if (clamped === this.value()) return;
    this.value.set(clamped);
    this.onInput?.(clamped);
  }

  /** Commit a discrete step (key/wheel/select): clamp, and if it changed, fire both `onInput` and `onChange`. */
  protected commit(next: number): void {
    const clamped = clampValue({ min: this.min, max: this.max }, next);
    if (clamped === this.value()) return;
    this.value.set(clamped);
    this.onInput?.(clamped);
    this.onChange?.(clamped);
  }

  /**
   * Route keyboard (along-axis arrows / Home / End / PgUp / PgDn), mouse (click + captured drag), and
   * wheel (step) input. Plain along-axis arrows are consumed so stepping never leaves the slider.
   *
   * @param ev The dispatch envelope (carries `local` plus the pointer-capture seams).
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'wheel') {
      // Wheel up increases, down decreases; a clamped no-op fires nothing.
      if (inner.dir === 'up') this.commit(stepValue({ min: this.min, max: this.max }, this.readValue(), this.step));
      else if (inner.dir === 'down')
        this.commit(stepValue({ min: this.min, max: this.max }, this.readValue(), -this.step));
      else return;
      ev.handled = true;
      return;
    }
    if (inner.type === 'mouse') {
      this.handleMouse(ev);
      return;
    }
    if (inner.type !== 'key') return;
    const inc = this.vertical ? 'down' : 'right';
    const dec = this.vertical ? 'up' : 'left';
    switch (inner.key) {
      case inc:
        this.commit(stepValue({ min: this.min, max: this.max }, this.readValue(), this.step));
        break;
      case dec:
        this.commit(stepValue({ min: this.min, max: this.max }, this.readValue(), -this.step));
        break;
      case 'home':
        this.commit(this.min);
        break;
      case 'end':
        this.commit(this.max);
        break;
      case 'pageup':
        this.commit(stepValue({ min: this.min, max: this.max }, this.readValue(), -this.pageStepVal));
        break;
      case 'pagedown':
        this.commit(stepValue({ min: this.min, max: this.max }, this.readValue(), this.pageStepVal));
        break;
      default:
        return; // not a slider key — leave unconsumed
    }
    ev.handled = true;
  }

  /**
   * Mouse: down positions the thumb (live) and captures the pointer; a drag tracks the pointer live;
   * up commits once and releases the capture — so one drag gesture fires exactly one `onChange`.
   *
   * @param ev The dispatch envelope (carries `local` plus the pointer-capture seams).
   */
  protected handleMouse(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'mouse') return;
    const local = ev.local;
    if (inner.kind === 'down') {
      if (local !== undefined) this.live(this.valueAt(local.x, local.y));
      this.dragging = true;
      ev.setCapture?.(this); // capture so the drag keeps tracking off the 1-cell-wide axis
      ev.handled = true;
    } else if (inner.kind === 'move' || inner.kind === 'drag') {
      if (this.dragging && local !== undefined) this.live(this.valueAt(local.x, local.y));
      ev.handled = true;
    } else if (inner.kind === 'up') {
      if (this.dragging) {
        this.dragging = false;
        ev.releaseCapture?.();
        this.onChange?.(this.readValue()); // the single commit that ends the gesture
      }
      ev.handled = true;
    }
  }

  /** Map a view-local pointer to the value under it (the along-axis cell → `offsetToValue`). */
  protected valueAt(localX: number, localY: number): number {
    const off = this.vertical ? localY : localX;
    return offsetToValue({ min: this.min, max: this.max, length: this.axisLen(), thumbSize: 1 }, off);
  }
}
