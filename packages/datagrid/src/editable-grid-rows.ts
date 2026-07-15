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
import { safeRender } from './cell-draw.js';
import type { RenderCell } from './cell-draw.js';

/** Clamp `v` into `[lo, hi]` (returns `lo` when the range is empty). */
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** The largest local column index whose region contains content-space x `px`, or -1 when outside. */
function columnAtX(starts: readonly number[], px: number): number {
  for (let c = starts.length - 1; c >= 0; c -= 1) if (px >= starts[c]) return c;
  return -1;
}

/** The inter-column divider drawn at each column's right edge (matches the base engine). */
const DIVIDER = '│';
/** The placeholder drawn once, top-left, for an empty grid (matches the base engine). */
const EMPTY_TEXT = '<empty>';

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
  /**
   * This panel's start index in the GLOBAL column order (default `0`). In a frozen-panel grid the
   * shared `focusedCol` is a single global index; a panel owns `[columnOffset, columnOffset + count)`
   * and maps the global cursor to its local column via this offset. `0` for a single body.
   */
  columnOffset?: number;
  /**
   * The GLOBAL visible column count (default: this panel's own column count). The cursor keys move
   * `focusedCol` over `[0, totalCols())`; a single body's `totalCols` is just its column count, so its
   * navigation is unchanged.
   */
  totalCols?: () => number;
  /**
   * Called when a cursor move lands `focusedCol` outside this panel's range, so the container can
   * re-focus the panel that now owns the cursor (a leaf-focus hop). Omitted for a single body.
   */
  onCursorEnterPanel?: (globalCol: number, ev: DispatchEvent) => void;
  /** When set, a mouse-down sets the global column cursor to the clicked column (frozen-panel mode). */
  mouseColumns?: boolean;
  /** When set, moving the cursor to an off-screen column scrolls this panel to reveal it (center panel). */
  autoScrollColumns?: boolean;
  /**
   * Grid-wide focus predicate (frozen-panel mode). When set, the focused-row highlight, the cursor
   * cell, and the dirty markers light up whenever *any* sibling panel holds focus — not only this
   * one — so the shared row cursor reads as one continuous row across the frozen boundary. Omit for a
   * single body (focus is then this view's own).
   */
  panelActive?: () => boolean;
  /**
   * A reactive column-geometry trigger. Bound for repaint so a change to a column's width override
   * (a live resize / auto-fit) re-apportions and repaints — `draw` reads widths through the column
   * objects but does not auto-track, so this explicit read is what schedules the repaint. Omit when the
   * grid has no resizable columns.
   */
  widthTick?: () => unknown;
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
  /** This panel's start index in the global column order (`0` for a single body). */
  readonly columnOffset: number;
  /** This panel's own column count (the length of its column slice). */
  readonly columnCount: number;
  /** The global visible column count (defaults to this panel's own count). */
  private readonly totalColsFn: () => number;
  /** Re-focus hop when the cursor leaves this panel's range (frozen-panel mode). */
  private readonly onCursorEnterPanel?: (globalCol: number, ev: DispatchEvent) => void;
  /** Whether a mouse-down sets the global column cursor (frozen-panel mode). */
  private readonly mouseColumns: boolean;
  /** Whether moving the cursor off-screen scrolls this panel to reveal it (center panel). */
  private readonly autoScrollColumns: boolean;
  /** Grid-wide focus predicate (frozen-panel mode); `undefined` for a single body. */
  private readonly panelActive?: () => boolean;
  /** Reactive column-width trigger (bound for repaint on a live resize/auto-fit); `undefined` when off. */
  private readonly widthTick?: () => unknown;
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
    this.columnOffset = cfg.columnOffset ?? 0;
    this.columnCount = cfg.columns.length;
    this.totalColsFn = cfg.totalCols ?? (() => this.columns.length);
    this.onCursorEnterPanel = cfg.onCursorEnterPanel;
    this.mouseColumns = cfg.mouseColumns ?? false;
    this.autoScrollColumns = cfg.autoScrollColumns ?? false;
    this.panelActive = cfg.panelActive;
    this.widthTick = cfg.widthTick;
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
      // Repaint when a column width override changes (a live resize/auto-fit) so the geometry re-flows.
      if (this.widthTick !== undefined) {
        this.bind(
          () => this.widthTick!(),
          () => undefined,
        );
      }
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
      if (this.handleColKey(inner, ev)) {
        ev.handled = true;
        return;
      }
      if (this.tryBeginEdit(inner, ev)) {
        ev.handled = true;
        return;
      }
    }
    // Frozen-panel mode: a click sets the global column cursor to the clicked column, then the base
    // focuses/selects the row. A single body (mouseColumns off) keeps its click behavior unchanged.
    if (inner.type === 'mouse' && inner.kind === 'down' && this.mouseColumns) {
      this.setColFromClick(ev);
    }
    super.onEvent(ev);
  }

  /** Set the global column cursor from a mouse-down x (frozen-panel mode). */
  private setColFromClick(ev: DispatchEvent): void {
    const local = ev.local;
    if (local === undefined || this.columns.length === 0) return;
    const width = this.bounds.width;
    const geom = this.geometry(width);
    const maxIndent = Math.max(0, geom.totalWidth - width);
    const indent = Math.min(maxIndent, Math.max(0, this.indent()));
    const c = columnAtX(geom.starts, local.x + indent);
    if (c >= 0) this.focusedCol.set(this.columnOffset + c);
  }

  /**
   * Begin editing on F2/Enter/printable when the focused cell is editable; a read-only cell falls
   * through to the base (row activate/select), so `Enter`/`Space` still work there.
   */
  private tryBeginEdit(inner: KeyEvent, ev: DispatchEvent): boolean {
    const c = this.localCol();
    if (c < 0) return false; // the cursor is in another panel — not ours to edit
    const col = this.typedColumns[c];
    if (col === undefined || !isEditable(col)) return false; // read-only → base handles it
    if (inner.key === 'f2' || inner.key === 'enter') {
      this.controller.beginEdit(ev);
      return true; // an editable cell's Enter is begin-edit, never a row activate
    }
    if (inner.key === 'f4') {
      this.controller.beginEdit(ev, { openDropdown: true });
      return true; // value help: begin the edit and open the dropdown (a ComboBox editor) in one press
    }
    // A printable begins the edit and replaces the content. Detection mirrors Input.insertPrintable
    // (there is no `char` field on a key event): printable iff not a chord and a single code point.
    if (!inner.ctrl && !inner.alt && (inner.key === 'space' || [...inner.key].length === 1)) {
      this.controller.beginEdit(ev, { replaceWith: inner.key === 'space' ? ' ' : inner.key });
      return true;
    }
    return false;
  }

  /** The focused cell (row + column), or `null` when the grid is empty. `col` is this panel's LOCAL index. */
  private currentCell(): CellRef<T> | null {
    const rows = this.display();
    if (rows.length === 0) return null;
    const row = rows[clamp(this.focused(), 0, rows.length - 1)];
    const c = clamp(Math.max(0, this.localCol()), 0, this.typedColumns.length - 1);
    return { row, rowKey: this.rowKey(row), col: c, columnId: this.typedColumns[c].id };
  }

  /** The focused cell's rect in body-local coordinates (for the overlay mount). */
  private cellRect(): CellRect {
    const width = this.bounds.width;
    const geom = this.geometry(width);
    const c = clamp(Math.max(0, this.localCol()), 0, this.columns.length - 1);
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

  /**
   * Apply a column-cursor / grid-corner key; returns whether it was consumed. The cursor is a single
   * GLOBAL index over `[0, totalCols())`, so `←`/`→` cross a frozen-panel boundary (a linear sequence)
   * and `Home`/`End` reach the first/last column of the whole grid; `Ctrl+Home`/`Ctrl+End` also jump
   * the row. For a single body `totalCols` is its own column count, so this is unchanged.
   */
  private handleColKey(inner: KeyEvent, ev: DispatchEvent): boolean {
    switch (inner.key) {
      case 'left':
        this.setGlobalCol(this.focusedCol() - 1, ev);
        return true;
      case 'right':
        this.setGlobalCol(this.focusedCol() + 1, ev);
        return true;
      case 'home':
        if (inner.ctrl) this.focused.set(0);
        this.setGlobalCol(0, ev);
        return true;
      case 'end':
        if (inner.ctrl) this.focused.set(Math.max(0, this.display().length - 1));
        this.setGlobalCol(this.totalCols() - 1, ev);
        return true;
      default:
        return false;
    }
  }

  /** The global visible column count (a single body's own count by default). */
  protected totalCols(): number {
    return this.totalColsFn();
  }

  /** This panel's local cursor index, or -1 when the global cursor is in another panel. */
  protected localCol(): number {
    const l = this.focusedCol() - this.columnOffset;
    return l >= 0 && l < this.columns.length ? l : -1;
  }

  /**
   * Whether the grid (this view or, in frozen-panel mode, any sibling panel) currently holds focus —
   * the focus test the row highlight, cursor cell, and dirty markers key on. A single body reports its
   * own focus; a frozen panel defers to the container's `panelActive` predicate (which reactively reads
   * every panel's focus tick) so the shared row cursor lights up as one row across the freeze boundary.
   */
  protected gridActive(): boolean {
    return this.panelActive ? this.panelActive() : this.state.focused;
  }

  /**
   * Set the GLOBAL column cursor (clamped to `[0, totalCols)`); auto-scroll this panel to reveal the
   * column if it lands here (center panel), and — if it lands in another panel — ask the container to
   * re-focus the panel that now owns the cursor (a leaf-focus hop). Single body: no hop, no auto-scroll.
   */
  protected setGlobalCol(g: number, ev: DispatchEvent): void {
    const clamped = clamp(g, 0, Math.max(0, this.totalCols() - 1));
    this.focusedCol.set(clamped);
    this.autoScrollToCol(clamped);
    const inThisPanel = clamped >= this.columnOffset && clamped < this.columnOffset + this.columns.length;
    if (!inThisPanel) this.onCursorEnterPanel?.(clamped, ev);
  }

  /** Scroll this panel horizontally so the focused column is visible (center panel only). */
  private autoScrollToCol(g: number): void {
    if (!this.autoScrollColumns) return;
    const local = g - this.columnOffset;
    if (local < 0 || local >= this.columns.length) return; // cursor not in this panel
    const width = this.bounds.width;
    if (width <= 0) return;
    const geom = this.geometry(width);
    const start = geom.starts[local];
    const end = start + geom.widths[local];
    const maxIndent = Math.max(0, geom.totalWidth - width);
    let indent = Math.min(maxIndent, Math.max(0, this.indent()));
    if (start < indent)
      indent = start; // scroll left to reveal
    else if (end > indent + width) indent = Math.min(maxIndent, end - width); // scroll right
    if (indent !== this.indent()) this.indent.set(indent);
  }

  /**
   * Paint the visible window with per-cell resolution: each row is blanked in its resolved colour
   * (focused > selected > zebra > normal), then every cell is drawn under the fixed precedence
   * cursor > dirty > selected-row > cellStyle > zebra > normal — a column's `cellStyle` colours a cell
   * only when no higher row state owns it, and a column's `render` paints custom content into a
   * cell-local, cell-clipped context (draw-error isolated). The cursor + dirty overpaints run last, so
   * they always win. The no-hook path paints byte-identically to the base engine.
   *
   * This is a self-contained override rather than a `super.draw()` call because the base blanks a whole
   * row in one colour via its string accessor, leaving no seam for per-cell colour or custom content.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const width = ctx.size.width;
    const rows = ctx.size.height;
    const display = this.display();
    const range = display.length;
    const geom = this.geometry(width);
    // Re-limit both scroll bars exactly as the base does (value=focused / indent, page keeps one line).
    this.vbar?.setRange(0, Math.max(0, range - 1), Math.max(1, rows - 1));
    const maxIndent = Math.max(0, geom.totalWidth - width);
    this.hbar?.setRange(0, maxIndent, Math.max(1, width - 1));
    const indent = Math.min(maxIndent, Math.max(0, this.indent()));

    const normal = ctx.color('listNormal');
    if (range === 0) {
      ctx.fill(' ', normal);
      ctx.text(1, 0, EMPTY_TEXT, normal); // <empty> placeholder, one cell in from the left
      return;
    }

    // Keep the (clamped) focused row visible. The base's `keepVisible`/`clampIndex` free functions are
    // module-private to the engine, so drive the inherited protected helper instead.
    this.updateTop();
    const top = this.topItem;
    const focusedRow = clamp(this.focused(), 0, range - 1);
    const focusedCol = this.localCol(); // -1 when the cursor is in another panel → no cursor cell here
    const active = this.gridActive();
    const selected = this.selected();
    const divider = ctx.color('listDivider');

    for (let i = 0; i < rows; i += 1) {
      const item = top + i;
      if (item >= range) {
        ctx.fillRect(0, i, width, 1, ' ', normal); // blank trailing row
        continue;
      }
      const row = display[item];
      const isFocusedRow = item === focusedRow;
      const isSelectedRow = item === selected;
      const zebra = this.zebra && (item & 1) === 1;
      // Row colour priority: focused > selected > zebra stripe > normal (unchanged from the base).
      const roleName = isFocusedRow
        ? active
          ? 'listFocused'
          : 'listSelected'
        : isSelectedRow
          ? 'listSelected'
          : zebra
            ? 'staticText'
            : 'listNormal';
      const rowStyle = ctx.color(roleName);
      ctx.fillRect(0, i, width, 1, ' ', rowStyle); // blank the row in its colour

      // cellStyle is suppressed while a higher-precedence row state owns the row (this enforces
      // selected > cellStyle, and — with the cursor overpaint below — cursor > cellStyle).
      const rowOwns = isFocusedRow || isSelectedRow;

      for (let c = 0; c < this.columns.length; c += 1) {
        const col = this.columns[c];
        const tcol = this.typedColumns[c];
        const w = geom.widths[c];
        const x = geom.starts[c] - indent;

        let cellStyle = rowStyle;
        if (!rowOwns && tcol.cellStyle !== undefined) {
          const resolved = tcol.cellStyle(tcol.value(row), row);
          cellStyle = typeof resolved === 'string' ? ctx.color(resolved) : resolved;
          ctx.fillRect(x, i, w, 1, ' ', cellStyle); // blank the cell in its conditional colour
        }

        if (tcol.render !== undefined) {
          const cell: RenderCell<T, unknown> = {
            x,
            y: i,
            width: w,
            value: tcol.value(row),
            row,
            state: {
              focused: active && isFocusedRow && c === focusedCol,
              selected: isSelectedRow,
              dirty: this.dirty?.has(cellKey(this.rowKey(row), tcol.id)) ?? false,
              zebra,
            },
          };
          safeRender(ctx, x, i, w, cellStyle, tcol.render, cell); // draw-error isolated
        } else {
          const text = alignCell(col.accessor(row), w, col.align ?? 'left', stringWidth);
          ctx.text(x, i, text, cellStyle); // ctx clips off-screen cells (H-scroll)
        }
        ctx.text(x + w, i, DIVIDER, divider); // divider at the column right edge
      }
    }

    this.paintCursorCell(ctx); // final overpaints — cursor and dirty always win
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
    const active = this.gridActive();
    const focusedRow = clamp(this.focused(), 0, range - 1);
    const focusedCol = this.localCol(); // -1 when the cursor is in another panel → no cursor cell here
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
   * while the grid has focus (this body, or any sibling panel in frozen mode; colour-only focus,
   * matching the base) and this panel owns the global cursor column. Uses the same geometry + indent
   * clamp as the base so the box lines up exactly with the painted cell; `ctx` clips anything scrolled
   * off-screen, so no extra horizontal bounds math is needed.
   *
   * @param ctx The clipped, view-local paint context.
   */
  protected paintCursorCell(ctx: DrawContext): void {
    if (!this.gridActive()) return;
    const width = ctx.size.width;
    const range = this.display().length;
    const n = this.columns.length;
    if (range === 0 || n === 0) return;

    const c = this.localCol(); // the cursor cell is painted only by the panel that owns the cursor
    if (c < 0) return;
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
