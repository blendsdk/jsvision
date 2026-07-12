/**
 * `EditableDataGrid<T>` — the read-only grid container that composes the promoted `@jsvision/ui` grid
 * engine over the typed column model and a data source.
 *
 * It adapts each typed {@link GridColumn} to the engine's string-accessor column, materializes rows
 * from the {@link GridDataSource}, and stacks a sticky header + virtual-scroll body + scroll bars.
 * The header's click-to-sort is deliberately suppressed — the body renders in source order, so a live
 * sort arrow would mislead. An empty overlay group sits on top as the mount host for cell editors that
 * a later release adds. Interactive editing is not part of this container yet; it renders read-only.
 */
import { Group, GridRows, GridHeader, ScrollBar, measureAutoWidths, stringWidth, signal } from '@jsvision/ui';
import type { Column, SortState, LayoutProps } from '@jsvision/ui';
import type { GridColumn } from './column.js';
import { toEngineColumn } from './column.js';
import type { GridDataSource } from './data-source.js';

/** Construction options for {@link EditableDataGrid}. */
export interface EditableDataGridOptions<T> {
  /** The typed columns (authored with `column()`); adapted to the engine internally. */
  readonly columns: GridColumn<T>[];
  /** The data source (carries the required `rowKey`). */
  readonly source: GridDataSource<T>;
  /** Stripe odd rows for readability (default `false`). */
  readonly zebra?: boolean;
}

/** A grid header whose click-to-sort is suppressed — the read-only body never reorders. */
class ReadonlyGridHeader<T> extends GridHeader<T> {
  override onEvent(): void {
    // Read-only: swallow header clicks so no sort arrow is painted for an order the body never applies.
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
 * A read-only, self-drawing data grid over a typed column model and a {@link GridDataSource}. It is a
 * `Group`, so a plain instance is not itself a focus target — focus its {@link EditableDataGrid.rows}
 * body renderer. Editing arrives in a later release; today it renders read-only.
 *
 * @example
 * import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
 * import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
 *
 * interface Row { id: number; qty: number; }
 * const rows = signal<Row[]>([{ id: 1, qty: 9 }, { id: 2, qty: 1000 }]);
 * const columns = [column({ id: 'qty', title: 'Qty', value: (r: Row) => r.qty, align: 'right' })];
 *
 * const grid = new EditableDataGrid<Row>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }) });
 * grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 6 } };
 *
 * const root = new Group();
 * root.add(grid);
 * const caps = resolveCapabilities().profile;
 * const loop = createEventLoop({ width: 20, height: 6 }, { caps });
 * loop.mount(root);
 * loop.focusView(grid.rows); // focus the body renderer, not the Group
 */
export class EditableDataGrid<T> extends Group {
  /** The focusable body renderer — focus this (a plain `Group` is not a focus target). */
  readonly rows: GridRows<T>;
  /** The absolute overlay host on top of the grid — a later release mounts cell editors into it. */
  readonly overlay: Group;

  /**
   * @param opts The `columns`, the `source`, and optional `zebra` striping.
   */
  constructor(opts: EditableDataGridOptions<T>) {
    super();
    const engineCols: Column<T>[] = opts.columns.map((c) => toEngineColumn(c));
    const { source } = opts;

    // The materialized display re-runs when the source's rows change; the auto-width measure re-runs
    // when the display changes. Both are shared by the header and body so their geometry never disagrees.
    const display = this.derived(() => materialize(source));
    const autoWidths = this.derived(() => measureAutoWidths(engineCols, display(), stringWidth));

    const indent = signal(0);
    const focused = signal(0);
    const selected = signal(-1);
    const sort = signal<SortState>(null); // fixed null — the read-only header never changes it

    const header = new ReadonlyGridHeader<T>({ columns: engineCols, autoWidths, indent, sort });
    this.rows = new GridRows<T>({
      display,
      columns: engineCols,
      autoWidths,
      indent,
      focused,
      selected,
      zebra: opts.zebra ?? false,
    });
    const vbar = new ScrollBar({ value: focused, orientation: 'vertical' });
    const hbar = new ScrollBar({ value: indent, orientation: 'horizontal' });
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

    // A full-container overlay on top hosts absolutely-placed cell editors (added by a later release).
    // `position: 'fill'` makes it cover the whole grid and overlap the bands without reserving flow space.
    this.overlay = new Group();
    this.overlay.layout = { position: 'fill' };

    this.add(inner); // behind
    this.add(this.overlay); // on top
  }
}
