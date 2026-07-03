/**
 * `DataGrid<T>` — a focusable, virtual-scrolling multi-column table (RD-16): a documented Turbo
 * Vision extension on the `TListViewer` spine. Follows the twice-shipped `Group = focusable-rows-
 * renderer + owned bar` idiom (`ListView`, `Tree`), extended to a sticky header + a horizontal bar.
 *
 * The three bands (`[header 1 | body fr | hbar 1]`) live inside an **inner `col` container** so the
 * grid's own `layout` prop stays free for its parent to place it (absolute rect, or an `fr` flow
 * slot) without clobbering the internal column direction. Per PF-101 the header, rows, and hbar each
 * sit in an `fr` band beside a fixed 1-cell sibling (the vbar, or a blank corner), so all three
 * resolve to the SAME data width `W−1` and their columns align exactly (the layout engine's default
 * `align:'stretch'` would otherwise make a bare header child width `W`, drifting it one cell off the
 * `W−1` rows).
 *
 * The sorted `display` and the memoized `autoWidths` are `computed`s shared by the header (for the
 * `▲`/`▼` indicator) and the rows (for drawing); `focused`↔vbar and `indent`↔hbar are the two-way
 * signal bindings. `.js` specifiers per NodeNext.
 */
import { Group } from '../view/index.js';
import type { LayoutProps } from '../layout/index.js';
import { signal, computed } from '../reactive/index.js';
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
  /** Activation callback (Enter/Space); `index` is DISPLAY order, `row` the `T`. */
  readonly onSelect?: (index: number, row: T) => void;
  /** Command emitted on Enter/Space activation (like `Button`). */
  readonly command?: string;
  /** Stripe odd rows in `staticText` (below focus/selection in priority, AR-176; default false). */
  readonly zebra?: boolean;
}

/** A single fixed 1-cell corner (above/below the vbar), filled in the scroll-bar page colour. */
function corner(): Group {
  const cell = new Group();
  cell.background = 'scrollBarPage'; // continue the vbar column visually (blue field)
  cell.layout = { size: { kind: 'fixed', cells: 1 } };
  return cell;
}

/** A focusable multi-column table: a sticky header + a virtual-scroll body + owned V/H scroll bars. */
export class DataGrid<T> extends Group {
  /** The focusable rows renderer (the focus target — a plain `Group` is not itself a focus leaf). */
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

    // The O(rows) auto measure re-runs only on a data change (PF-102); the sorted display re-runs on
    // a data or sort change (AR-158). Both are shared by the header and the rows.
    const autoWidths = computed(() => measureAutoWidths(columns, opts.rows(), stringWidth));
    const display = computed(() => sortRows(opts.rows(), columns, this.sort()));

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
    this.rows.vbar = this.vbar; // the rows renderer re-limits both bars each draw (TV setRange)
    this.rows.hbar = this.hbar;

    // Band layout (PF-101 width-matching): header/rows/hbar each `fr` beside a fixed 1-cell sibling.
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

  /** Drive the sort signal programmatically (Should-Have, AR-175). */
  sortBy(col: number, dir: 'asc' | 'desc'): void {
    this.sort.set({ col, dir });
  }
}
