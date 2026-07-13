/**
 * `EditableDataGrid<T>` — a data-grid container that composes the promoted `@jsvision/ui` grid engine
 * over the typed column model and a data source, with in-cell editing.
 *
 * It adapts each typed {@link GridColumn} to the engine's string-accessor column, materializes rows
 * from the {@link GridDataSource}, and stacks a sticky header + virtual-scroll body + scroll bars. The
 * body is an {@link EditableGridRows} with a two-axis (row + column) cursor; focus it and use the arrow
 * keys to move the cursor, `F2`/`Enter`/a printable to edit an editable cell, and `Enter` to commit
 * through the optional {@link EditableDataGridOptions.onCommit} veto sink. The container **owns** the
 * shared cursor/selection/scroll signals and injects them into the body, so a later frozen-panel split
 * can bind the very same signals. The header's click-to-sort is deliberately suppressed — the body
 * renders in source order, so a live sort arrow would mislead. An absolute overlay on top hosts the
 * cell editor while an edit is open.
 */
import { Group, GridHeader, ScrollBar, measureAutoWidths, stringWidth, signal } from '@jsvision/ui';
import type { Column, SortState, LayoutProps } from '@jsvision/ui';
import type { GridColumn } from './column.js';
import { toEngineColumn } from './column.js';
import type { GridDataSource } from './data-source.js';
import type { OnCommit } from './commit.js';
import { EditableGridRows } from './editable-grid-rows.js';
import { createDirtyRegistry, cellKey } from './editing.js';

/** Construction options for {@link EditableDataGrid}. */
export interface EditableDataGridOptions<T> {
  /** The typed columns (authored with `column()`); adapted to the engine internally. */
  readonly columns: GridColumn<T>[];
  /** The data source (carries the required `rowKey`). */
  readonly source: GridDataSource<T>;
  /** Stripe odd rows for readability (default `false`). */
  readonly zebra?: boolean;
  /** The per-cell veto sink — accept or reject each edit (see {@link OnCommit}). */
  readonly onCommit?: OnCommit<T>;
}

/** A grid header whose click-to-sort is suppressed — the body renders in source order. */
class ReadonlyGridHeader<T> extends GridHeader<T> {
  override onEvent(): void {
    // Sorting is a later feature: swallow header clicks so no sort arrow is painted for an order the
    // body never applies.
  }
}

/** Collect the source's currently-available rows into a dense array (skipping any not-yet-loaded holes). */
function materialize<T>(source: GridDataSource<T>): T[] {
  const n = source.length();
  const out: T[] = [];
  for (let i = 0; i < n; i += 1) {
    const row = source.rowAt(i);
    if (row !== undefined) out.push(row); // type-guard narrows T | undefined to T (eager sources fill every slot)
  }
  return out;
}

/** A fixed 1-cell corner filled in the scroll-bar page colour, so the bar columns read continuously. */
function corner(): Group {
  const cell = new Group();
  cell.background = 'scrollBarPage';
  cell.layout = { size: { kind: 'fixed', cells: 1 } };
  return cell;
}

/**
 * An editable, self-drawing data grid over a typed column model and a {@link GridDataSource}. It is a
 * `Group`, so a plain instance is not itself a focus target — focus its {@link EditableDataGrid.rows}
 * body renderer to move the cursor and edit.
 *
 * @example
 * import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
 * import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
 *
 * interface Row { id: number; name: string; }
 * const rows = signal<Row[]>([{ id: 1, name: 'Ada' }, { id: 2, name: 'Bo' }]);
 * const columns = [
 *   column({
 *     id: 'name', title: 'Name',
 *     value: (r: Row) => r.name,
 *     parse: (t) => t,                 // editable: parse + set present
 *     set: (r, v) => { r.name = v; },
 *   }),
 * ];
 *
 * const grid = new EditableDataGrid<Row>({
 *   columns,
 *   source: fromRows(rows, { rowKey: (r) => r.id }),
 *   onCommit: (c) => String(c.value).trim().length > 0, // veto an empty name
 * });
 * grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 6 } };
 *
 * const root = new Group();
 * root.add(grid);
 * const caps = resolveCapabilities().profile;
 * const loop = createEventLoop({ width: 20, height: 6 }, { caps });
 * loop.mount(root);
 * loop.focusView(grid.rows); // focus the body: arrow keys move, F2/Enter/type edits, Enter commits
 */
export class EditableDataGrid<T> extends Group {
  /** The focusable body renderer — focus this (a plain `Group` is not a focus target). */
  readonly rows: EditableGridRows<T>;
  /** The absolute overlay host on top of the grid — the cell editor mounts into it while editing. */
  readonly overlay: Group;

  // Container-owned shared cursor/selection/scroll state — the body binds these signals, and a later
  // frozen-panel split can bind the very same ones with no retrofit.
  private readonly focused = signal(0);
  private readonly focusedCol = signal(0);
  private readonly selected = signal(-1);
  private readonly indent = signal(0);
  // Bump-on-write: an in-place cell `set` mutates the record without changing the rows array identity,
  // so the display computed reads this version to force a repaint of the mutated row.
  private readonly version = signal(0);
  private readonly dirty = createDirtyRegistry();

  /**
   * @param opts The `columns`, the `source`, optional `zebra` striping, and an optional `onCommit`
   *   veto sink.
   */
  constructor(opts: EditableDataGridOptions<T>) {
    super();
    const engineCols: Column<T>[] = opts.columns.map((c) => toEngineColumn(c));
    const { source } = opts;

    // The materialized display re-runs when the source's rows change or a cell is written in place
    // (via `version`); the auto-width measure re-runs when the display changes. Both are shared by the
    // header and body so their geometry never disagrees.
    const display = this.derived(() => {
      this.version();
      return materialize(source);
    });
    const autoWidths = this.derived(() => measureAutoWidths(engineCols, display(), stringWidth));

    const sort = signal<SortState>(null); // fixed null — the read-only header never changes it

    // The overlay is built before the body because the body's config references it as the editor host.
    this.overlay = new Group();
    this.overlay.layout = { position: 'fill' };

    const header = new ReadonlyGridHeader<T>({ columns: engineCols, autoWidths, indent: this.indent, sort });
    this.rows = new EditableGridRows<T>({
      display,
      columns: engineCols,
      autoWidths,
      indent: this.indent,
      focused: this.focused,
      selected: this.selected,
      zebra: opts.zebra ?? false,
      focusedCol: this.focusedCol,
      typedColumns: opts.columns,
      overlay: this.overlay,
      onCommit: opts.onCommit,
      rowKey: source.rowKey,
      bumpVersion: () => this.version.set(this.version() + 1),
      dirty: this.dirty,
    });
    const vbar = new ScrollBar({ value: this.focused, orientation: 'vertical' });
    const hbar = new ScrollBar({ value: this.indent, orientation: 'horizontal' });
    this.rows.vbar = vbar; // the body re-limits both bars' ranges on every draw
    this.rows.hbar = hbar;

    // Band layout: header/body/hbar each `fr` beside a fixed 1-cell sibling so all three resolve to the
    // same data width and their columns line up exactly.
    const fr: LayoutProps = { size: { kind: 'fr', weight: 1 } };
    const fixed1: LayoutProps = { size: { kind: 'fixed', cells: 1 } };
    header.layout = fr;
    this.rows.layout = fr;
    vbar.layout = fixed1;
    hbar.layout = fr;

    const topRow = new Group();
    topRow.layout = { direction: 'row', size: { kind: 'fixed', cells: 1 } };
    topRow.add(header);
    topRow.add(corner());

    const bodyRow = new Group();
    bodyRow.layout = { direction: 'row', size: { kind: 'fr', weight: 1 } };
    bodyRow.add(this.rows);
    bodyRow.add(vbar);

    const botRow = new Group();
    botRow.layout = { direction: 'row', size: { kind: 'fixed', cells: 1 } };
    botRow.add(hbar);
    botRow.add(corner());

    // The bands stack in an inner column container so the grid's own `layout` prop stays free for the
    // parent to place it (absolute rect or an `fr` flow slot).
    const inner = new Group();
    inner.layout = { direction: 'col', size: { kind: 'fr', weight: 1 } };
    inner.add(topRow);
    inner.add(bodyRow);
    inner.add(botRow);

    this.add(inner); // behind
    this.add(this.overlay); // on top — hosts the cell editor while editing
  }

  /**
   * Whether a specific cell has an unresolved (pending) commit. Reactive — reading it inside an effect
   * re-runs when the cell's pending state changes.
   *
   * @param rowKey The edited row's stable key.
   * @param columnId The edited column id.
   * @returns `true` while the cell's commit is in flight, `false` once it resolves.
   */
  isDirty(rowKey: string | number, columnId: string): boolean {
    return this.dirty.has(cellKey(rowKey, columnId));
  }

  /**
   * Whether any cell in a row has a pending commit. Reactive (see {@link EditableDataGrid.isDirty}).
   *
   * @param rowKey The row's stable key.
   * @returns `true` if at least one cell in the row is pending.
   */
  isRowDirty(rowKey: string | number): boolean {
    const prefix = cellKey(rowKey, ''); // `${rowKey}` + the NUL separator — the whole-row key prefix
    for (const k of this.dirty.keys()) if (k.startsWith(prefix)) return true;
    return false;
  }

  /**
   * Whether any cell anywhere in the grid has a pending commit. Reactive (see {@link EditableDataGrid.isDirty}).
   *
   * @returns `true` if at least one cell is pending.
   */
  isGridDirty(): boolean {
    return this.dirty.keys().size > 0;
  }
}
