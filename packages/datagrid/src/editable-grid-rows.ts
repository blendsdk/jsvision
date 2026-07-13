/**
 * `EditableGridRows<T>` — the editable grid body. It subclasses the `@jsvision/ui` `GridRows` engine
 * to add a **column** cursor beside the engine's inherited **row** focus, reassigns the horizontal
 * keys to move that cursor, and overpaints the focused cell so it reads distinctly inside the
 * highlighted row. The column cursor (`focusedCol`) is owned by the container and injected, so a later
 * frozen-panel split can share the very same signal with no retrofit.
 *
 * Navigation: `←`/`→` move the column cursor; `Home`/`End` jump to the first/last column;
 * `Ctrl+Home`/`Ctrl+End` jump to the first/last cell of the whole grid. Everything else — `↑`/`↓`,
 * `PgUp`/`PgDn`, `Ctrl+PgUp`/`Ctrl+PgDn`, mouse, and wheel — falls through to the base row navigation
 * unchanged. All movement clamps to range (no wrap). `Tab`/`Shift+Tab` are intentionally not handled
 * here: an unbound Tab is consumed by the framework's focus traversal before any view sees it.
 */
import { GridRows, alignCell, stringWidth } from '@jsvision/ui';
import type { GridRowsConfig, DispatchEvent, DrawContext, Signal, Group } from '@jsvision/ui';
import type { KeyEvent } from '@jsvision/core';
import type { GridColumn } from './column.js';
import { isEditable } from './column.js';
import type { OnCommit } from './commit.js';
import type { CellRect } from './overlay.js';
import { createEditController, cellKey } from './editing.js';
import type { CellRef, EditController, DirtyRegistry } from './editing.js';

/** Clamp `v` into `[lo, hi]` (returns `lo` when the range is empty). */
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Construction config for {@link EditableGridRows}: the base grid config plus the editing wiring. */
export interface EditableGridRowsConfig<T> extends GridRowsConfig<T> {
  /** The shared column cursor index, owned by the container and injected (so panels can share it). */
  focusedCol: Signal<number>;
  /** The typed columns (parse/set/format live here; the base `columns` are the engine adapters). */
  typedColumns: GridColumn<T>[];
  /** The editor mount host (the container's absolute overlay group). */
  overlay: Group;
  /** The optional per-cell veto sink. */
  onCommit?: OnCommit<T>;
  /** The row-identity function (from the data source). */
  rowKey: (row: T) => string | number;
  /** Bump-on-write so an in-place `set` repaints the mutated row. */
  bumpVersion: () => void;
  /** The shared dirty registry (pending-commit markers); omit to disable dirty tracking. */
  dirty?: DirtyRegistry;
}

/**
 * The editable grid body — a {@link GridRows} with a two-axis cell cursor and a focused-cell overpaint.
 *
 * @example
 * ```ts
 * import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
 * import { EditableGridRows } from '@jsvision/datagrid';
 *
 * interface Row { name: string; city: string; }
 * const rows: Row[] = [{ name: 'Ada', city: 'NYC' }, { name: 'Bo', city: 'LA' }];
 * const focusedCol = signal(0);
 * const body = new EditableGridRows<Row>({
 *   display: () => rows,
 *   columns: [
 *     { title: 'Name', accessor: (r) => r.name, width: 8 },
 *     { title: 'City', accessor: (r) => r.city, width: 8 },
 *   ],
 *   autoWidths: () => [null, null],
 *   indent: signal(0),
 *   focused: signal(0),
 *   selected: signal(-1),
 *   zebra: false,
 *   focusedCol,
 * });
 * body.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 5 } };
 * const root = new Group();
 * root.add(body);
 * const caps = resolveCapabilities().profile;
 * const loop = createEventLoop({ width: 20, height: 5 }, { caps });
 * loop.mount(root);
 * loop.focusView(body); // → moves the cell cursor with the arrow keys
 * ```
 */
export class EditableGridRows<T> extends GridRows<T> {
  /** The shared column cursor index (the row axis is the base's inherited `focused`). */
  protected readonly focusedCol: Signal<number>;
  /** The typed columns (parse/set/format), parallel to the base engine `columns`. */
  protected readonly typedColumns: GridColumn<T>[];
  /** The absolute overlay group the editor mounts into. */
  protected readonly overlay: Group;
  /** The optional per-cell veto sink. */
  protected readonly onCommit?: OnCommit<T>;
  /** The row-identity function. */
  protected readonly rowKey: (row: T) => string | number;
  /** Bump-on-write repaint hook (the container owns the `version` signal). */
  protected readonly bumpVersion: () => void;
  /** The shared dirty registry (pending-commit markers), or `undefined` when dirty tracking is off. */
  protected readonly dirty?: DirtyRegistry;
  /** The in-cell editing lifecycle controller. */
  protected readonly controller: EditController;

  /**
   * @param cfg The base grid config plus the injected cursor + editing wiring (see {@link EditableGridRowsConfig}).
   */
  constructor(cfg: EditableGridRowsConfig<T>) {
    super(cfg);
    this.focusedCol = cfg.focusedCol;
    this.typedColumns = cfg.typedColumns;
    this.overlay = cfg.overlay;
    this.onCommit = cfg.onCommit;
    this.rowKey = cfg.rowKey;
    this.bumpVersion = cfg.bumpVersion;
    this.dirty = cfg.dirty;
    // The controller reaches this body only through the EditHost seam below — no access to protected state.
    this.controller = createEditController<T>({
      body: this,
      overlay: this.overlay,
      typedColumns: this.typedColumns,
      onCommit: this.onCommit,
      bumpVersion: this.bumpVersion,
      dirty: this.dirty,
      currentCell: () => this.currentCell(),
      cellRect: () => this.cellRect(),
      advanceRow: () => this.advanceRow(),
    });
    this.onMount(() => {
      // Repaint when the column cursor moves (the base already binds focused/display/selected/indent).
      this.bind(
        () => this.focusedCol(),
        () => undefined,
      );
      // Repaint when the dirty set changes, so the `•` markers appear/clear reactively.
      const registry = this.dirty;
      if (registry !== undefined) {
        this.bind(
          () => registry.keys(),
          () => undefined,
        );
      }
    });
  }

  /**
   * Route the column-cursor keys here; let everything else fall through to the base (row navigation,
   * activation, mouse, wheel).
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'key') {
      if (this.handleColKey(inner)) {
        ev.handled = true;
        return;
      }
      if (this.tryBeginEdit(inner, ev)) {
        ev.handled = true;
        return;
      }
    }
    super.onEvent(ev);
  }

  /**
   * Begin editing on F2/Enter/printable when the focused cell is editable; a read-only cell falls
   * through to the base (row activate/select), so `Enter`/`Space` still work there.
   */
  private tryBeginEdit(inner: KeyEvent, ev: DispatchEvent): boolean {
    const col = this.typedColumns[this.focusedCol()];
    if (col === undefined || !isEditable(col)) return false; // read-only → base handles it
    if (inner.key === 'f2' || inner.key === 'enter') {
      this.controller.beginEdit(ev);
      return true; // an editable cell's Enter is begin-edit, never a row activate
    }
    // A printable begins the edit and replaces the content. Detection mirrors Input.insertPrintable
    // (there is no `char` field on a key event): printable iff not a chord and a single code point.
    if (!inner.ctrl && !inner.alt && (inner.key === 'space' || [...inner.key].length === 1)) {
      this.controller.beginEdit(ev, { replaceWith: inner.key === 'space' ? ' ' : inner.key });
      return true;
    }
    return false;
  }

  /** The focused cell (row + column), or `null` when the grid is empty. */
  private currentCell(): CellRef<T> | null {
    const rows = this.display();
    if (rows.length === 0) return null;
    const row = rows[clamp(this.focused(), 0, rows.length - 1)];
    const c = clamp(this.focusedCol(), 0, this.typedColumns.length - 1);
    return { row, rowKey: this.rowKey(row), col: c, columnId: this.typedColumns[c].id };
  }

  /** The focused cell's rect in body-local coordinates (for the overlay mount). */
  private cellRect(): CellRect {
    const width = this.bounds.width;
    const geom = this.geometry(width);
    const c = clamp(this.focusedCol(), 0, this.columns.length - 1);
    const maxIndent = Math.max(0, geom.totalWidth - width);
    const indent = Math.min(maxIndent, Math.max(0, this.indent()));
    const range = this.display().length;
    const y = (range === 0 ? 0 : clamp(this.focused(), 0, range - 1)) - this.topItem;
    return { x: geom.starts[c] - indent, y, width: geom.widths[c], height: 1 };
  }

  /** Advance the row cursor to the next row (clamped), keeping the column. */
  private advanceRow(): void {
    this.focused.set(clamp(this.focused() + 1, 0, Math.max(0, this.display().length - 1)));
  }

  /** Apply a column-cursor / grid-corner key; returns whether it was consumed here. */
  private handleColKey(inner: KeyEvent): boolean {
    switch (inner.key) {
      case 'left':
        this.moveCol(-1);
        return true;
      case 'right':
        this.moveCol(1);
        return true;
      case 'home':
        if (inner.ctrl) this.gridStart();
        else this.colFirst();
        return true;
      case 'end':
        if (inner.ctrl) this.gridEnd();
        else this.colLast();
        return true;
      default:
        return false;
    }
  }

  /** Move the column cursor by `delta`, clamped to `[0, columns-1]`. */
  protected moveCol(delta: number): void {
    this.focusedCol.set(clamp(this.focusedCol() + delta, 0, this.columns.length - 1));
  }

  /** Move the column cursor to the first column. */
  protected colFirst(): void {
    this.focusedCol.set(0);
  }

  /** Move the column cursor to the last column. */
  protected colLast(): void {
    this.focusedCol.set(Math.max(0, this.columns.length - 1));
  }

  /** Jump to the first cell of the grid (top-left). */
  protected gridStart(): void {
    this.focused.set(0);
    this.focusedCol.set(0);
  }

  /** Jump to the last cell of the grid (bottom-right). */
  protected gridEnd(): void {
    this.focused.set(Math.max(0, this.display().length - 1));
    this.focusedCol.set(Math.max(0, this.columns.length - 1));
  }

  /**
   * Paint the rows (base), then overpaint the focused cell in `gridCursor`.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    super.draw(ctx); // base paints the rows (incl. the focused row in listFocused) and sets topItem
    this.paintCursorCell(ctx);
    this.paintDirtyMarkers(ctx);
  }

  /**
   * Overpaint a `•` in the `gridDirty` foreground on every visible cell that has a pending commit. The
   * marker foreground is composited over whatever background the cell already shows (the cursor cell,
   * the focused/selected row, a zebra stripe, or a normal row), so it never punches a hole in a
   * coloured row. `•` measures one cell, so it never splits a wide neighbour.
   *
   * @param ctx The clipped, view-local paint context.
   */
  protected paintDirtyMarkers(ctx: DrawContext): void {
    const registry = this.dirty;
    if (registry === undefined) return;
    const display = this.display();
    const range = display.length;
    if (range === 0) return;

    const width = ctx.size.width;
    const geom = this.geometry(width);
    const maxIndent = Math.max(0, geom.totalWidth - width);
    const indent = Math.min(maxIndent, Math.max(0, this.indent()));
    const active = this.state.focused;
    const focusedRow = clamp(this.focused(), 0, range - 1);
    const focusedCol = clamp(this.focusedCol(), 0, this.columns.length - 1);
    const selected = this.selected();
    const dirtyFg = ctx.color('gridDirty').fg;
    const cursorBg = ctx.color('gridCursor').bg;

    for (let i = 0; i < ctx.size.height; i += 1) {
      const item = this.topItem + i;
      if (item >= range) break;
      const rk = this.rowKey(display[item]);
      for (let c = 0; c < this.columns.length; c += 1) {
        const w = geom.widths[c];
        if (w <= 0 || !registry.has(cellKey(rk, this.typedColumns[c].id))) continue;
        // Recompute the cell's background so the marker composites onto it (the base's row-colour
        // priority is focused > selected > zebra > normal; the active focused cell shows the cursor bg).
        const bg =
          active && item === focusedRow && c === focusedCol
            ? cursorBg
            : item === focusedRow
              ? active
                ? ctx.color('listFocused').bg
                : ctx.color('listSelected').bg
              : item === selected
                ? ctx.color('listSelected').bg
                : this.zebra && (item & 1) === 1
                  ? ctx.color('staticText').bg
                  : ctx.color('listNormal').bg;
        ctx.text(geom.starts[c] - indent + w - 1, i, '•', { fg: dirtyFg, bg });
      }
    }
  }

  /**
   * Overpaint the focused cell as a filled `gridCursor` box with its text redrawn on top — but only
   * while the body has focus (colour-only focus, matching the base). Uses the same geometry + indent
   * clamp as the base so the box lines up exactly with the painted cell; `ctx` clips anything scrolled
   * off-screen, so no extra horizontal bounds math is needed.
   *
   * @param ctx The clipped, view-local paint context.
   */
  protected paintCursorCell(ctx: DrawContext): void {
    if (!this.state.focused) return;
    const width = ctx.size.width;
    const range = this.display().length;
    const n = this.columns.length;
    if (range === 0 || n === 0) return;

    const c = clamp(this.focusedCol(), 0, n - 1);
    const geom = this.geometry(width);
    const w = geom.widths[c];
    if (w <= 0) return;

    const focused = clamp(this.focused(), 0, range - 1);
    const y = focused - this.topItem;
    if (y < 0 || y >= ctx.size.height) return;

    const maxIndent = Math.max(0, geom.totalWidth - width);
    const indent = Math.min(maxIndent, Math.max(0, this.indent()));
    const x = geom.starts[c] - indent;

    const style = ctx.color('gridCursor');
    ctx.fillRect(x, y, w, 1, ' ', style);
    const col = this.columns[c];
    const cell = alignCell(col.accessor(this.display()[focused]), w, col.align ?? 'left', stringWidth);
    ctx.text(x, y, cell, style);
  }
}
