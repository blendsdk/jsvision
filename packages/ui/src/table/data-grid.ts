/**
 * `DataGrid<T>` — a focusable, virtual-scrolling, multi-column table widget with a sticky header,
 * per-column sizing/alignment, click-to-sort, horizontal scrolling, and owned vertical + horizontal
 * scroll bars. See the {@link DataGrid} class for the full description and a worked example.
 *
 * Internally the three bands (header row, scrolling body, horizontal-bar row) live inside an inner
 * column container so the grid's own `layout` prop stays free for its parent to place it (an absolute
 * rect, or an `fr` flow slot) without disturbing the internal stacking. The header, rows, and
 * horizontal bar each sit in an `fr` band beside a fixed 1-cell sibling (the vertical bar, or a blank
 * corner) so all three resolve to the same data width and their columns line up exactly.
 */
import { Group } from '../view/index.js';
import type { LayoutProps } from '../layout/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { ScrollBar } from '../scroll/index.js';
import { stringWidth } from '../controls/measure.js';
import type { Column, SortState } from './columns.js';
import { measureAutoWidths, sortRows } from './columns.js';
import { GridRows, GridHeader } from './grid-rows.js';

// Re-export the column types so `DataGrid` + its types come from one place (the barrel re-exports too).
export type { Column, ColumnWidth, ColumnAlign, SortState, ColumnGeometry } from './columns.js';

/** Construction options for {@link DataGrid}. */
export interface DataGridOptions<T> {
  /** The source rows (source order; the grid sorts the *display* only). */
  readonly rows: Signal<T[]>;
  /** The heterogeneous columns (title + accessor + sizing + optional align/compare/min-max). */
  readonly columns: Column<T>[];
  /** The focused (highlighted) POSITIONAL display index (default an internal signal at 0). */
  readonly focused?: Signal<number>;
  /** The selected (chosen) display index (default an internal signal at -1). */
  readonly selected?: Signal<number>;
  /** The active sort (default an internal signal at `null` = source order). */
  readonly sort?: Signal<SortState>;
  /** The horizontal cell offset (default an internal signal at 0; shared with the horizontal bar). */
  readonly indent?: Signal<number>;
  /** Activation callback (Enter/Space or double-click); `index` is the display-order row, `row` the value. */
  readonly onSelect?: (index: number, row: T) => void;
  /** Command name emitted on Enter/Space activation, handled elsewhere (menu/status/app handler). */
  readonly command?: string;
  /** Stripe odd rows for readability (below focus/selection in priority; default false). */
  readonly zebra?: boolean;
}

/** A single fixed 1-cell corner (above/below the vbar), filled in the scroll-bar page colour. */
function corner(): Group {
  const cell = new Group();
  cell.background = 'scrollBarPage'; // continue the vbar column visually (blue field)
  cell.layout = { size: { kind: 'fixed', cells: 1 } };
  return cell;
}

/**
 * A focusable, multi-column data table: a sticky header row, a virtual-scrolling body that only
 * paints its visible window (so it stays fast over large datasets), and owned vertical + horizontal
 * scroll bars.
 *
 * The grid is generic over the row type `T`. Each {@link Column} supplies a `title`, an `accessor`
 * that renders a row to its cell string, a sizing rule (`fixed`, `${n}fr`, or `auto`), and optional
 * `align`/`compare`/`minWidth`/`maxWidth`. Keyboard: ↑↓ move focus, PgUp/PgDn page, Home/End,
 * Ctrl+PgUp/PgDn jump to ends, ←→ scroll horizontally, Enter/Space activate. Clicking a header cell
 * toggles that column's sort (ascending, then descending on re-click).
 *
 * The `rows`/`columns` and the optional state signals (`focused`, `selected`, `sort`, `indent`) are
 * caller-owned so you can read and drive them from outside. Because a plain `Group` is not itself a
 * focus target, focus the grid's exposed {@link DataGrid.rows} renderer, not the grid.
 *
 * @example
 * import { Group, DataGrid, createEventLoop, signal } from '@jsvision/ui';
 * import type { Column, SortState } from '@jsvision/ui';
 *
 * interface Person { name: string; age: number; role: string; }
 *
 * const rows = signal<Person[]>([
 *   { name: 'Alice Johnson', age: 30, role: 'Engineer' },
 *   { name: 'Bob Smith', age: 25, role: 'Designer' },
 * ]);
 * const sort = signal<SortState>(null);
 *
 * const columns: Column<Person>[] = [
 *   { title: 'Name', accessor: (p) => p.name, width: 14 },
 *   { title: 'Age', accessor: (p) => String(p.age), width: 5, align: 'right', compare: (a, b) => a.age - b.age },
 *   { title: 'Role', accessor: (p) => p.role, width: 'auto' },
 * ];
 *
 * const grid = new DataGrid<Person>({ rows, columns, sort, zebra: true });
 * grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 10 } };
 *
 * const root = new Group();
 * root.add(grid);
 * const loop = createEventLoop({ width: 40, height: 10 });
 * loop.mount(root);
 * loop.focusView(grid.rows); // focus the rows renderer, not the grid
 */
export class DataGrid<T> extends Group {
  /** The focusable rows renderer — focus this (a plain `Group` is not itself a focus target). */
  readonly rows: GridRows<T>;
  /** The focused-index signal (shared with the vertical bar), exposed for binding. */
  readonly focused: Signal<number>;
  /** The selected-index signal, exposed for binding (`-1` = none). */
  readonly selected: Signal<number>;
  /** The active-sort signal, exposed for binding. */
  readonly sort: Signal<SortState>;
  /** The horizontal cell offset (shared with the horizontal bar), exposed for binding. */
  readonly indent: Signal<number>;
  /** The sticky header renderer. */
  protected readonly header: GridHeader<T>;
  /** The owned vertical scroll bar (value = `focused`). */
  protected readonly vbar: ScrollBar;
  /** The owned horizontal scroll bar (value = `indent`). */
  protected readonly hbar: ScrollBar;

  /**
   * @param opts `rows` + `columns` + optional `focused`/`selected`/`sort`/`indent` signals,
   *   `onSelect`/`command`, `zebra`.
   */
  constructor(opts: DataGridOptions<T>) {
    super();
    this.focused = opts.focused ?? signal(0);
    this.selected = opts.selected ?? signal(-1);
    this.sort = opts.sort ?? signal<SortState>(null);
    this.indent = opts.indent ?? signal(0);
    const columns = opts.columns;

    // The O(rows) auto-width measure re-runs only when the data changes; the sorted display re-runs
    // on a data or sort change. Both are shared by the header and the rows so they never disagree.
    const autoWidths = this.derived(() => measureAutoWidths(columns, opts.rows(), stringWidth));
    const display = this.derived(() => sortRows(opts.rows(), columns, this.sort()));

    this.header = new GridHeader<T>({ columns, autoWidths, indent: this.indent, sort: this.sort });
    this.rows = new GridRows<T>({
      display,
      columns,
      autoWidths,
      indent: this.indent,
      focused: this.focused,
      selected: this.selected,
      zebra: opts.zebra ?? false,
      onSelect: opts.onSelect,
      command: opts.command,
    });
    this.vbar = new ScrollBar({ value: this.focused, orientation: 'vertical' });
    this.hbar = new ScrollBar({ value: this.indent, orientation: 'horizontal' });
    this.rows.vbar = this.vbar; // the rows renderer re-limits both bars' ranges on every draw
    this.rows.hbar = this.hbar;

    // Band layout: header/rows/hbar each `fr` beside a fixed 1-cell sibling so all three resolve to
    // the same data width and their columns align.
    const fr: LayoutProps = { size: { kind: 'fr', weight: 1 } };
    const cell: LayoutProps = { size: { kind: 'fixed', cells: 1 } };
    this.header.layout = fr;
    this.rows.layout = fr;
    this.vbar.layout = cell;
    this.hbar.layout = fr;

    const topRow = new Group();
    topRow.layout = { direction: 'row', size: { kind: 'fixed', cells: 1 } };
    topRow.add(this.header);
    topRow.add(corner());

    const body = new Group();
    body.layout = { direction: 'row', size: { kind: 'fr', weight: 1 } };
    body.add(this.rows); // z-order: rows (left) then vbar (right)
    body.add(this.vbar);

    const botRow = new Group();
    botRow.layout = { direction: 'row', size: { kind: 'fixed', cells: 1 } };
    botRow.add(this.hbar);
    botRow.add(corner());

    // Inner column container: keeps the three bands stacked regardless of how the parent places the
    // grid (an absolute rect or an `fr` flow slot both leave the grid's own `layout` free).
    const inner = new Group();
    inner.layout = { direction: 'col', size: { kind: 'fr', weight: 1 } };
    inner.add(topRow);
    inner.add(body);
    inner.add(botRow);
    this.add(inner);
  }

  /**
   * Set the active sort programmatically (equivalent to clicking a header).
   *
   * @param col The column index to sort by.
   * @param dir `'asc'` or `'desc'`.
   */
  sortBy(col: number, dir: 'asc' | 'desc'): void {
    this.sort.set({ col, dir });
  }
}
