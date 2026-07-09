/**
 * A scroll bar: two end arrows, a shaded page track, and a proportional thumb, driven entirely by the
 * mouse. Its position is a two-way `Signal<number>` clamped to `[min, max]` — reading it renders the
 * thumb, and gestures write it back.
 *
 * The bar is **passive chrome** (`focusable = false`): it owns only the mouse — click an arrow to
 * step, click the track to jump the thumb there and drag, wheel to step by `3 × arrowStep`. It does
 * **not** handle the keyboard; a container such as {@link Scroller} or `ListView` owns the keys and
 * drives the same `value` signal. When `max === min` the bar is disabled and the whole track draws
 * with the disabled glyph.
 */
import type { Signal } from '../reactive/index.js';
import type { DispatchEvent, DrawContext } from '../view/index.js';
import { View } from '../view/index.js';
import { valueToOffset, offsetToValue } from '../controls/track.js';

/** Vertical scroll glyphs: start ▲, end ▼. */
const V_START = '\u25B2'; // ▲ BLACK UP-POINTING TRIANGLE
const V_END = '\u25BC'; // ▼ BLACK DOWN-POINTING TRIANGLE
/** Horizontal scroll glyphs: start ◄, end ►. */
const H_START = '\u25C4'; // ◄ BLACK LEFT-POINTING POINTER
const H_END = '\u25BA'; // ► BLACK RIGHT-POINTING POINTER
/** Shared track/thumb/disabled glyphs. */
const TRACK = '\u2592'; // ▒ MEDIUM SHADE
const THUMB = '\u2588'; // █ FULL BLOCK — not ■, which is Ambiguous-width and can render double-wide, shifting the whole bar
const DISABLED = '\u2593'; // ▓ DARK SHADE

/** Mouse part codes along the bar. Vertical adds 4 to the non-indicator (arrow/page) parts. */
const SB_LINE_BACK = 0; // start arrow (step back one line)
const SB_PAGE_BACK = 2; // page track between the start arrow and the thumb
const SB_PAGE_FWD = 3; // page track between the thumb and the end arrow
const SB_INDICATOR = 8; // the thumb itself

/** Construction options for {@link ScrollBar}. */
export interface ScrollBarOptions {
  /** Two-way position binding: reading renders the thumb, gestures write back, clamped to `[min,max]`. */
  value: Signal<number>;
  /** Range minimum (default 0). */
  min?: number;
  /** Range maximum (default 0 ⇒ disabled, whole track drawn `▓`). */
  max?: number;
  /** Page-click step (default: the axis length − 1). */
  pageStep?: number;
  /** Arrow-click step (default 1); wheel steps `3·arrowStep`. */
  arrowStep?: number;
  /** Long axis (default `'vertical'`). */
  orientation?: 'vertical' | 'horizontal';
}

/**
 * A scroll bar: arrows + a page track + a proportional thumb, driven by mouse (see the module docs).
 *
 * @example
 * import { ScrollBar, Group, createEventLoop, signal } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const pos = signal(0);
 * const bar = new ScrollBar({ value: pos, min: 0, max: 100, orientation: 'vertical' });
 * bar.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 1, height: 8 } };
 *
 * const root = new Group();
 * root.add(bar);
 * const loop = createEventLoop({ width: 1, height: 8 }, { caps });
 * loop.mount(root);
 * pos.set(50); // scroll externally — the thumb re-renders halfway down
 */
export class ScrollBar extends View {
  override focusable = false; // passive chrome — the owning viewer drives the keys
  /** The two-way bound position (source of truth). */
  protected readonly value: Signal<number>;
  /** Range minimum (mutable — an owner `Scroller`/`ListView` re-limits via {@link setRange}). */
  protected min: number;
  /** Range maximum (mutable — see {@link setRange}). */
  protected max: number;
  /** Explicit page step, or `undefined` for the axis-length default (mutable via {@link setRange}). */
  protected pageStepOpt?: number;
  /** Arrow-click step (mutable — an owner viewer re-wires it via {@link setRange}). */
  protected arrowStepVal: number;
  protected readonly vertical: boolean;
  /** True while a thumb-drag gesture holds the pointer capture. */
  protected dragging = false;

  /**
   * @param opts `value` (two-way signal) + optional `min`/`max`/`pageStep`/`arrowStep`/`orientation`.
   */
  constructor(opts: ScrollBarOptions) {
    super();
    this.value = opts.value;
    this.min = opts.min ?? 0;
    this.max = opts.max ?? 0;
    this.pageStepOpt = opts.pageStep;
    this.arrowStepVal = opts.arrowStep ?? 1;
    this.vertical = (opts.orientation ?? 'vertical') === 'vertical';
    // Repaint when the position changes externally (the owner scrolls, or a bound signal write).
    this.onMount(() =>
      this.bind(
        () => this.value(),
        () => undefined,
      ),
    );
  }

  /**
   * Re-limit the bar at runtime — an owning `Scroller`/`ListView` calls this when its viewport or
   * content extent changes. The bound `value` is not written here; it is clamped into the new range on
   * read, so a shrunk range never over-scrolls or throws.
   *
   * @param min       New range minimum.
   * @param max       New range maximum (raised to `min` if smaller).
   * @param pageStep  New page step, or `undefined` to keep the axis-length default.
   * @param arrowStep New arrow step, or `undefined` to keep the current one. A multi-column list wires
   *   this to its row count so an arrow-click jumps a whole column; a single-column owner leaves it at 1.
   */
  setRange(min: number, max: number, pageStep?: number, arrowStep?: number): void {
    this.min = min;
    this.max = Math.max(min, max);
    this.pageStepOpt = pageStep;
    if (arrowStep !== undefined) this.arrowStepVal = arrowStep;
  }

  /** The drawn/measured long-axis length in cells (height when vertical, else width). */
  protected axisLen(): number {
    return this.vertical ? this.bounds.height : this.bounds.width;
  }

  /** The effective bar length, never below 3 (an arrow at each end plus at least one track/thumb cell). */
  protected getSize(len: number): number {
    return Math.max(3, len);
  }

  /** The current position clamped into `[min,max]` (a stray owner write can't index out of range). */
  protected readValue(): number {
    return Math.min(this.max, Math.max(this.min, this.value()));
  }

  /**
   * The thumb cell along the axis, in `[1, getSize()-2]` — the position mapped proportionally from
   * `value` within `[min, max]` and pinned between the two end arrows.
   *
   * @param len The long-axis length in cells.
   * @returns The 0-based thumb index.
   */
  protected getPos(len: number): number {
    const size = this.getSize(len);
    // The groove is the cells between the two end arrows (length = size-2, one-cell thumb); the shared
    // track math maps the value into it, then +1 shifts past the start arrow into an absolute cell.
    return valueToOffset({ min: this.min, max: this.max, length: size - 2, thumbSize: 1 }, this.readValue()) + 1;
  }

  /** The effective page step (the configured `pageStep`, else the axis length − 1). */
  pageStep(): number {
    return this.pageStepOpt ?? Math.max(1, this.axisLen() - 1);
  }

  /** The effective arrow-click step; the wheel steps `3×` this. */
  arrowStep(): number {
    return this.arrowStepVal;
  }

  /**
   * Paint the bar: an arrow at each end in the `scrollBarControls` role, a `▒` track (or a full `▓`
   * fill when disabled) in `scrollBarPage`, and the thumb in `scrollBarControls` at its current cell.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const len = this.vertical ? ctx.size.height : ctx.size.width;
    const s = this.getSize(len) - 1; // last drawn index
    const controls = ctx.color('scrollBarControls');
    const page = ctx.color('scrollBarPage');
    const startGlyph = this.vertical ? V_START : H_START;
    const endGlyph = this.vertical ? V_END : H_END;

    this.put(ctx, 0, startGlyph, controls); // start arrow
    if (this.max === this.min) {
      for (let i = 1; i < s; i += 1) this.put(ctx, i, DISABLED, page); // disabled: fill the whole track
    } else {
      for (let i = 1; i < s; i += 1) this.put(ctx, i, TRACK, page); // track
      this.put(ctx, this.getPos(len), THUMB, controls); // thumb overwrites the track at its position
    }
    this.put(ctx, s, endGlyph, controls); // end arrow
  }

  /** Write one glyph at axis index `i` (col 0 / row 0 on the cross axis). */
  protected put(ctx: DrawContext, i: number, char: string, style: ReturnType<DrawContext['color']>): void {
    if (this.vertical) ctx.text(0, i, char, style);
    else ctx.text(i, 0, char, style);
  }

  /**
   * Route mouse gestures (the bar owns no keys). Arrow/page click steps once; a thumb click captures
   * the pointer and maps subsequent moves to `value`; wheel steps `3·arrowStep`.
   *
   * @param ev The dispatch envelope (carries `local` + the `setCapture`/`releaseCapture` seams).
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'wheel') {
      const back = this.vertical ? inner.dir === 'up' : inner.dir === 'left';
      const fwd = this.vertical ? inner.dir === 'down' : inner.dir === 'right';
      if (back || fwd) {
        this.setValue(this.readValue() + 3 * (back ? -this.arrowStepVal : this.arrowStepVal));
        ev.handled = true;
      }
      return;
    }
    if (inner.type !== 'mouse') return;
    const local = ev.local;
    if (local === undefined) return;
    const mark = this.vertical ? local.y : local.x;
    if (inner.kind === 'down') this.handleDown(ev, mark);
    else if (inner.kind === 'move' || inner.kind === 'drag') this.handleDrag(ev, mark);
    else if (inner.kind === 'up') this.handleUp(ev);
  }

  /**
   * Mouse-down: on the thumb ⇒ start a captured drag; on an **end arrow** ⇒ step once; on the
   * **track** ⇒ jump the thumb to the clicked position and enter the same captured drag, so the
   * pointer keeps driving it.
   */
  protected handleDown(ev: DispatchEvent, mark: number): void {
    const len = this.axisLen();
    const s = this.getSize(len) - 1;
    const pos = this.getPos(len);
    if (mark === pos) {
      this.dragging = true;
      ev.setCapture?.(this); // capture the pointer so the drag tracks off the 1-cell-wide bar column
    } else if (mark <= 0 || mark >= s) {
      this.setValue(this.readValue() + this.scrollStep(this.partCode(mark, pos, s))); // arrow: one step
    } else {
      this.jumpTo(mark, s); // track click jumps the thumb to the clicked position…
      this.dragging = true;
      ev.setCapture?.(this); // …and captures the pointer so it can be dragged from there
    }
    ev.handled = true;
  }

  /** Captured drag: map the axis position back to a proportional `value`. */
  protected handleDrag(ev: DispatchEvent, mark: number): void {
    if (!this.dragging) return;
    this.jumpTo(mark, this.getSize(this.axisLen()) - 1);
    ev.handled = true;
  }

  /** Map an axis position `mark` to a proportional `value`, clamped between the two end arrows. */
  protected jumpTo(mark: number, s: number): void {
    const length = s - 1; // groove cells between the two arrows (size-2)
    if (length <= 1) return; // a single thumb cell: nothing to map (matches the original s>2 guard)
    const offset = Math.min(length, Math.max(1, mark)) - 1; // clicked cell → 0-based groove offset
    this.setValue(offsetToValue({ min: this.min, max: this.max, length, thumbSize: 1 }, offset));
  }

  /** Mouse-up: end a drag + release the capture. */
  protected handleUp(ev: DispatchEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    ev.releaseCapture?.();
    ev.handled = true;
  }

  /**
   * Classify a clicked cell into a part code (start/end arrow, page-back/-forward, or the thumb).
   * Vertical parts add 4 so the same code space distinguishes the two orientations.
   *
   * @param mark The along-axis click cell.
   * @param pos  The current thumb cell.
   * @param s    The last cell index (`getSize()-1`).
   */
  protected partCode(mark: number, pos: number, s: number): number {
    if (mark === pos) return SB_INDICATOR;
    let part: number;
    if (mark < 1) part = SB_LINE_BACK;
    else if (mark < pos) part = SB_PAGE_BACK;
    else if (mark < s) part = SB_PAGE_FWD;
    else part = SB_LINE_BACK + 1; // end arrow (step forward one line)
    return this.vertical ? part + 4 : part;
  }

  /** The signed step for a part code: bit 1 selects page vs arrow step, bit 0 selects forward vs back. */
  protected scrollStep(part: number): number {
    const step = part & 2 ? this.pageStep() : this.arrowStepVal;
    return part & 1 ? step : -step;
  }

  /** Write the bound position, clamped to `[min,max]`. */
  protected setValue(next: number): void {
    const clamped = Math.min(this.max, Math.max(this.min, next));
    if (clamped !== this.value()) this.value.set(clamped);
  }
}
