/**
 * {@link ColorSwatch} — a focusable grid of color cells the user picks from with the arrow keys or the
 * mouse. Each color is a 3-column block; the currently-selected cell is marked with a `◘` glyph. The
 * pure geometry and wrap-around navigation live in `color-grid.ts`.
 *
 * Interaction and behaviour:
 * - **Live selection** — every arrow key, click, and drag updates the bound `value` immediately, the
 *   marker follows, and the optional `onInput` callback fires. Arrow navigation wraps around the ends
 *   of the palette.
 * - **Marker** — drawn on the cell whose color equals `value`. If `value` is an off-palette color
 *   (e.g. a custom hex color from a hosting {@link ColorPicker}) no marker shows, but arrow navigation
 *   still works from the internal cursor. On a near-black cell the marker is drawn in a contrasting
 *   colour so it stays visible.
 * - **Commit** — `Enter`, `Space`, or a mouse-up over a cell fires the optional `onChange` callback
 *   (the discrete commit), which a hosting `ColorPicker` uses to close its dropdown. Standalone, this
 *   is a no-op.
 * - **No frame** — the swatch draws only its cells; a hosting popup or window supplies any border.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import type { Size2D } from '../layout/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { PALETTE, ANSI16_ORDER } from '@jsvision/core';
import type { Color, Style } from '@jsvision/core';
import {
  gridDims,
  cellX,
  cellRow,
  hitCell,
  navLeft,
  navRight,
  navUp,
  navDown,
  isNearBlack,
  CELL_WIDTH,
} from './color-grid.js';

/** The cell block glyph — a full block `█` filling each cell. */
const CELL_GLYPH = '█';
/** The selection marker `◘` drawn on the centre column of the selected cell. */
const MARKER_GLYPH = '◘';

/** Options for a {@link ColorSwatch}. */
export interface ColorSwatchOptions {
  /** Two-way selected color. */
  value: Signal<Color>;
  /** Palette to display (default {@link ANSI16_ORDER}, the DOS-16 colors). */
  colors?: readonly Color[];
  /** Columns per row (default 4). */
  columns?: number;
  /** Fired on every live value change (arrow / click / drag). */
  onInput?: (c: Color) => void;
  /** Fired on the discrete commit gesture — Enter, Space, or a mouse-up over a cell. */
  onChange?: (c: Color) => void;
  /** Pure color-name accessor — used by a hosting `ColorPicker` to caption its chip. */
  nameFor?: (c: Color) => string;
}

/**
 * A focusable grid of color cells. Selection is live — the bound `value` changes on every arrow key,
 * click, and drag (each firing `onInput`), and the `◘` marker tracks it. Enter/Space or a mouse-up
 * over a cell is the discrete commit and fires `onChange` (used by a hosting `ColorPicker` to close
 * its dropdown).
 *
 * @example
 * import { Group, ColorSwatch, signal, at } from '@jsvision/ui';
 * import { ANSI16_ORDER } from '@jsvision/core';
 * import type { Color } from '@jsvision/core';
 *
 * const g = new Group();
 * const value = signal<Color>('brightCyan');
 *
 * // A 4×4 grid of the 16 DOS colors, bound two-way to `value`.
 * const swatch = at(
 *   new ColorSwatch({
 *     value,
 *     colors: ANSI16_ORDER as readonly Color[],
 *     columns: 4,
 *     onInput: (c) => console.log('previewing', c), // arrows / click / drag update `value` live
 *     onChange: (c) => console.log('committed', c), // Enter / Space / mouse-up commits
 *   }),
 *   1,
 *   1,
 *   12,
 *   4,
 * );
 * g.add(swatch);
 */
export class ColorSwatch extends View {
  /** The swatch takes focus so its arrow-key navigation is scoped to it. */
  override focusable = true;

  /** Two-way selected color. */
  readonly value: Signal<Color>;
  /** Optional pure color-name accessor, read by a hosting `ColorPicker` caption. */
  readonly nameFor?: (c: Color) => string;

  protected readonly colors: readonly Color[];
  protected readonly columns: number;
  protected readonly onInput?: (c: Color) => void;
  protected readonly onChange?: (c: Color) => void;
  /** The cell the arrow keys move from; kept in sync with `value` on every change. */
  protected readonly cursor: Signal<number>;
  /** The cursor before the current mouse gesture, restored when a drag moves outside the grid. */
  private preDrag = 0;

  /**
   * @param opts The two-way `value` + optional `colors`/`columns`/`onInput`/`onChange`/`nameFor`.
   */
  constructor(opts: ColorSwatchOptions) {
    super();
    this.value = opts.value;
    this.colors = opts.colors ?? (ANSI16_ORDER as readonly Color[]);
    this.columns = opts.columns ?? 4;
    this.onInput = opts.onInput;
    this.onChange = opts.onChange;
    this.nameFor = opts.nameFor;
    const i = this.colors.indexOf(this.value());
    this.cursor = signal(i >= 0 ? i : 0);

    // When `value` changes (from anywhere), move the cursor to its cell so arrow navigation continues
    // from the selection, and repaint so the ◘ marker tracks it. Bound on mount, when the reactive
    // scope exists.
    this.onMount(() => {
      this.bind(
        () => this.value(),
        (v) => {
          const idx = this.colors.indexOf(v);
          if (idx >= 0) this.cursor.set(idx);
        },
      );
    });
  }

  /** Advertise the grid's intrinsic size (width × rows) for `auto` sizing. */
  override measure(): Size2D {
    const { width, rows } = gridDims(this.colors.length, this.columns);
    return { width, height: Math.max(1, rows) };
  }

  /** Programmatically select a color: set `value` and fire both the live `onInput` and commit `onChange`. */
  select(color: Color): void {
    this.value.set(color);
    this.onInput?.(color);
    this.onChange?.(color);
  }

  /**
   * Select cell `idx` and update `value` immediately so the `◘` marker tracks it. A no-op for an
   * out-of-range index. This does NOT close a hosting `ColorPicker` — that is the {@link close} hook.
   */
  protected setLive(idx: number): void {
    if (idx < 0 || idx >= this.colors.length) return;
    this.cursor.set(idx);
    const c = this.colors[idx];
    this.value.set(c);
    this.onInput?.(c);
  }

  /** Fire the commit callback (`onChange`) with the current `value` (Enter/Space or a mouse-up over a cell). */
  protected close(): void {
    this.onChange?.(this.value());
  }

  /** Paint the color cells, then the `◘` marker on the selected cell (contrasting colour if near-black). */
  draw(ctx: DrawContext): void {
    const marked = this.colors.indexOf(this.value());
    for (let i = 0; i < this.colors.length; i += 1) {
      const x = cellX(i, this.columns);
      const y = cellRow(i, this.columns);
      const cellColor = this.colors[i];
      const cellStyle: Style = { fg: cellColor, bg: PALETTE.black };
      ctx.fillRect(x, y, CELL_WIDTH, 1, CELL_GLYPH, cellStyle); // the cell's 3-wide colored block
      if (i === marked) {
        // On a near-black cell the knockout marker would be invisible, so draw it in a contrasting
        // colour; otherwise use the cell's own colour (the ◘ punches a black dot into it).
        const markerStyle = isNearBlack(cellColor) ? ctx.color('colorMarker') : cellStyle;
        ctx.text(x + 1, y, MARKER_GLYPH, markerStyle);
      }
    }
  }

  /**
   * Handle keyboard (wrap-around arrows + Enter/Space commit) and mouse (click/drag selection). Plain
   * arrow keys are always consumed so navigation never leaves the swatch.
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'mouse') {
      this.handleMouse(ev);
      return;
    }
    if (inner.type !== 'key') return;
    const n = this.colors.length;
    switch (inner.key) {
      case 'left':
        this.setLive(navLeft(this.cursor(), n, this.columns));
        break;
      case 'right':
        this.setLive(navRight(this.cursor(), n, this.columns));
        break;
      case 'up':
        this.setLive(navUp(this.cursor(), n, this.columns));
        break;
      case 'down':
        this.setLive(navDown(this.cursor(), n, this.columns));
        break;
      case 'enter':
      case 'space':
        this.close(); // value is already live; Enter/Space closes a hosting picker (standalone: no-op)
        break;
      default:
        return; // not a swatch key — leave unconsumed
    }
    ev.handled = true;
  }

  /**
   * Mouse down snapshots the current cell (as the revert target), selects the cell under the pointer,
   * and captures the pointer so the drag keeps tracking even off the grid. A drag selects the cell
   * under the pointer live, reverting to the snapshot when the pointer moves outside the grid. A
   * mouse-up over a real cell fires the {@link close} hook (so a hosting `ColorPicker` closes); a
   * release outside the grid does not close.
   *
   * @param ev The dispatch envelope (carries `local` plus the pointer-capture seams).
   */
  protected handleMouse(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'mouse') return;
    const local = ev.local;
    if (inner.kind === 'down') {
      this.preDrag = this.cursor(); // the cell to revert to if the drag moves outside the grid
      if (local !== undefined) this.applyHit(local.x, local.y);
      ev.setCapture?.(this); // capture so the drag keeps tracking off the grid
      ev.handled = true;
    } else if (inner.kind === 'move' || inner.kind === 'drag') {
      if (local !== undefined) this.applyHit(local.x, local.y);
      ev.handled = true;
    } else if (inner.kind === 'up') {
      // A release over a real cell closes a hosting picker (the value is already set live via applyHit).
      if (local !== undefined) {
        const hit = hitCell(local.x, local.y, this.colors.length, this.columns);
        if (typeof hit === 'number') {
          this.setLive(hit);
          this.close();
        }
      }
      ev.releaseCapture?.();
      ev.handled = true;
    }
  }

  /** Select the cell under a view-local pointer: revert outside the grid, clamp a partial-row overshoot. */
  protected applyHit(localX: number, localY: number): void {
    const hit = hitCell(localX, localY, this.colors.length, this.columns);
    if (hit === 'outside')
      this.setLive(this.preDrag); // pointer left the grid → revert to the pre-drag cell
    else if (hit === 'overshoot')
      this.setLive(Math.max(0, this.colors.length - 1)); // inside the grid but past the last cell → clamp
    else this.setLive(hit);
  }
}
