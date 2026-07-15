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
 * can bind the very same signals. Clicking a header sorts by that column's typed value (Ctrl+click
 * builds a multi-key priority sort); the body reflects the container's live sort model. An absolute
 * overlay on top hosts the cell editor while an edit is open.
 */
import { Group, ScrollBar, measureAutoWidths, stringWidth, signal } from '@jsvision/ui';
import type { Column, DispatchEvent, LayoutProps, View } from '@jsvision/ui';
import type { GridColumn } from './column.js';
import { toEngineColumn } from './column.js';
import type { GridDataSource } from './data-source.js';
import { sortRowsMulti } from './sort.js';
import type { SortKey, SortDir } from './sort.js';
import { filterRows } from './filter.js';
import type { FilterModel, ColumnFilter } from './filter.js';
import { SortHeader } from './sort-header.js';
import { QuickFilterRow } from './quick-filter-row.js';
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
  /**
   * Show the opt-in quick-filter row — a band of per-column text inputs below the header that drive a
   * live `contains` filter as you type (default `false`; the band is never built when off).
   */
  readonly quickFilter?: boolean;
  /** The per-cell veto sink — accept or reject each edit (see {@link OnCommit}). */
  readonly onCommit?: OnCommit<T>;
}

/**
 * The editor overlay host. It is a full-grid `fill` layer that hosts the in-cell editor while an edit
 * is open, so it must be **transparent to hit-testing while empty** — otherwise the `fill` layer would
 * sit on top of the header and body and swallow every click (a header/body click bubbles up its own
 * ancestors, never across to the overlay's siblings). It stays hidden until it has a child and hides
 * again when the last child leaves, so an empty overlay never intercepts a click.
 */
class EditorOverlay extends Group {
  constructor() {
    super();
    this.state.visible = false; // empty at construction — don't intercept clicks
  }
  override add(child: View): void {
    super.add(child);
    this.state.visible = this.children.length > 0;
  }
  override remove(child: View): void {
    super.remove(child);
    this.state.visible = this.children.length > 0;
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

// --- Tri-state click helpers (pure): a click cycles a key asc → desc → none (AR #4/#5). ---

/** Cycle the sole sorted key: `asc` → `desc`; `desc` → cleared (source order). */
function cycleSole(k: SortKey): SortKey[] {
  return k.dir === 'asc' ? [{ ...k, dir: 'desc' }] : [];
}

/** Cycle the key at `idx` within a multi-key list: `asc` → set `desc` (keep the rest); `desc` → remove it. */
function cycleAt(keys: SortKey[], idx: number): SortKey[] {
  const k = keys[idx];
  if (k.dir === 'asc') return keys.map((x, i) => (i === idx ? { ...x, dir: 'desc' as const } : x));
  return keys.filter((_, i) => i !== idx);
}

/** Set the given column's direction if it is already a key, else append it as a new key (explicit-dir API). */
function withKeyDir(keys: SortKey[], columnId: string, dir: SortDir): SortKey[] {
  const idx = keys.findIndex((k) => k.columnId === columnId);
  if (idx < 0) return [...keys, { columnId, dir }];
  return keys.map((k, i) => (i === idx ? { columnId, dir } : k));
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
  // The single source of truth for the sort model — the header and the `sortBy`/`addSort`/`clearSort`
  // API both drive this one signal; the body's `display` derives from it on the client path.
  private readonly sortKeys = signal<SortKey[]>([]);
  // The single source of truth for the filter model — the quick-filter row, the popups, and the
  // `setFilter`/`clearFilter` API all drive this one signal; `display` filters from it on the client
  // path and the push-down effect forwards it when the source exposes `setFilter` (twin of `sortKeys`).
  private readonly filters = signal<FilterModel>(new Map());
  // `source`, `columnMap`, and `display` are instance fields (not constructor locals) because the sort
  // API methods below — `applySort`/`sortBy`/`addSort` — read them.
  private readonly source: GridDataSource<T>;
  private readonly columnMap: ReadonlyMap<string, GridColumn<T>>;
  private readonly display: () => T[];

  /**
   * @param opts The `columns`, the `source`, optional `zebra` striping, and an optional `onCommit`
   *   veto sink.
   */
  constructor(opts: EditableDataGridOptions<T>) {
    super();
    const engineCols: Column<T>[] = opts.columns.map((c) => toEngineColumn(c));
    this.source = opts.source;
    this.columnMap = new Map(opts.columns.map((c) => [c.id, c]));

    // The materialized display re-runs when the source's rows change or a cell is written in place
    // (via `version`); the auto-width measure re-runs when the display changes. Both are shared by the
    // header and body so their geometry never disagrees. The client path is pure — it filters then
    // sorts in memory. Each half is skipped when its push-down seam exists: a `setFilter`/`setSort`
    // source owns that stage itself (already re-queried), so applying it again client-side would be
    // wrong. Filter runs before sort so a client sort orders only the surviving rows.
    this.display = this.derived(() => {
      this.version();
      let rows = materialize(this.source);
      if (!this.source.setFilter) rows = filterRows(rows, this.filters(), this.columnMap);
      if (!this.source.setSort) rows = sortRowsMulti(rows, this.sortKeys(), this.columnMap);
      return rows;
    });
    const autoWidths = this.derived(() => measureAutoWidths(engineCols, this.display(), stringWidth));

    // Push-down: delegate ordering/filtering to the source whenever a model changes — SEPARATE, guarded
    // effects (never inside `display`, so `display` stays pure and a re-query can't loop through it).
    this.onMount(() => {
      if (this.source.setSort) {
        this.bind(
          () => this.sortKeys(),
          (keys) => this.source.setSort!(keys),
        );
      }
      if (this.source.setFilter) {
        this.bind(
          () => this.filters(),
          (model) => this.source.setFilter!(model),
        );
      }
    });

    // The overlay is built before the body because the body's config references it as the editor host.
    // It is hidden while empty so it never intercepts header/body clicks (see EditorOverlay).
    this.overlay = new EditorOverlay();
    this.overlay.layout = { position: 'fill' };

    const columnIds = opts.columns.map((c) => c.id);
    const header = new SortHeader<T>({
      columns: engineCols,
      columnIds,
      autoWidths,
      indent: this.indent,
      sort: this.sortKeys,
      onHeaderClick: (columnId, additive) => (additive ? this.addSort(columnId) : this.sortBy(columnId)),
      filterModel: this.filters,
      onFunnelClick: (columnId, anchor, ev) => this.openFilterPopup(columnId, anchor, ev),
    });
    this.rows = new EditableGridRows<T>({
      display: this.display,
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
      rowKey: this.source.rowKey,
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

    // The opt-in quick-filter band: one fixed cell tall, an `fr` band beside a 1-cell corner so it
    // resolves to the same data width as the header/body and its inputs line up under the columns.
    let quickRow: Group | undefined;
    if (opts.quickFilter === true) {
      const band = new QuickFilterRow<T>({
        columns: engineCols,
        columnIds,
        autoWidths,
        indent: this.indent,
        onQuickFilter: (columnId, text) =>
          text.length === 0
            ? this.clearFilter(columnId)
            : this.setFilter(columnId, { kind: 'text', op: 'contains', value: text }),
      });
      band.layout = { size: { kind: 'fr', weight: 1 } };
      quickRow = new Group();
      quickRow.layout = { direction: 'row', size: { kind: 'fixed', cells: 1 } };
      quickRow.add(band);
      quickRow.add(corner());
    }

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
    if (quickRow !== undefined) inner.add(quickRow); // between header and body when quick-filter is on
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

  /**
   * Sort by a single column (a plain header click / the primary API). With an explicit `dir`, sets
   * exactly that key. Without `dir`: an unsorted or secondary column becomes the sole ascending key;
   * re-issuing it on the *sole* sorted column cycles its direction (asc → desc → cleared). An unknown
   * `columnId` is ignored (never forwarded to a source query).
   *
   * @param columnId The column to sort by.
   * @param dir Optional explicit direction; omit to toggle/cycle.
   */
  sortBy(columnId: string, dir?: SortDir): void {
    if (!this.columnMap.has(columnId)) return; // unknown id — no-op (never reaches setSort)
    if (dir !== undefined) {
      this.applySort([{ columnId, dir }]);
      return;
    }
    const cur = this.sortKeys();
    const sole = cur.length === 1 && cur[0].columnId === columnId;
    this.applySort(sole ? cycleSole(cur[0]) : [{ columnId, dir: 'asc' }]);
  }

  /**
   * Add or update a secondary sort key (a Ctrl+click / the multi-key API). With an explicit `dir`,
   * sets-or-appends that key. Without `dir`: a new column is appended ascending; an existing key
   * cycles its direction in place (asc → desc → removed), keeping its priority. An unknown `columnId`
   * is ignored.
   *
   * @param columnId The column to add or update.
   * @param dir Optional explicit direction; omit to append-ascending / cycle.
   */
  addSort(columnId: string, dir?: SortDir): void {
    if (!this.columnMap.has(columnId)) return;
    const cur = this.sortKeys();
    if (dir !== undefined) {
      this.applySort(withKeyDir(cur, columnId, dir));
      return;
    }
    const idx = cur.findIndex((k) => k.columnId === columnId);
    if (idx < 0) {
      this.applySort([...cur, { columnId, dir: 'asc' }]);
      return;
    }
    this.applySort(cycleAt(cur, idx));
  }

  /** Clear all sort keys — the client path restores source order; a push-down source gets `setSort([])`. */
  clearSort(): void {
    this.applySort([]);
  }

  /**
   * The current sort model. Reactive — reading it inside an effect re-runs when the sort changes.
   *
   * @returns The ordered `SortKey[]` (empty when unsorted); the first key is the primary.
   */
  sort(): SortKey[] {
    return this.sortKeys();
  }

  /**
   * Set (or replace) a column's filter. The quick-filter row and the popups both call this. An unknown
   * `columnId` is ignored — never added to the model and never forwarded to a push-down `setFilter`.
   *
   * @param columnId The column to filter.
   * @param filter The filter condition to apply.
   */
  setFilter(columnId: string, filter: ColumnFilter): void {
    if (!this.columnMap.has(columnId)) return; // unknown id — no-op (never reaches setFilter)
    const next = new Map(this.filters());
    next.set(columnId, filter);
    this.applyFilter(next);
  }

  /**
   * Clear one column's filter, or — with no argument — every filter.
   *
   * @param columnId The column whose filter to clear; omit to clear all filters.
   */
  clearFilter(columnId?: string): void {
    if (columnId === undefined) {
      this.applyFilter(new Map());
      return;
    }
    const next = new Map(this.filters());
    next.delete(columnId);
    this.applyFilter(next);
  }

  /**
   * The current filter model. Reactive — reading it inside an effect re-runs when the filters change.
   *
   * @returns The active per-column filters (empty when nothing is filtered).
   */
  filterModel(): FilterModel {
    return this.filters();
  }

  /**
   * The number of rows passing all active filters. Reactive. On the client path this is the filtered
   * row count; on an eager push-down source `source.length()` already reflects the filtered set, so it
   * equals `totalCount()` there (a documented v1 limitation until the windowing seam exposes a separate
   * pre-filter total).
   *
   * @returns The count of rows currently shown — render "N of M" from this and {@link totalCount}.
   */
  filteredCount(): number {
    return this.display().length;
  }

  /**
   * The pre-filter row count. Reactive. On the client path this is the true total; on a push-down
   * source it reflects whatever `source.length()` reports (see {@link filteredCount}).
   *
   * @returns The source's row count.
   */
  totalCount(): number {
    return this.source.length();
  }

  /**
   * Open a column's filter popup, anchored at its funnel cell. Invoked by the header when a funnel cell
   * is clicked; the live dispatch envelope is forwarded because the popup mount reuses its focus/popup
   * seam (`ev.focusView`/`ev.popupHost`) so the popup and its nested dropdowns can focus and open.
   *
   * @param _columnId The column whose filter popup to open.
   * @param _anchor The funnel cell's header-local anchor for positioning the popup.
   * @param _ev The live dispatch envelope carrying the focus/popup seam.
   */
  private openFilterPopup(_columnId: string, _anchor: { x: number; y: number }, _ev: DispatchEvent): void {
    // The popup itself lands with the condition / value-list popups; the funnel routing is wired now so
    // the header→container seam (including the forwarded envelope) is exercised from this phase on.
  }

  /**
   * Snapshot the focused and selected records by their row key from the current display, so a mutator
   * can re-find them after the display re-derives (the focused/selected record stays under the cursor
   * even when its display index moves). Returns `undefined` for an anchor when the grid is empty or
   * nothing is selected.
   */
  private snapshotAnchors(): { anchor: string | number | undefined; selAnchor: string | number | undefined } {
    const before = this.display();
    const n = before.length;
    const fIdx = Math.max(0, Math.min(this.focused(), n - 1));
    const anchor = n > 0 ? this.source.rowKey(before[fIdx]) : undefined;
    const sIdx = this.selected();
    const selAnchor = sIdx >= 0 && sIdx < n ? this.source.rowKey(before[sIdx]) : undefined;
    return { anchor, selAnchor };
  }

  /**
   * The one sort mutator. Sets the new key list, then — on the client path only — re-anchors the
   * cursor and selection to the same records they were on before the re-sort (by row key), so the
   * focused/selected record stays under the cursor when its display index moves. A push-down source
   * re-queries asynchronously, so a synchronous re-anchor makes sense only in memory.
   */
  private applySort(next: SortKey[]): void {
    const { anchor, selAnchor } = this.snapshotAnchors();

    this.sortKeys.set(next);

    if (this.source.setSort) return; // push-down re-queries; the client-side re-anchor doesn't apply
    const after = this.display();
    if (anchor !== undefined) {
      const i = after.findIndex((r) => this.source.rowKey(r) === anchor);
      if (i >= 0) this.focused.set(i);
    }
    if (selAnchor !== undefined) {
      this.selected.set(after.findIndex((r) => this.source.rowKey(r) === selAnchor)); // -1 if the row is gone
    }
  }

  /**
   * The one filter mutator. Sets the new model, then — on the client path only — re-anchors the cursor
   * and selection by row key. Unlike a re-sort, a filter can REMOVE the focused row: when its anchor is
   * gone the cursor clamps into the shrunk display and the selection resets to `-1`. A push-down source
   * re-queries asynchronously, so a synchronous re-anchor makes sense only in memory.
   */
  private applyFilter(next: FilterModel): void {
    const { anchor, selAnchor } = this.snapshotAnchors();

    this.filters.set(next);

    if (this.source.setFilter) return; // push-down re-queries; the client-side re-anchor doesn't apply
    const after = this.display();
    if (anchor !== undefined) {
      const i = after.findIndex((r) => this.source.rowKey(r) === anchor);
      if (i >= 0) {
        this.focused.set(i);
      } else {
        // The focused row was filtered out — clamp the cursor into the shrunk display, drop selection.
        this.focused.set(Math.max(0, Math.min(this.focused(), after.length - 1)));
        this.selected.set(-1);
        return;
      }
    }
    if (selAnchor !== undefined) {
      this.selected.set(after.findIndex((r) => this.source.rowKey(r) === selAnchor)); // -1 if the row is gone
    }
  }
}
