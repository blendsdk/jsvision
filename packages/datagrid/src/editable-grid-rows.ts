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
import type { GridRowsConfig, DispatchEvent, DrawContext, Signal } from '@jsvision/ui';
import type { KeyEvent } from '@jsvision/core';

/** Clamp `v` into `[lo, hi]` (returns `lo` when the range is empty). */
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Construction config for {@link EditableGridRows}: the base grid config plus the shared column cursor. */
export interface EditableGridRowsConfig<T> extends GridRowsConfig<T> {
  /** The shared column cursor index, owned by the container and injected (so panels can share it). */
  focusedCol: Signal<number>;
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

  /**
   * @param cfg The base grid config plus the injected {@link EditableGridRowsConfig.focusedCol}.
   */
  constructor(cfg: EditableGridRowsConfig<T>) {
    super(cfg);
    this.focusedCol = cfg.focusedCol;
    this.onMount(() => {
      // Repaint when the column cursor moves (the base already binds focused/display/selected/indent).
      this.bind(
        () => this.focusedCol(),
        () => undefined,
      );
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
    if (inner.type === 'key' && this.handleColKey(inner)) {
      ev.handled = true;
      return;
    }
    super.onEvent(ev);
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
