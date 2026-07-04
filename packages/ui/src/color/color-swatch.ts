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
 * ## GATE-2 AFTER-diff (re-verified vs `colorsel.cpp:120-237`, 2026-07-05 — no mismatch found)
 * The composed grid matches the decode cell-by-cell (executable oracle: `color-swatch.spec` ST-2/ST-3
 * + `color-swatch.impl` GATE-2): 3-wide `█` cells at `j*3` in the cell color (`bg` black), `◘` at
 * `cellX+1`, the near-black `0x70` `colorMarker`, the wrap-around nav (`:196-217`), and the
 * `row*cols+floor(x/3)` drag hit + revert-outside (`:167-173`). Both `█` (U+2588) and `◘` (U+25D8)
 * measure **width 1** under the default `wcwidth` mode (asserted in `color-swatch.impl`, PF-005), so the
 * 3-wide cell math and the centered marker hold. Documented extensions (spec oracles, no `.cpp` diff):
 * the generic `Color[]` palette + truecolor cells, the cursor-vs-`value` split (PA-9), the partial-row
 * overshoot clamp (PA-10), the picker close-on-release/Enter hook (PA-11), and the omitted frame (PA-12).
 *
 * ## State model (PA-9 / AC-15 — RD-21 fix, TV-faithful live-select 2026-07-05)
 * TV's `TColorSelector` has a **single live `color`** that every arrow/click/drag updates immediately
 * (`colorChanged()` + `drawView()`, `colorsel.cpp:170-174/234-235`). To honour that (the original PA-9
 * split required Enter to commit — a mis-decode), nav/mouse now **set `value` live** via `setLive` (the
 * internal `cursor` is the nav origin, kept in sync). The **marker is drawn on `indexOf(value())`**, so
 * an external off-palette `value` (e.g. the picker's hex field) shows no marker while nav still works
 * from the cursor. Enter/Space (or a mouse-up over a cell) fire only the {@link ColorSwatch.close}
 * picker-close hook — the value is already live.
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
  /** Internal close hook the `ColorPicker` wires (fired on Enter/Space or a mouse-up over a cell, PA-11). */
  onCommit?: (c: Color) => void;
}

/**
 * A focusable color-grid view. Draws the TV decode + the extensions; **live-selects** by keyboard/mouse
 * (TV-faithful — `value` changes on every arrow/click/drag, the ◘ marker tracks); Enter/Space or a
 * mouse-up over a cell closes a hosting `ColorPicker`. See the module doc for the decode.
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
  /** The live-selected cell (TV `color`) — the nav origin, kept in sync with `value` on every change. */
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

  /** Programmatic select — set `value` live (+ `onChange`) and fire the picker close hook (`onCommit`). */
  select(color: Color): void {
    this.value.set(color);
    this.onChange?.(color);
    this.onCommit?.(color);
  }

  // ── Selection helpers ─────────────────────────────────────────────────────────────────────────────

  /**
   * Set the live selection to cell `idx` and commit `value` **immediately** — TV `color = …;
   * colorChanged()` fires on every move/arrow (`colorsel.cpp:170-174/234-235`), so the `◘` marker
   * (drawn on `indexOf(value())`) tracks the cursor. A no-op for an out-of-range index. This does NOT
   * close a hosting `ColorPicker` — that is the release/Enter hook ({@link close}).
   */
  protected setLive(idx: number): void {
    if (idx < 0 || idx >= this.colors.length) return;
    this.cursor.set(idx);
    const c = this.colors[idx];
    this.value.set(c);
    this.onChange?.(c);
  }

  /** Fire the picker close hook with the current `value` (Enter/Space or a mouse-up over a real cell, PA-11). */
  protected close(): void {
    this.onCommit?.(this.value());
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
   * Mouse down → snapshot the pre-drag cell (TV `oldColor`) + **live-select** from the pointer +
   * capture; move while captured → re-track (live). This mirrors TV's `evMouseDown` loop
   * (`colorsel.cpp:165-177`): `color = mouse.y*4 + mouse.x/3` on down **and every drag move**, with a
   * pointer **outside the view** reverting to `oldColor` — every position updates `value` immediately
   * (the ◘ marker tracks). On **up over a real cell** the {@link close} hook fires so a hosting
   * `ColorPicker` closes (PA-11); a release outside the grid (or on a partial-row overshoot) does not
   * close (the cell has already reverted/clamped via {@link applyHit}).
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

  /** Live-select from a view-local pointer via the discriminated {@link hitCell} (PA-10). */
  protected applyHit(localX: number, localY: number): void {
    const hit = hitCell(localX, localY, this.colors.length, this.columns);
    if (hit === 'outside')
      this.setLive(this.preDrag); // revert live (colorsel.cpp:172-173  else color = oldColor)
    else if (hit === 'overshoot')
      this.setLive(Math.max(0, this.colors.length - 1)); // clamp a partial-row overshoot (extension)
    else this.setLive(hit);
  }
}
