/**
 * The per-cell paint helpers behind the datagrid body's custom-render path: a cell-local, cell-clipped
 * draw surface (`cellContext`) and a draw-error-isolating wrapper (`safeRender`). A `render` hook draws
 * in cell-local coordinates — `(0, 0)` is the cell's top-left — and cannot overflow into a neighbouring
 * column; if it throws, the cell degrades to a single warning glyph while the rest of the frame renders
 * normally. Control bytes are still stripped downstream at the engine's buffer-write boundary.
 */
import type { DrawContext, Style } from '@jsvision/ui';
import { stringWidth } from '@jsvision/ui';

/** The per-cell paint state handed to a custom renderer (read-only). */
export interface RenderCell<T, V> {
  /** Cell rect origin x, body-local (metrics only — the ctx origin is already the cell). */
  readonly x: number;
  /** Cell rect origin y, body-local. */
  readonly y: number;
  /** Cell width in columns. */
  readonly width: number;
  /** The cell's typed value. */
  readonly value: V;
  /** The row record. */
  readonly row: T;
  /** Which composited states are active on this cell. */
  readonly state: CellState;
}

/** Which composited states are active on the cell being rendered. */
export interface CellState {
  /** The cursor cell (the body has focus). */
  readonly focused: boolean;
  /** The selected row (dormant until row selection lands). */
  readonly selected: boolean;
  /** A pending commit. */
  readonly dirty: boolean;
  /** A blocked commit — the last edit failed validation / a veto and never took. */
  readonly invalid: boolean;
  /** An odd zebra stripe. */
  readonly zebra: boolean;
}

/**
 * The cell-local draw surface a renderer sees — a thin facade over the body context: the origin is the
 * cell's top-left, and writes are clipped to the cell rect so a renderer cannot paint into a neighbour.
 */
export type CellDrawContext = Pick<DrawContext, 'text' | 'fillRect' | 'color' | 'role' | 'caps'>;

/**
 * A custom cell painter. Receives a cell-local, cell-clipped {@link CellDrawContext} and the read-only
 * {@link RenderCell} state; run under draw-error isolation so a throw degrades only its own cell.
 */
export type CellRenderer<T, V> = (ctx: CellDrawContext, cell: RenderCell<T, V>) => void;

/** Longest prefix of `str` that fits `avail` columns without splitting a wide glyph (no padding). */
function clipToWidth(str: string, avail: number): string {
  if (avail <= 0) return '';
  let out = '';
  let w = 0;
  for (const ch of str) {
    const cw = stringWidth(ch);
    if (w + cw > avail) break; // a wide glyph that would straddle the edge is dropped whole
    out += ch;
    w += cw;
  }
  return out;
}

/**
 * Build a cell-local clipped facade over the body ctx for the cell at `(x, y, width)`. Writes are
 * offset by `(x, y)` and dropped when they fall outside the cell's single row or past its width, so the
 * renderer works in cell-local coordinates and cannot overflow into the next column. `color`/`role`/
 * `caps` pass through unchanged.
 *
 * @param ctx The body draw context.
 * @param x The cell rect origin x (body-local).
 * @param y The cell rect origin y (body-local).
 * @param width The cell width in columns.
 * @returns A {@link CellDrawContext} scoped to the cell.
 */
export function cellContext(ctx: DrawContext, x: number, y: number, width: number): CellDrawContext {
  return {
    text: (cx, cy, str, style) => {
      if (cy !== 0 || cx < 0 || cx >= width) return; // outside the single-row cell
      ctx.text(x + cx, y, clipToWidth(str, width - cx), style);
    },
    fillRect: (fx, fy, fw, fh, char, style) => {
      if (fy > 0 || fy + fh <= 0) return; // outside the cell's single row
      const x0 = Math.max(0, fx);
      const x1 = Math.min(width, fx + fw);
      if (x1 <= x0) return;
      ctx.fillRect(x + x0, y, x1 - x0, 1, char, style);
    },
    color: ctx.color,
    role: ctx.role,
    caps: ctx.caps,
  };
}

/**
 * Run a column's `render` under draw-error isolation. On a throw, repaint the cell in the row bg and a
 * single `⚠` at the cell origin in a theme-adaptive red over that bg (there is no dedicated error role),
 * so one bad renderer degrades one cell and the rest of the frame renders normally. Never rethrows.
 *
 * @param ctx The body draw context.
 * @param x The cell rect origin x (body-local).
 * @param y The cell rect origin y (body-local).
 * @param width The cell width in columns.
 * @param rowStyle The resolved row/cell style — its bg is the warning glyph's background.
 * @param render The column's custom renderer.
 * @param cell The per-cell paint state handed to the renderer.
 */
export function safeRender<T, V>(
  ctx: DrawContext,
  x: number,
  y: number,
  width: number,
  rowStyle: Style,
  render: CellRenderer<T, V>,
  cell: RenderCell<T, V>,
): void {
  try {
    render(cellContext(ctx, x, y, width), cell);
  } catch {
    ctx.fillRect(x, y, width, 1, ' ', rowStyle); // erase any partial paint before the throw
    ctx.text(x, y, '⚠', { fg: ctx.color('gridDirty').fg, bg: rowStyle.bg });
  }
}
