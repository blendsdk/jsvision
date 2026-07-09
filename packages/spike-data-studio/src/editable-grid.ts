/**
 * Probe 4 core — the editable-datasheet layer, built as an ADDITIVE SUBCLASS of the shipped
 * `GridRows` (reused wholesale for virtual scroll + geometry) plus a `CellEditor` (a tiny `Input`
 * subclass). This is throwaway spike code: it reaches `GridRows` and the pure `columns.ts` helpers via
 * a relative path into `@jsvision/ui`'s built `dist/`, because the package's `exports` map only
 * publishes `.` — a finding for the memo (the framework must export these to ship an editable grid
 * without a fork).
 */
import { Input, signal } from '@jsvision/ui';
import type { View, DrawContext, DispatchEvent, Signal, InputOptions } from '@jsvision/ui';
// Deep reuse of framework internals (spike-only relative-path bypass of the `exports` gate).
import { GridRows } from '../../ui/dist/table/grid-rows.js';
import type { GridRowsConfig } from '../../ui/dist/table/grid-rows.js';
import { alignCell } from '../../ui/dist/table/columns.js';

/** ASCII-safe cell measure (the seed's editable columns are ASCII; wide-glyph aware not needed here). */
const cellWidth = (s: string): number => [...s].length;

/** A cell rect in the grid body's local coordinates. */
export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * `GridRows` + a cell cursor. Adds `focusedCol` and cell navigation (←/→ and Tab/Shift-Tab move the
 * column; ↑/↓ still move the row via the inherited row cursor), paints a cursor + dirty dot on the
 * focused cell, and fires `onEdit` on Enter over an editable cell. Row-nav, virtual scroll, and column
 * geometry are entirely inherited — the row-focus model does NOT fight an added column cursor.
 */
export class EditableGridRows<T> extends GridRows<T> {
  /** The current column (0-based). The inherited `focused` signal is the current row. */
  readonly focusedCol: Signal<number>;
  /** Whether each column may be edited (read-only columns are skippable / reject Enter). */
  private readonly editable: boolean[];
  /** Fired on Enter over an editable cell — the host opens an editor overlay. */
  onEdit?: (col: number, row: number) => void;
  /** Reports whether a cell has an uncommitted edit (drives the dirty dot). */
  isDirtyCell?: (col: number, row: number) => boolean;

  constructor(cfg: GridRowsConfig<T>, editable: boolean[]) {
    super(cfg);
    this.editable = editable;
    this.focusedCol = signal(0);
    this.onMount(() => {
      // Repaint the cursor when the column changes.
      this.bind(
        () => this.focusedCol(),
        () => undefined,
      );
    });
  }

  /** Clamp a display index into range. */
  private clampRow(i: number): number {
    return Math.max(0, Math.min(i, this.display().length - 1));
  }

  /** The focused cell's rect in body-local coordinates (for anchoring an editor overlay). */
  cellRectLocal(): CellRect {
    const geom = this.geometry(this.bounds.width);
    const col = this.focusedCol();
    const row = this.clampRow(this.focused());
    const indent = Math.min(Math.max(0, this.indent()), Math.max(0, geom.totalWidth - this.bounds.width));
    return {
      x: geom.starts[col] - indent,
      y: row - this.topItem,
      width: geom.widths[col],
      height: 1,
    };
  }

  override draw(ctx: DrawContext): void {
    super.draw(ctx); // full row render (colours, dividers, virtual window)
    const display = this.display();
    if (display.length === 0) return;
    const geom = this.geometry(ctx.size.width);
    const col = this.focusedCol();
    const row = this.clampRow(this.focused());
    const y = row - this.topItem;
    if (y < 0 || y >= ctx.size.height || col < 0 || col >= this.columns.length) return;
    const indent = Math.min(Math.max(0, this.indent()), Math.max(0, geom.totalWidth - ctx.size.width));
    const x = geom.starts[col] - indent;
    const w = geom.widths[col];
    // Overpaint the focused cell in a cursor colour so the CELL (not just the row) is visible.
    const cursor = ctx.color('inputSelected');
    const cell = alignCell(this.columns[col].accessor(display[row]), w, this.columns[col].align ?? 'left', cellWidth);
    ctx.text(x, y, cell, cursor);
    if (this.isDirtyCell?.(col, row) && w > 0) ctx.text(x, y, '•', ctx.color('inputArrows'));
  }

  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'key') {
      switch (inner.key) {
        case 'left':
          this.moveCol(-1);
          ev.handled = true;
          return;
        case 'right':
          this.moveCol(1);
          ev.handled = true;
          return;
        case 'tab':
          this.tabCell(inner.shift ? -1 : 1);
          ev.handled = true;
          return;
        case 'enter':
          this.beginEdit();
          ev.handled = true;
          return;
        // ↑/↓, PgUp/PgDn, Home/End fall through to the inherited row cursor.
      }
    }
    if (inner.type === 'mouse' && inner.kind === 'down' && ev.local) {
      // Set the column from the click x, then let the base pick the row.
      this.setColFromX(ev.local.x);
    }
    super.onEvent(ev);
  }

  private moveCol(delta: number): void {
    const n = this.columns.length;
    this.focusedCol.set(Math.max(0, Math.min(this.focusedCol() + delta, n - 1)));
  }

  private tabCell(dir: number): void {
    const n = this.columns.length;
    let col = this.focusedCol() + dir;
    let row = this.focused();
    if (col >= n) {
      col = 0;
      row = this.clampRow(row + 1);
    } else if (col < 0) {
      col = n - 1;
      row = this.clampRow(row - 1);
    }
    this.focusedCol.set(col);
    this.focused.set(row);
  }

  private setColFromX(localX: number): void {
    const geom = this.geometry(this.bounds.width);
    const indent = Math.min(Math.max(0, this.indent()), Math.max(0, geom.totalWidth - this.bounds.width));
    const px = localX + indent;
    for (let c = geom.starts.length - 1; c >= 0; c -= 1) {
      if (px >= geom.starts[c]) {
        this.focusedCol.set(c);
        return;
      }
    }
  }

  private beginEdit(): void {
    const col = this.focusedCol();
    if (!this.editable[col]) return; // read-only cell: no editor
    this.onEdit?.(col, this.clampRow(this.focused()));
  }
}

/** A cell editor: an `Input` that commits on Enter and cancels on Escape (else normal editing). */
export class CellEditor extends Input {
  constructor(
    opts: InputOptions,
    private readonly onCommitKey: () => void,
    private readonly onCancelKey: () => void,
  ) {
    super(opts);
  }

  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'key') {
      if (inner.key === 'enter') {
        this.onCommitKey();
        ev.handled = true;
        return;
      }
      if (inner.key === 'escape') {
        this.onCancelKey();
        ev.handled = true;
        return;
      }
    }
    super.onEvent(ev);
  }
}

/** A view's absolute top-left by walking the parent chain (overlay-local == absolute at the origin). */
export function absoluteRect(view: View): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let node: View | null = view;
  while (node !== null) {
    x += node.bounds.x;
    y += node.bounds.y;
    node = node.parent;
  }
  return { x, y };
}
