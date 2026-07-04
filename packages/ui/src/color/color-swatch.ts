/**
 * `ColorSwatch` — a focusable color-grid `View`, a **faithful decode** of Turbo Vision's
 * `TColorSelector` (`source/tvision/colorsel.cpp:120-237`) extended with a generic `Color[]` palette,
 * truecolor cells, a cursor-vs-`value` split (PA-9), and an omitted frame (PA-12). The pure geometry +
 * wrap-around nav live in `color-grid.ts`.
 *
 * ## TV decode (GATE-1/GATE-2 — `TColorSelector`)
 *   • **draw()** (`colorsel.cpp:120-142`): `moveChar(0,' ',0x70,size.x)` pre-fills the row with attr
 *     `0x70` — a **no-op for a full grid** (16 cells cover all 12 columns), so RD-21 does NOT replicate
 *     it; partial-row gaps fall through to the host background (accepted extension, PF-001). Each cell
 *     `moveChar(j*3, icon, c, 3)` = `█` (U+2588, `icon='\xDB'`, `tvtext1.cpp:88`) × 3 columns at `j*3`
 *     in attribute `c` = `{ fg: cellColor, bg: black }` (TV `0x0c`, bg nibble 0). The selected cell
 *     `putChar(j*3+1, 8)` = `◘` (U+25D8, CP437 8) at the **centre** column; `if(c==0) putAttribute(
 *     j*3+1, 0x70)` forces black-on-lightGray so a black cell's marker stays visible → RD-21's
 *     `colorMarker` role, fired on **near-black** cells (the generic extension, PA-2).
 *   • **handleEvent()** (`colorsel.cpp:154-237`): wrap-around arrow nav (`:196-217`, transcribed in
 *     `color-grid.ts`); mouse `color = mouse.y*4 + mouse.x/3` on down **and while dragging**, a pointer
 *     **outside the view** reverts to the pre-drag cell (`else color=oldColor`, `:167-173`). `ofFramed`
 *     (`:114`) is **omitted** (PA-12 — the host popup/`Window` supplies the frame).
 *
 * ## GATE-2 AFTER-diff (re-verified vs `colorsel.cpp:120-237`, recorded in the commit)
 * The composed grid matches the decode cell-by-cell (executable oracle: `color-swatch.spec` ST-2/ST-3):
 * 3-wide `█` cells at `j*3` in the cell color, `◘` at `cellX+1`, near-black `0x70` marker, wrap-around
 * nav, and the `row*cols+floor(x/3)` drag hit + revert-outside. Documented extensions (spec oracles, no
 * `.cpp` diff): the generic `Color[]` palette + truecolor cells, the cursor-vs-`value` split (PA-9), the
 * partial-row overshoot clamp (PA-10), and the omitted frame (PA-12).
 *
 * ## State model (PA-9 / AC-15)
 * The internal `cursor: Signal<number>` is the nav SoT (init `indexOf(value)` else `0`). `value` is a
 * derived two-way bind: an external member `value` re-homes the cursor (a `value ∉ colors` leaves it);
 * commit sets `value = colors[cursor]`. The **marker is drawn on `indexOf(value())`** — a `value ∉
 * colors` shows no marker, yet nav still works from the cursor and Enter/Space commits `colors[cursor]`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import type { Size2D } from '../layout/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { PALETTE, ANSI16_ORDER } from '@jsvision/core';
import type { Color, Style } from '@jsvision/core';
import { gridDims, cellX, cellRow, hitCell, navLeft, navRight, navUp, navDown, isNearBlack, CELL_WIDTH } from './color-grid.js';

/** The cell block glyph — TV `icon = '\xDB'` = `█` U+2588 full block (`tvtext1.cpp:88`, PA-5). */
const CELL_GLYPH = '█';
/** The selection marker — TV `putChar(j*3+1, 8)` = `◘` U+25D8 (CP437 8, `colorsel.cpp:134`, PA-6). */
const MARKER_GLYPH = '◘';

/** Options for a {@link ColorSwatch}. (03-01) */
export interface ColorSwatchOptions {
  /** Two-way selected color. */
  value: Signal<Color>;
  /** Palette (default {@link ANSI16_ORDER}, the DOS-16 grid). */
  colors?: readonly Color[];
  /** Columns per row (default 4, TV `TColorSelector`). */
  columns?: number;
  /** Fired when `value` changes via a commit (Should-Have). */
  onChange?: (c: Color) => void;
  /** Pure name accessor (Should-Have, PA-13) — used by the `ColorPicker` chip caption. */
  nameFor?: (c: Color) => string;
  /** Internal hook the `ColorPicker` wires to commit+close (fired on a keyboard/`select` commit, PA-11). */
  onCommit?: (c: Color) => void;
}

/**
 * A focusable color-grid view. Draws the TV decode + the extensions; navigates an internal cursor by
 * keyboard/mouse; commits a color on Enter/Space or `select()`. See the module doc for the decode.
 */
export class ColorSwatch extends View {
  /** TV `ofSelectable` — the swatch takes focus (the cursor + keymap are focus-scoped). */
  override focusable = true;

  /** Two-way selected color. */
  readonly value: Signal<Color>;
  /** Optional pure name accessor (PA-13), read by the `ColorPicker` caption. */
  readonly nameFor?: (c: Color) => string;

  protected readonly colors: readonly Color[];
  protected readonly columns: number;
  protected readonly onChange?: (c: Color) => void;
  protected readonly onCommit?: (c: Color) => void;
  /** The nav cursor — the single source of truth for navigation (PA-9). */
  protected readonly cursor: Signal<number>;
  /** The cursor before the current mouse gesture (TV `oldColor`), restored on a drag-outside revert. */
  private preDrag = 0;

  /**
   * @param opts The two-way `value` + optional `colors`/`columns`/`onChange`/`nameFor`/`onCommit`.
   */
  constructor(opts: ColorSwatchOptions) {
    super();
    this.value = opts.value;
    this.colors = opts.colors ?? (ANSI16_ORDER as readonly Color[]);
    this.columns = opts.columns ?? 4;
    this.onChange = opts.onChange;
    this.onCommit = opts.onCommit;
    this.nameFor = opts.nameFor;
    const i = this.colors.indexOf(this.value());
    this.cursor = signal(i >= 0 ? i : 0);

    // value → cursor re-home + marker repaint: a member `value` moves the cursor to its index; the bind
    // effect repaints on every `value` change so the ◘ marker tracks the committed cell (PA-9).
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

  // ── Public methods (Should-Have) ────────────────────────────────────────────────────────────────

  /** Programmatic commit — set `value` (+ `onChange`/`onCommit`). */
  select(color: Color): void {
    this.commitColor(color);
  }

  // ── Commit helpers ──────────────────────────────────────────────────────────────────────────────

  /** Commit the cursor's color to `value` (Enter/Space); a no-op for an out-of-range cursor. */
  protected commit(): void {
    const idx = this.cursor();
    if (idx < 0 || idx >= this.colors.length) return;
    this.commitColor(this.colors[idx]);
  }

  /** Set `value` and fire the commit hooks (`onChange` public + `onCommit` picker-internal, PA-11). */
  protected commitColor(color: Color): void {
    this.value.set(color);
    this.onChange?.(color);
    this.onCommit?.(color);
  }

  // ── Draw ────────────────────────────────────────────────────────────────────────────────────────

  /** Paint the 3-wide `█` cells + the `◘` marker on the `value` cell (near-black → `colorMarker`). */
  draw(ctx: DrawContext): void {
    const marked = this.colors.indexOf(this.value());
    for (let i = 0; i < this.colors.length; i += 1) {
      const x = cellX(i, this.columns);
      const y = cellRow(i, this.columns);
      const cellColor = this.colors[i];
      const cellStyle: Style = { fg: cellColor, bg: PALETTE.black };
      ctx.fillRect(x, y, CELL_WIDTH, 1, CELL_GLYPH, cellStyle); // 3-wide █ block (PA-5/7)
      if (i === marked) {
        // Near-black → forced-contrast colorMarker (0x70); else the cell's own color (the ◘ shows a
        // black knockout dot). AC-3 / PA-1 / PA-2.
        const markerStyle = isNearBlack(cellColor) ? ctx.color('colorMarker') : cellStyle;
        ctx.text(x + 1, y, MARKER_GLYPH, markerStyle);
      }
    }
  }

  // ── Input ───────────────────────────────────────────────────────────────────────────────────────

  /**
   * Wrap-around arrow nav + Enter/Space commit (keyboard) and click/drag cursor tracking (mouse). Plain
   * arrows are always consumed so they never leave the swatch's focus (AC-4).
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
        this.cursor.set(navLeft(this.cursor(), n, this.columns));
        break;
      case 'right':
        this.cursor.set(navRight(this.cursor(), n, this.columns));
        break;
      case 'up':
        this.cursor.set(navUp(this.cursor(), n, this.columns));
        break;
      case 'down':
        this.cursor.set(navDown(this.cursor(), n, this.columns));
        break;
      case 'enter':
      case 'space':
        this.commit();
        break;
      default:
        return; // not a swatch key — leave unconsumed
    }
    ev.handled = true;
  }

  /**
   * Mouse down → snapshot the pre-drag cursor + set from the pointer + capture; move while captured →
   * re-track; up → release. Down alone never commits (a drag previews via cursor tracking). **Commit
   * on release is opt-in via `onCommit`** (PA-11): a standalone swatch with no `onCommit` moves the
   * cursor only (TV — Enter/Space commits), while the `ColorPicker` wires `onCommit` so a release
   * **over a real cell** commits `value` + closes. A release outside the grid (or on a partial-row
   * overshoot) never commits — the cursor has already reverted/clamped via {@link applyHit}.
   *
   * @param ev The dispatch envelope (carries `local` + the `setCapture`/`releaseCapture` seams).
   */
  protected handleMouse(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'mouse') return;
    const local = ev.local;
    if (inner.kind === 'down') {
      this.preDrag = this.cursor(); // TV oldColor — the revert target while dragging outside
      if (local !== undefined) this.applyHit(local.x, local.y);
      ev.setCapture?.(this); // PA-16 — capture so the drag tracks off the grid
      ev.handled = true;
    } else if (inner.kind === 'move' || inner.kind === 'drag') {
      if (local !== undefined) this.applyHit(local.x, local.y);
      ev.handled = true;
    } else if (inner.kind === 'up') {
      // Commit-on-release over a real cell — opt-in via `onCommit` (the ColorPicker path, PA-11).
      if (local !== undefined && this.onCommit !== undefined) {
        const hit = hitCell(local.x, local.y, this.colors.length, this.columns);
        if (typeof hit === 'number') {
          this.cursor.set(hit);
          this.commit();
        }
      }
      ev.releaseCapture?.();
      ev.handled = true;
    }
  }

  /** Set the cursor from a view-local pointer via the discriminated {@link hitCell} (PA-10). */
  protected applyHit(localX: number, localY: number): void {
    const hit = hitCell(localX, localY, this.colors.length, this.columns);
    if (hit === 'outside')
      this.cursor.set(this.preDrag); // revert (colorsel.cpp:172-173  else color = oldColor)
    else if (hit === 'overshoot')
      this.cursor.set(Math.max(0, this.colors.length - 1)); // clamp a partial-row overshoot (extension)
    else this.cursor.set(hit);
  }
}
