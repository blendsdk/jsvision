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
import { Group, ScrollBar, View, measureAutoWidths, stringWidth, signal } from '@jsvision/ui';
import type { Column, DispatchEvent, Signal } from '@jsvision/ui';
import type { GridColumn } from './column.js';
import { toEngineColumn } from './column.js';
import { visibleOrder, partition, overPinnedIds, clampWidth, DEFAULT_AUTOFIT_MAX } from './column-model.js';
import type { FreezeSpec, FreezePartition } from './column-model.js';
import type { GridDataSource } from './data-source.js';
import { isWindowed, windowedView, validateWindowedConfig } from './windowing.js';
import { serializeView } from './export-view.js';
import type { ExportColumn, ExportFormat } from './export-view.js';
import { sortRowsMulti } from './sort.js';
import type { SortKey, SortDir } from './sort.js';
import { filterRows, resolveFilterType, computeDistinct } from './filter.js';
import type { FilterModel, ColumnFilter, DistinctResult } from './filter.js';
import { SortHeader } from './sort-header.js';
import { buildGridBody } from './grid-panels.js';
import type { GridBodyDeps } from './grid-panels.js';
import { FilterPopup } from './filter-popup.js';
import type { FilterPopupContext } from './filter-popup.js';
import { mountCellOverlay, absoluteRect, EditorOverlay, PopupCatcher } from './overlay.js';
import { devWarn } from './dev.js';
import type { OnCommit, BeforeSave } from './commit.js';
import { EditableGridRows } from './editable-grid-rows.js';
import { mergeKeymap } from './keymap.js';
import type { GridKeymap } from './keymap.js';
import { nextCellIndex, prevCellIndex } from './navigation.js';
import { GridSelection } from './grid-selection.js';
import { RowMutations } from './row-mutations.js';
import { FooterController } from './grid-footer.js';
import type { GridFooter } from './grid-footer.js';
import type { SyntheticPrefix } from './synthetic-columns.js';
import type { Key, SelectionMode } from './selection.js';
import { createDirtyRegistry, cellKey } from './editing.js';
import { createErrorRegistry } from './error-registry.js';
import { buildMessageBand, createRowGate } from './validation.js';
import type { RowValidation, RowGate } from './validation.js';
import { createLifecycleController, emptyMessage, applyLifecycleSwap } from './grid-lifecycle.js';
import type { GridStatus, LifecycleController } from './grid-lifecycle.js';

/**
 * The filter popup's fixed cell size — wide enough for the operator selector and operands, tall enough
 * for the condition section stacked above the embedded value-list section (both are always present for
 * an in-memory source). It clips against a short grid; a taller viewport shows it whole.
 */
const FILTER_POPUP_WIDTH = 34;
const FILTER_POPUP_HEIGHT = 19;

/** Construction options for {@link EditableDataGrid}. */
export interface EditableDataGridOptions<T> {
  /** The typed columns (authored with `column()`); adapted to the engine internally. */
  readonly columns: GridColumn<T>[];
  /** The data source (carries the required `rowKey`). */
  readonly source: GridDataSource<T>;
  /** Stripe odd rows for readability (default `false`). */
  readonly zebra?: boolean;
  /**
   * Row selection mode (default `'multi'`). `'single'` keeps at most one row selected — each pick
   * replaces the prior; `'multi'` accumulates (`Space`/`Ctrl`+click toggle, `Shift` extends a range).
   * Selection gestures are always live; the checkbox column and row-number gutter are separately opt-in.
   */
  readonly selectionMode?: SelectionMode;
  /**
   * Show a leading **selection checkbox column** (default `false`): a per-row `[ ]`/`[x]` box plus a
   * tri-state header box (none/some/all of the displayed rows). It is a fixed-width, left-pinned cell —
   * not a sortable/filterable column and never reached by the `←`/`→` cursor. A per-row click toggles the
   * row; the header box selects/clears all displayed rows.
   */
  readonly checkboxColumn?: boolean;
  /**
   * Show a leading **row-number gutter** (default `false`): 1-based, right-aligned display numbers that
   * renumber whenever the display re-derives (after a sort/filter). Left-pinned and display-only.
   */
  readonly rowNumbers?: boolean;
  /**
   * Show the opt-in quick-filter row — a band of per-column text inputs below the header that drive a
   * live `contains` filter as you type (default `false`; the band is never built when off).
   */
  readonly quickFilter?: boolean;
  /** The per-cell veto sink — accept or reject each edit (see {@link OnCommit}). */
  readonly onCommit?: OnCommit<T>;
  /**
   * A per-cell gate that runs **above** `onCommit`: after the optimistic in-memory write and before
   * `onCommit`. Return `true` to proceed to `onCommit`, or `false`/a rejected promise to veto — a veto
   * reverts the cell to its previous value, surfaces a rejection message, and `onCommit` is never called.
   * Use it for a policy check (permission, a business rule) that should short-circuit persistence.
   * Client-side gating is UX only — the authoritative check still belongs in `onCommit`/the source.
   *
   * @example
   * ```ts
   * import { EditableDataGrid } from '@jsvision/datagrid';
   * // Block edits to a locked row before they ever reach onCommit:
   * const grid = new EditableDataGrid({ columns, source, beforeSave: (c) => !(c.row as { locked?: boolean }).locked });
   * ```
   */
  readonly beforeSave?: BeforeSave<T>;
  /**
   * A per-row cross-field gate that runs when the cursor leaves a row **that was edited** this visit (a
   * cell in it committed). Return `{ ok: true }` to allow the leave, or `{ ok: false, message?, field? }`
   * to block it: the cursor stays on the row, refocuses the `field` column (the offending field), and
   * `message` surfaces in the message band. An untouched row — even a pre-existing invalid one — leaves
   * freely; a row that once passes will not re-trap. Use it for cross-field rules a single cell cannot
   * check (e.g. `end` after `start`). Client-side gating is UX only — the source stays authoritative.
   *
   * @example
   * ```ts
   * import { EditableDataGrid } from '@jsvision/datagrid';
   * const grid = new EditableDataGrid({
   *   columns, source,
   *   validateRow: (r) => (r.end > r.start ? { ok: true } : { ok: false, message: 'End must be after start', field: 'end' }),
   * });
   * ```
   */
  readonly validateRow?: (row: T) => RowValidation;
  /**
   * A per-grid keyboard remap layered over the default binding table (see `DEFAULT_KEYMAP`). Each entry
   * maps a chord (`'ctrl+alt+shift+key'`) to a `GridAction`; a caller entry wins on a chord conflict, and
   * the untouched defaults still fire. An entry naming an unknown action or a malformed chord is ignored
   * (a dev warning, never thrown), so a typo can never break construction. Omit to use the defaults.
   *
   * @example
   * ```ts
   * // Ctrl+E also begins editing (F2 still works); an unknown chord is ignored.
   * const grid = new EditableDataGrid({ columns, source, keymap: { 'ctrl+e': 'beginEdit' } });
   * ```
   */
  readonly keymap?: GridKeymap;
  /** Column ids to pin to the left (frozen) panel. */
  readonly freezeLeft?: string[];
  /** Column ids to pin to the right (frozen) panel. */
  readonly freezeRight?: string[];
  /** Shorthand for freezing the first N columns to the left (ignored when `freezeLeft` is set). */
  readonly freeze?: number;
  /**
   * Pin the first N data rows as a non-scrolling band directly below the header — the horizontal mirror
   * of frozen columns. The scrolling body's window starts after them, so a pinned row never scrolls off
   * or renders twice. Clamped so at least one scrolling row always remains (a value larger than the row
   * count is reduced, with a dev warning). Composes with frozen columns: the top-left cell is pinned on
   * both axes. Default `0` (no band).
   */
  readonly freezeRows?: number;
  /**
   * Row density (default `'normal'`). `'compact'` drops the inter-column `│` divider, reclaiming its cell
   * per column so content packs tighter (the header, body, and quick-filter all reflow together and stay
   * aligned). Horizontal only — rows are 1 cell tall in either mode.
   */
  readonly density?: 'normal' | 'compact';
  /**
   * Replace the built-in condition-filter popup with a custom view. The factory receives a
   * {@link FilterPopupContext} (the column, its filter type, the current filter, the value-list
   * `distinct` thunk, the apply/clear/close sinks, and a `defaultPopup()` builder) and returns the view
   * to mount. Call `ctx.defaultPopup()` to reuse or wrap the built-in popup; return your own view to
   * replace it entirely. The returned view is mounted **anchored** under the column and clamped into the
   * viewport, at the size it sets on its own `layout` (or the default popup size when it sets none); if
   * it exposes a `focusTarget()` method that view is focused. Omit to use the built-in popup.
   *
   * @example
   * ```ts
   * import { EditableDataGrid } from '@jsvision/datagrid';
   * // Reuse the built-in popup unchanged (equivalent to omitting the option):
   * const grid = new EditableDataGrid({ columns, source, filterPopup: (ctx) => ctx.defaultPopup() });
   * ```
   */
  readonly filterPopup?: (ctx: FilterPopupContext<T>) => View;
  /**
   * Mint the fresh key for {@link EditableDataGrid.duplicateRow} — the caller owns key generation. It
   * receives a structured clone of the original row plus the original, and returns the row to insert
   * (typically the clone with a new `rowKey`). Without it, `duplicateRow` is a no-op (it never inserts a
   * key-colliding row).
   *
   * @example
   * ```ts
   * let nextId = 1000;
   * const grid = new EditableDataGrid({ columns, source, assignKey: (clone) => ({ ...clone, id: nextId++ }) });
   * ```
   */
  readonly assignKey?: (clone: T, original: T) => T;
  /**
   * An optional footer band: per-column aggregates (totals aligned under their columns, folded reactively
   * over the displayed rows, honesty-labelled for a not-fully-loaded source) and/or a free-form widget
   * row. See {@link GridFooter}. Omit for no footer.
   */
  readonly footer?: GridFooter;
  /**
   * A caller-driven reactive lifecycle status. Return `'loading'` to show a spinner (the header stays,
   * the rows hide), `'ready'` to show the grid, or `{ kind: 'error', message, retry? }` to show the
   * message and a Retry button (clicking it calls `retry`). The **empty** state is auto-derived: when
   * `ready` with zero displayed rows the grid shows {@link emptyText} (or the filter-aware
   * `'No matching rows'`). Evaluated in the grid's reactive scope, so flipping the value it reads swaps
   * the view. Omit for an always-`ready` grid (a zero-row grid then shows the plain `<empty>` body).
   *
   * @example
   * ```ts
   * import { EditableDataGrid } from '@jsvision/datagrid';
   * import { signal } from '@jsvision/ui';
   * const state = signal<'loading' | 'ready'>('loading');
   * const grid = new EditableDataGrid({ columns, source, status: () => state() });
   * // later: state.set('ready');
   * ```
   */
  readonly status?: () => GridStatus;
  /**
   * The message shown when the grid is `ready` with zero displayed rows and no active filter (default
   * `'No rows'`). When a filter has reduced a non-empty source to zero, the built-in `'No matching rows'`
   * is shown instead. Setting this (or {@link status}) opts the grid into the lifecycle empty state; a grid
   * with neither keeps the plain `<empty>` body at zero rows.
   */
  readonly emptyText?: string;
  /**
   * Prefetch buffer size in rows on each side of the visible window, for a **windowed** source (one
   * exposing `ensureRange`). As the grid scrolls it requests `[top − prefetch, top + visible + prefetch)`,
   * coalesced to at most one call per frame. **Unset ⇒ one viewport** (the current visible row count,
   * resolved per draw) — there is no static default because the viewport height is not known at
   * construction. Ignored for an eager in-memory source.
   */
  readonly prefetch?: number;
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
  /**
   * The focusable body renderer — focus this (a plain `Group` is not a focus target). In a frozen grid
   * this is the center (horizontally-scrolling) panel; every panel shares one row cursor, so focusing it
   * and moving the cursor drives all panels together.
   */
  get rows(): EditableGridRows<T> {
    return this._center;
  }
  /** The focusable body — the center panel when frozen, the single body otherwise (backs {@link rows}). */
  private _center!: EditableGridRows<T>;
  /**
   * The current header panels, retained (and refreshed on every rebuild) so the keyboard filter opener
   * can resolve a column's owning header — the mouse path captures its header in a closure, but the
   * `Alt+Down` path has no closure, so this array is its only route to the live header.
   */
  private _headers: SortHeader<T>[] = [];
  /** The current inner band stack (swapped out by a rebuild when the partition shape changes). */
  private _inner!: Group;
  /** The shared body-assembly deps, retained so a rebuild re-runs `buildGridBody` with the same wiring. */
  private _bodyDeps!: GridBodyDeps<T>;
  /** The current lifecycle swap handle (host + grid region), refreshed on each rebuild; absent with no `status`. */
  private _lifecycleSwap?: { host: Group; gridRegion: Group };
  /** The last partition key a rebuild ran for — a rebuild is skipped while it is unchanged. */
  private lastPartitionKey = '';
  /** Whether the one-time over-freeze dev warning has fired (de-duped so a rebuild never re-warns). */
  private warnedOverFreeze = false;
  /** The absolute overlay host on top of the grid — the cell editor mounts into it while editing. */
  readonly overlay: Group;
  /**
   * A second absolute overlay, above {@link overlay}, that hosts a filter popup opened from the header
   * funnel. Kept separate from the editor overlay so a filter popup and an open cell editor never
   * collide, and hit-transparent while empty (see {@link EditorOverlay}).
   */
  readonly popupOverlay: Group;

  // Container-owned shared cursor/selection/scroll state — the body binds these signals, and a later
  // frozen-panel split can bind the very same ones with no retrofit.
  private readonly focused = signal(0);
  private readonly focusedCol = signal(0);
  // The base's required single-index click sink. Kept because `GridRowsConfig` requires it, but
  // superseded by `selection` below: `EditableGridRows.select()` is a no-op, so this stays at `-1` and
  // never drives the highlight; the datagrid paints selection from `selection.keys` instead.
  private readonly selected = signal(-1);
  // The datagrid selection model — a `ReadonlySet<Key>` + anchor keyed by `rowKey`, so selection
  // survives re-sort/re-filter with no reconcile (the stateful wiring lives in grid-selection.ts).
  private readonly selection: GridSelection<T>;
  private readonly indent = signal(0);
  // Bump-on-write: an in-place cell `set` mutates the record without changing the rows array identity,
  // so the display computed reads this version to force a repaint of the mutated row.
  private readonly version = signal(0);
  private readonly dirty = createDirtyRegistry();
  // The invalid-cell registry — the twin of `dirty`, holding a message per blocked cell plus the one
  // active message the footer band shows. Threaded into the body (the `gridInvalid` paint) and the edit
  // pipeline (set on a blocked/vetoed commit, cleared on a successful re-commit or an abandoned edit).
  private readonly errors = createErrorRegistry();
  // Rows edited this visit (a cell committed) — the trigger for the row-leave gate. A row is added on a
  // successful commit and removed when it leaves with `validateRow` passing, so an untouched row (seed
  // data) never traps and a validated row does not re-trap. Distinct from `dirty` (in-flight commits).
  private readonly touched = new Set<Key>();
  // The per-row cross-field leave gate (validateRow). Owns no reactive state — it reads live grid state
  // through delegators; every row-leave path (nav, Enter-advance, Tab row-edge, cross-row click) consults it.
  private readonly rowGate: RowGate;
  // The lifecycle controller (caller `status` → loading/ready/error). Drives the body-region swap; the
  // empty state is rendered by the body itself. Always constructed (a grid with no `status` reads `ready`).
  private readonly lifecycle: LifecycleController;
  // The single source of truth for the sort model — the header and the `sortBy`/`addSort`/`clearSort`
  // API both drive this one signal; the body's `display` derives from it on the client path.
  private readonly sortKeys = signal<SortKey[]>([]);
  // The single source of truth for the filter model — the quick-filter row, the popups, and the
  // `setFilter`/`clearFilter` API all drive this one signal; `display` filters from it on the client
  // path and the push-down effect forwards it when the source exposes `setFilter` (twin of `sortKeys`).
  private readonly filters = signal<FilterModel>(new Map());
  // Column-layout state — the reactive twins of `sortKeys`/`filters`: the full column order (all ids,
  // hidden included), per-column width overrides, and the hidden set. The panels derive their sliced
  // columns from these; the layout API below drives them.
  private readonly columnOrderSig: Signal<string[]>;
  private readonly columnWidths = signal<Map<string, number>>(new Map());
  private readonly hidden = signal<Set<string>>(new Set());
  private readonly freezeSpec: FreezeSpec;
  // A title press sorts on mouse-down; if that press then becomes a reorder drag we undo the sort so a
  // drag never leaves a net sort. This holds the pre-sort keys captured on the down, restored on drag.
  private reorderSortSnapshot: SortKey[] | null = null;
  // Derived projections: the visible order (order minus hidden) and the frozen left/center/right
  // partition with over-pinned columns pushed back to the center (so the center is never blank).
  private readonly visibleIds: () => string[];
  private readonly partitionSig: () => FreezePartition;
  // The engine columns (accessor/title/width) + an id→index map, retained so the layout API can resolve
  // and auto-fit widths; the auto-width measure is shared with the header and body.
  private readonly engineCols: Column<T>[];
  private readonly columnIndex: ReadonlyMap<string, number>;
  private readonly autoWidths: () => (number | null)[];
  // `source`, `columnMap`, and `display` are instance fields (not constructor locals) because the sort
  // API methods below — `applySort`/`sortBy`/`addSort` — read them.
  private readonly source: GridDataSource<T>;
  private readonly columnMap: ReadonlyMap<string, GridColumn<T>>;
  private readonly display: () => T[];
  // Computed once at construction: a windowed source (one exposing `ensureRange`) takes the lazy read
  // path — `display()` is a length-correct lazy view, `materialize`/client sort+filter are skipped, and
  // every whole-array consumer is gated off this flag. An eager source leaves all of that untouched.
  private readonly windowed: boolean;
  // The disposer for the currently-open filter popup (at most one), or `null` when none is open.
  private popupDispose: (() => void) | null = null;
  // Optional custom filter-popup factory — replaces the built-in popup when set (see the config option).
  private readonly filterPopupFactory?: (ctx: FilterPopupContext<T>) => View;
  // The row-CRUD controller — insert/delete/duplicate through the source's mutation seam (the stateful
  // wiring, like GridSelection, lives in row-mutations.ts so grid.ts stays thin public delegators).
  private readonly mutations: RowMutations<T>;
  private readonly footer?: FooterController<T>;

  /**
   * @param opts The `columns`, the `source`, optional `zebra` striping, and an optional `onCommit`
   *   veto sink.
   */
  constructor(opts: EditableDataGridOptions<T>) {
    super();
    const engineCols: Column<T>[] = opts.columns.map((c) => toEngineColumn(c));
    this.engineCols = engineCols;
    this.columnIndex = new Map(opts.columns.map((c, i) => [c.id, i]));
    this.columnOrderSig = signal<string[]>(opts.columns.map((c) => c.id));
    this.freezeSpec = { freezeLeft: opts.freezeLeft, freezeRight: opts.freezeRight, freeze: opts.freeze };
    this.filterPopupFactory = opts.filterPopup;
    this.source = opts.source;
    this.windowed = isWindowed(opts.source);
    // A windowed source must push sort/filter down (hard-fail) and forgoes auto-width (warn); validated once.
    if (this.windowed) validateWindowedConfig(opts.source, engineCols, devWarn);
    this.columnMap = new Map(opts.columns.map((c) => [c.id, c]));

    // The materialized display re-runs when the source's rows change or a cell is written in place
    // (via `version`); the auto-width measure re-runs when the display changes. Both are shared by the
    // header and body so their geometry never disagrees. The client path is pure — it filters then
    // sorts in memory. Each half is skipped when its push-down seam exists: a `setFilter`/`setSort`
    // source owns that stage itself (already re-queried), so applying it again client-side would be
    // wrong. Filter runs before sort so a client sort orders only the surviving rows.
    this.display = this.derived(() => {
      this.version();
      this.source.revision?.(); // windowed: a landed page bumps this → fresh identity → repaint
      if (this.windowed) return windowedView(this.source); // length-correct lazy view; no materialize/client sort/filter
      let rows = materialize(this.source);
      if (!this.source.setFilter) rows = filterRows(rows, this.filters(), this.columnMap);
      if (!this.source.setSort) rows = sortRowsMulti(rows, this.sortKeys(), this.columnMap);
      return rows;
    });
    // A windowed source forgoes auto-width (measuring every row would page-fault + reflow on scroll): a
    // fixed/`fr` column keeps its declared width, and an `auto` column falls back to its title width
    // (floored at `minWidth`) instead of being measured over the (partial) rows.
    const autoWidths = this.derived(() =>
      this.windowed
        ? engineCols.map((c) => (c.width === 'auto' ? Math.max(stringWidth(c.title), c.minWidth ?? 0) : null))
        : measureAutoWidths(engineCols, this.display(), stringWidth),
    );
    this.autoWidths = autoWidths;
    // The selection controller reads the live display + cursor lazily (only when a gesture/API call
    // fires), so a re-sort/re-filter needs no reconcile — the same keys re-highlight wherever they moved.
    this.selection = new GridSelection<T>({
      mode: opts.selectionMode ?? 'multi',
      focused: this.focused,
      display: this.display,
      rowKey: this.source.rowKey,
      windowed: this.windowed,
    });
    // Row CRUD routes through the source's mutation seam; a delete also prunes the selection. `assignKey`
    // (from opts) mints the clone key for `duplicateRow` — without it, duplicate is a no-op + devWarn.
    this.mutations = new RowMutations<T>({
      source: this.source,
      display: this.display,
      selection: this.selection,
      assignKey: opts.assignKey,
      warn: (message) => devWarn('duplicateRow', message),
      windowed: this.windowed,
    });
    // Visible order = full order minus hidden; partition = the frozen left/center/right split with any
    // over-pinned columns pushed back to the center (so the center is never blank). Both derive lazily.
    this.visibleIds = this.derived(() => visibleOrder(this.columnOrderSig(), this.hidden()));
    this.partitionSig = this.derived(() => {
      const part = partition(this.visibleIds(), this.freezeSpec);
      const over = overPinnedIds(part, (id) => this.resolvedWidth(id), this.viewportWidth());
      return this.applyOverPin(part, over);
    });

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
    // A second overlay, above the editor overlay, dedicated to the funnel-opened filter popup.
    this.popupOverlay = new EditorOverlay();
    this.popupOverlay.layout = { position: 'fill' };

    // Density: compact drops the inter-column divider across every band (threaded via `buildGridBody`).
    const compact = opts.density === 'compact';
    // Frozen rows: clamp the request so at least one scrolling row always remains — a pinned band that
    // ate every row would leave nothing to scroll. Data-driven at construction; a band taller than the
    // viewport is a layout concern. Mirrors the over-pinned-columns guard.
    const requestedFreezeRows = Math.max(0, opts.freezeRows ?? 0);
    const freezeRows = Math.min(requestedFreezeRows, Math.max(0, this.display().length - 1));
    if (freezeRows < requestedFreezeRows) {
      devWarn(
        'freezeRows',
        `freezeRows ${requestedFreezeRows} exceeds the available rows; clamped to ${freezeRows} to keep at least one scrolling row.`,
      );
    }

    // Build the body from the resolved partition — a single body when not frozen, or left/center/right
    // frozen panels sharing one cursor/scroll. `buildGridBody` owns the band assembly (see grid-panels.ts).
    const vbar = new ScrollBar({ value: this.focused, orientation: 'vertical' });
    const hbar = new ScrollBar({ value: this.indent, orientation: 'horizontal' });
    // The footer controller (when a footer is declared): validates the aggregate specs against the real
    // columns and folds each lazily over the displayed rows. It holds no reactive state of its own — the
    // footer band binds the fold to the data deps for repaint.
    if (opts.footer !== undefined) {
      this.footer = new FooterController<T>({
        footer: opts.footer,
        columns: this.columnMap,
        displayedRows: () => this.display(),
        complete: this.source.complete ? () => this.source.complete!() : undefined,
        windowed: this.windowed,
      });
    }

    // Merge the caller's keymap over the default table once; every panel shares this one frozen map.
    const keymap = mergeKeymap(opts.keymap);

    // The validation message band is built only when validation is configured — a column `validate`, a
    // grid `beforeSave`, or a `validateRow`. A plain editable grid keeps its exact layout (no extra footer
    // row); a configured grid gets a reserved one-cell band that shows the active message, blank when none.
    const validationConfigured =
      opts.beforeSave !== undefined ||
      opts.validateRow !== undefined ||
      opts.columns.some((c) => c.validate !== undefined);
    const messageBand = validationConfigured
      ? buildMessageBand(
          () => this.errors.active(),
          () => 'error',
        )
      : undefined;

    // The row-leave gate reads live grid state through delegators (no owned reactive state). `focusColumn`
    // sets the shared global column cursor to the offending field; `columnIndex` resolves a field id to its
    // visible index (−1 when hidden/unknown → the gate falls back to the current column).
    this.rowGate = createRowGate<T>({
      validateRow: opts.validateRow,
      focusedRow: () => this.focusedRow(),
      focusedKey: () => this.focusedKey(),
      isRowTouched: (rowKey) => this.touched.has(rowKey),
      clearTouched: (rowKey) => this.touched.delete(rowKey),
      columnIndex: (columnId) => this.visibleIds().indexOf(columnId),
      currentColumn: () => this.focusedCol(),
      focusColumn: (index) => this.focusedCol.set(index),
      note: (message) => this.errors.note(message),
    });

    // Lifecycle: the controller drives the body-region swap (loading/error) from the caller `status`; the
    // empty state is rendered by the body via `emptyResolver` (filter-aware). A grid with neither `status`
    // nor `emptyText` gets no swap host and no resolver — its zero-row body stays the plain `<empty>`.
    this.lifecycle = createLifecycleController({ status: opts.status });
    const emptyResolver =
      opts.status !== undefined || opts.emptyText !== undefined
        ? (): string => emptyMessage(opts.emptyText, this.filteredCount(), this.totalCount())
        : undefined;

    this._bodyDeps = {
      focused: this.focused,
      focusedCol: this.focusedCol,
      keymap,
      selected: this.selected,
      selectedKeys: this.selection.keys,
      onToggleRow: (rowIndex) => this.selection.toggleAtRow(rowIndex),
      onRangeToRow: (rowIndex) => this.selection.rangeToRow(rowIndex),
      // The opt-in synthetic prefix (checkbox + row-number gutter). The gutter width is sized from the
      // source row count so it does not reflow as a filter shrinks the display.
      prefix: {
        checkbox: opts.checkboxColumn === true,
        rowNumbers: opts.rowNumbers === true,
        rowCount: this.source.length(),
      } satisfies SyntheticPrefix,
      triState: () => this.selection.currentTriState(),
      onToggleAll: () => this.selection.toggleAll(),
      indent: this.indent,
      display: this.display,
      rowKey: this.source.rowKey,
      engineCols: this.engineCols,
      columnIndex: this.columnIndex,
      columnMap: this.columnMap,
      autoWidths: this.autoWidths,
      resolvedWidth: (id) => this.resolvedWidth(id),
      widthOverride: (id) => this.columnWidths().get(id),
      widthTick: () => this.columnWidths(),
      zebra: opts.zebra ?? false,
      compact,
      freezeRows,
      sort: this.sortKeys,
      filters: this.filters,
      onHeaderClick: (columnId, additive) => {
        // Snapshot the pre-sort keys before sorting on the down, so onReorderStart can undo it if this
        // press turns into a reorder drag (a plain click keeps the sort; the snapshot is just discarded).
        this.reorderSortSnapshot = this.sortKeys();
        if (additive) this.addSort(columnId);
        else this.sortBy(columnId);
      },
      onFunnelClick: (columnId, anchor, ev, header) => this.openFilterPopup(columnId, anchor, ev, header),
      onOpenFilter: (globalCol, ev) => this.openFilterFromKeyboard(globalCol, ev),
      onColumnResize: (id, w) => this.setColumnWidth(id, w),
      onColumnAutoFit: (id) => this.autoFitColumn(id),
      onColumnReorder: (from, to) => this.reorderWithinPanel(from, to),
      onReorderStart: () => {
        // A press became a drag → undo the sort the down applied, so a reorder never also sorts.
        if (this.reorderSortSnapshot !== null) {
          this.applySort(this.reorderSortSnapshot);
          this.reorderSortSnapshot = null;
        }
      },
      quickFilter: opts.quickFilter === true,
      onQuickFilter: (columnId, text) =>
        text.length === 0
          ? this.clearFilter(columnId)
          : this.setFilter(columnId, { kind: 'text', op: 'contains', value: text }),
      overlay: this.overlay,
      onCommit: opts.onCommit,
      beforeSave: opts.beforeSave,
      bumpVersion: () => this.version.set(this.version() + 1),
      dirty: this.dirty,
      errors: this.errors,
      markRowTouched: (rowKey) => this.touched.add(rowKey),
      rowLeaveGate: () => this.rowGate.tryLeave(),
      messageBand,
      lifecycle: opts.status !== undefined,
      emptyText: emptyResolver,
      vbar,
      hbar,
      // The aggregate row is built only when at least one valid aggregate survived validation.
      footerCell: this.footer?.hasAggregates === true ? (id) => this.footer!.cell(id) : undefined,
      // The widget row hosts the caller's free-form footer views (totals, buttons, read-outs).
      footerWidgets: opts.footer?.widgets,
      // Windowed prefetch: the scrolling body requests source.ensureRange over its window. Wired only for
      // a windowed source; an eager grid leaves these undefined, so the body's window path stays inert.
      ensureRange: this.windowed ? (start, end) => this.source.ensureRange!(start, end) : undefined,
      rowCount: this.windowed ? () => this.source.length() : undefined,
      prefetch: opts.prefetch,
    };
    this.maybeWarnOverFreeze();
    const parts = buildGridBody<T>(this.computePartition(), this._bodyDeps);
    this._center = parts.center;
    this._inner = parts.inner;
    this._headers = parts.headers;
    this._lifecycleSwap = parts.lifecycleSwap;
    this.lastPartitionKey = this.partitionKey();

    this.add(this._inner); // behind
    this.add(this.overlay); // above — hosts the cell editor while editing
    this.add(this.popupOverlay); // topmost — hosts the funnel-opened filter popup

    // The lifecycle body-region swap: an effect that shows the grid body while `ready` and a spinner/error
    // placeholder otherwise. Only set up when `status` is configured (a swap host exists). Bound on the
    // grid (not the swappable inner), reading the current `_lifecycleSwap` so it survives a body rebuild.
    if (this._lifecycleSwap !== undefined) {
      this.onMount(() => {
        this.bind(
          () => this.lifecycle.state(),
          () => this.applyLifecycleSwap(),
        );
      });
    }

    // Rebuild the body when the partition SHAPE changes — a hidden/shown/reordered column, or a frozen
    // column resized (which resizes its fixed panel band). A pure width change to a scrolling column is
    // NOT a shape change: the reactive width getters re-flow it live without a rebuild.
    this.onMount(() => {
      this.bind(
        () => this.partitionKey(),
        (key) => {
          if (key === this.lastPartitionKey) return; // unchanged (incl. the initial run) — nothing to rebuild
          this.lastPartitionKey = key;
          this.rebuildBody();
        },
      );
    });
  }

  /**
   * The partition the panels are built from: the raw freeze split, folded back to a single scrolling body
   * when freezing would leave the center empty (so the center is never blank). Pure — the one-time dev
   * warning for that fold lives in {@link maybeWarnOverFreeze}. The width-based over-pin that
   * {@link frozen} reports is applied lazily once the real viewport width is known.
   */
  private computePartition(): FreezePartition {
    const raw = partition(this.visibleIds(), this.freezeSpec);
    const overFrozen = raw.center.length === 0 && (raw.left.length > 0 || raw.right.length > 0);
    return overFrozen ? { left: [], center: this.visibleIds(), right: [] } : raw;
  }

  /** Emit the over-freeze dev warning once (de-duped across rebuilds) when every column is frozen. */
  private maybeWarnOverFreeze(): void {
    if (this.warnedOverFreeze) return;
    const raw = partition(this.visibleIds(), this.freezeSpec);
    if (raw.center.length === 0 && (raw.left.length > 0 || raw.right.length > 0)) {
      devWarn('datagrid', 'every column is frozen — the freeze is ignored so the grid stays scrollable');
      this.warnedOverFreeze = true;
    }
  }

  /**
   * A string key for the current partition SHAPE — the left/center/right id lists plus the resolved
   * widths of the frozen (fixed-band) columns. It changes on a hide/show/reorder or a frozen-column
   * resize (both of which need a rebuild), but NOT on a scrolling-column resize (handled live).
   */
  private partitionKey(): string {
    const p = this.computePartition();
    const frozenWidths = [...p.left, ...p.right].map((id) => this.resolvedWidth(id)).join(',');
    return `${p.left.join('|')}#${p.center.join('|')}#${p.right.join('|')}@${frozenWidths}`;
  }

  /**
   * Swap the body for a freshly-built one from the current partition. The new band stack is added first,
   * then the old one removed — so if the removed panel held focus, the framework's focus-healing re-homes
   * focus into the new panels (they are already present) rather than dropping it. Removing the old panels
   * unmounts them, tearing down their reactive scopes. The overlays are re-added last to stay on top.
   */
  private rebuildBody(): void {
    this.maybeWarnOverFreeze();
    const parts = buildGridBody<T>(this.computePartition(), this._bodyDeps);
    const old = this._inner;
    this._inner = parts.inner;
    this._center = parts.center;
    this._headers = parts.headers; // refresh: the old headers are unmounted by the swap below, so the keyboard opener must not hold a stale reference
    this._lifecycleSwap = parts.lifecycleSwap; // the new inner carries a fresh swap host
    this.add(parts.inner); // new inner present before the old is removed → focus heals into it
    this.remove(old);
    // Restore z-order: the overlays sit above the (new) inner band stack.
    this.remove(this.overlay);
    this.remove(this.popupOverlay);
    this.add(this.overlay);
    this.add(this.popupOverlay);
    // The freshly-built inner starts showing the grid region; re-sync it to the current lifecycle state so
    // a rebuild during loading/error keeps its placeholder.
    this.applyLifecycleSwap();
  }

  /** Sync the lifecycle swap host to the current state (delegates to `grid-lifecycle`); a no-op with no `status`. */
  private applyLifecycleSwap(): void {
    if (this._lifecycleSwap === undefined) return;
    applyLifecycleSwap(this._lifecycleSwap, this.lifecycle.state(), () => this.lifecycle.placeholder());
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
   * Whether a specific cell is marked invalid — its last edit was blocked (a failed `validate`, an
   * unparseable value, or a vetoed change) and never took. Reactive (see {@link EditableDataGrid.isDirty}).
   * Clears on a successful re-commit or an abandoned edit.
   *
   * @param rowKey The cell's row key.
   * @param columnId The cell's column id.
   * @returns `true` while the cell is marked invalid.
   */
  isInvalid(rowKey: string | number, columnId: string): boolean {
    return this.errors.has(cellKey(rowKey, columnId));
  }

  /**
   * The active validation/veto message shown in the grid's message band, or `null` when there is none.
   * Reactive — it follows the most recent blocked commit or row-gate message and clears once the
   * offending cell/row is valid again.
   *
   * @returns The active message string, or `null`.
   */
  activeMessage(): string | null {
    return this.errors.active();
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
    // Windowed: read source.length() directly (the filtered total the server reports), not the lazy view.
    return this.windowed ? this.source.length() : this.display().length;
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
   * The filtered + sorted rows currently displayed (reactive). This is the loaded/in-memory set the
   * footer aggregates fold over; reading it inside an effect re-runs when a row is edited, inserted,
   * deleted, sorted, or filtered.
   *
   * **Windowed sources:** for a windowed source (one exposing `ensureRange`) this returns a
   * length-correct **lazy view**, not a materialized array. Only `.length` and integer indexing are
   * supported — every whole-array operation (`.map`/`.find`/`.filter`/spread/`for..of`) **throws**. Read
   * `.length` for the count and `[i]` for a row (`undefined` at an unloaded index); do not assume a dense
   * `T[]`. An eager source returns an ordinary dense array.
   *
   * @returns The displayed rows, in display order — a dense array (eager) or a lazy view (windowed).
   */
  displayedRows(): readonly T[] {
    return this.display();
  }

  /**
   * Serialize the current view — the visible columns in display order, their `format`ted values, and the
   * filtered + sorted rows — to CSV, HTML, JSON, or TSV. CSV/TSV are RFC-4180 (records CRLF-joined; a
   * field with the delimiter, a `"`, or a newline is double-quoted, embedded quotes doubled) with
   * spreadsheet formula-injection escaping (a cell that begins with `= + - @` — the accepted tradeoff: a
   * negative like `-5` becomes `'-5`); HTML is a standalone document with a markup-escaped `<table>`;
   * JSON is an array of objects holding the **raw** values keyed by column **id**. Hidden and synthetic
   * (checkbox / row-number) columns are excluded; the grid never chooses a destination — it returns a
   * string the caller writes to a file or clipboard.
   *
   * **Eager sources only.** This serializes the resident displayed rows. On a **windowed** source (one
   * exposing `ensureRange`) the displayed rows are a lazy window, not a full array, so this **throws** — a
   * full-view export over a windowed source is a separate mechanism.
   *
   * @param format The target format (`'csv' | 'html' | 'json' | 'tsv'`).
   * @returns The serialized document as a string.
   * @throws If the grid is over a windowed source.
   * @example
   * ```ts
   * const csv = grid.exportView('csv');   // 'Name,Total\r\nAnn,10\r\n…' — RFC-4180, formula-escaped
   * const json = grid.exportView('json'); // [{ name: 'Ann', total: 10 }, …] — raw values, keyed by id
   * ```
   */
  exportView(format: ExportFormat): string {
    if (this.windowed) {
      // Guard before serializeView touches displayedRows(): on a windowed source that is a fail-loud lazy
      // view whose whole-array ops throw a generic error. Mirrors autoFitColumn/distinctFor.
      throw new Error(
        'exportView is unsupported on a windowed source: the displayed rows are a lazy window, not a full ' +
          'array. Export the loaded window (or drive the full range) via a follow-up.',
      );
    }
    const cols: ExportColumn<T>[] = this.columnOrder().map((id) => {
      // columnOrder() yields only real, visible column ids, so the map lookup is always present.
      const col = this.columnMap.get(id)!;
      return {
        id,
        title: col.title,
        text: (row: T) => {
          const value = col.value(row);
          if (col.format === undefined) return String(value);
          try {
            return col.format(value, row);
          } catch {
            return String(value); // a throwing formatter degrades its one cell, never the whole export
          }
        },
        raw: (row: T) => col.value(row),
      };
    });
    return serializeView(cols, this.displayedRows(), format);
  }

  /**
   * The visible column order (the full order minus hidden columns). Reactive — reading it inside an
   * effect re-runs when the order, visibility, or a reorder changes.
   *
   * @returns The visible column ids, in order.
   */
  columnOrder(): string[] {
    return this.visibleIds();
  }

  /**
   * Reorder the visible columns. Accepts a permutation of the **currently-visible** ids; the new
   * order is spliced back into the full order so hidden columns keep their anchor slots. A non-
   * permutation (unknown id, wrong length, duplicate) is ignored.
   *
   * @param ids The visible ids in their new order.
   */
  setColumnOrder(ids: string[]): void {
    const visible = this.visibleIds();
    if (ids.length !== visible.length) return; // wrong length
    const target = new Set(ids);
    if (target.size !== ids.length) return; // duplicate id
    for (const id of visible) if (!target.has(id)) return; // must be the same set of ids
    // Splice the new visible order back into the full order; hidden columns keep their positions.
    const hidden = this.hidden();
    let vi = 0;
    const next = this.columnOrderSig().map((id) => (hidden.has(id) ? id : ids[vi++]));
    this.columnOrderSig.set(next);
  }

  /**
   * Move a visible column within its freeze panel. `from`/`to` are indices in the global visible order;
   * the header drives this from a title drag and clamps the drop to its own panel, so a move whose
   * source and target land in different freeze panels (left/center/right) is rejected here as a no-op —
   * a drag can never pull a column across a freeze boundary. Out-of-range or same-index calls are ignored.
   */
  private reorderWithinPanel(from: number, to: number): void {
    const visible = this.visibleIds();
    if (from < 0 || from >= visible.length || to < 0 || to >= visible.length || from === to) return;
    const part = this.partitionSig();
    const panelOf = (i: number): number =>
      i < part.left.length ? 0 : i < part.left.length + part.center.length ? 1 : 2;
    if (panelOf(from) !== panelOf(to)) return; // never cross a freeze boundary
    const next = visible.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved); // standard array-move: `to` is the final index after removal
    this.setColumnOrder(next);
  }

  /**
   * The resolved width of a column in cells: an explicit override if set, else the column's declared
   * fixed width, else its measured auto width, else its title width. Reactive.
   *
   * @param id The column id.
   * @returns The resolved width in cells (0 for an unknown id).
   */
  columnWidth(id: string): number {
    return this.resolvedWidth(id);
  }

  /**
   * Set a column's explicit width, clamped to the column's `[minWidth, maxWidth]`. An unknown id is
   * ignored. The override makes the column apportion as a fixed width.
   *
   * @param id The column id.
   * @param w The requested width in cells (clamped).
   */
  setColumnWidth(id: string, w: number): void {
    const col = this.columnMap.get(id);
    if (col === undefined) return; // unknown → no-op
    const next = new Map(this.columnWidths());
    next.set(id, clampWidth(w, col.minWidth, col.maxWidth));
    this.columnWidths.set(next);
  }

  /**
   * Show or hide a column. A hidden column is omitted from the visible order/layout but stays
   * addressable by id for sort/filter (its sort/filter state is retained and reappears when shown).
   * An unknown id is ignored.
   *
   * @param id The column id.
   * @param visible `false` to hide, `true` to show.
   */
  setColumnVisible(id: string, visible: boolean): void {
    if (!this.columnMap.has(id)) return; // unknown → no-op
    const next = new Set(this.hidden());
    if (visible) next.delete(id);
    else next.add(id);
    this.hidden.set(next);
  }

  /**
   * The resolved frozen partition: which visible columns are pinned left and right (over-pinned
   * columns are pushed back to the center, so this reflects what actually renders frozen). Reactive.
   *
   * @returns The left- and right-pinned column ids, in order.
   */
  frozen(): { left: string[]; right: string[] } {
    const p = this.partitionSig();
    return { left: p.left, right: p.right };
  }

  /**
   * Size a column to its widest visible cell (its title or any displayed value), floored to the
   * column's `minWidth` and bounded by its `maxWidth` (or a generous default). Stores the result as an
   * explicit width override. An unknown id is ignored.
   *
   * @param id The column id.
   */
  autoFitColumn(id: string): void {
    if (this.windowed) return; // no-op for windowed — measuring unloaded rows would page-fault
    const col = this.columnMap.get(id);
    const idx = this.columnIndex.get(id);
    if (col === undefined || idx === undefined) return; // unknown → no-op
    const engine = this.engineCols[idx];
    let w = stringWidth(engine.title);
    for (const row of this.display()) w = Math.max(w, stringWidth(engine.accessor(row)));
    const next = new Map(this.columnWidths());
    next.set(id, clampWidth(w, col.minWidth, col.maxWidth ?? DEFAULT_AUTOFIT_MAX));
    this.columnWidths.set(next);
  }

  /** Auto-fit every visible column (see {@link EditableDataGrid.autoFitColumn}). */
  autoFitAll(): void {
    for (const id of this.visibleIds()) this.autoFitColumn(id);
  }

  /** The resolved width of a column: override → declared fixed → measured auto → title width. */
  private resolvedWidth(id: string): number {
    const override = this.columnWidths().get(id);
    if (override !== undefined) return override;
    const idx = this.columnIndex.get(id);
    if (idx === undefined) return 0;
    const col = this.engineCols[idx];
    if (typeof col.width === 'number') return col.width;
    const auto = this.autoWidths()[idx];
    if (auto !== null && auto !== undefined) return auto;
    return stringWidth(col.title);
  }

  /** The grid's usable content width in cells (drives the over-pin guard). */
  private viewportWidth(): number {
    return Math.max(0, this.bounds.width);
  }

  /** Move the over-pinned ids from their frozen panels back into the center (never a blank center). */
  private applyOverPin(part: FreezePartition, over: string[]): FreezePartition {
    if (over.length === 0) return part;
    const overSet = new Set(over);
    return {
      left: part.left.filter((id) => !overSet.has(id)),
      center: [
        ...part.left.filter((id) => overSet.has(id)),
        ...part.center,
        ...part.right.filter((id) => overSet.has(id)),
      ],
      right: part.right.filter((id) => !overSet.has(id)),
    };
  }

  /**
   * The distinct formatted labels for a column's value-list. Delegates to `source.distinct` when the
   * source provides it (which may report a `truncated` cap); otherwise computes them client-side over
   * the materialized rows (never truncated). Reactive inputs are read eagerly, so callers get a stable
   * promise per open.
   *
   * @param columnId The column to enumerate.
   * @returns The distinct labels and a truncation flag.
   */
  private distinctFor(columnId: string): Promise<DistinctResult> {
    const col = this.columnMap.get(columnId);
    if (col === undefined) return Promise.resolve({ values: [], truncated: false });
    if (this.source.distinct) return this.source.distinct(columnId);
    if (this.windowed) {
      // A windowed source must provide `distinct` (a client scan would page-fault); none ⇒ an empty list.
      devWarn('windowed-distinct', `column "${columnId}" needs source.distinct for a value-list on a windowed source.`);
      return Promise.resolve({ values: [], truncated: false });
    }
    return Promise.resolve({ values: computeDistinct(materialize(this.source), col), truncated: false });
  }

  /**
   * Open a column's filter popup, anchored just below its funnel cell. Invoked by the header on a funnel
   * click; the live dispatch envelope is forwarded so the popup mount reuses its focus/popup seam
   * (`ev.focusView`/`ev.popupHost`) — the popup's operator selector is focused through it, and its
   * nested date editors open their own calendars through it. At most one popup is open at a time.
   *
   * @param columnId The column whose filter popup to open (ignored when unknown).
   * @param anchor The funnel cell's header-local anchor, positioning the popup one row below it.
   * @param ev The live dispatch envelope carrying the focus/popup seam.
   * @param header The header panel that owns the clicked funnel — the popup anchors to its absolute
   *   origin, so in a frozen grid it lands under the right panel (the three headers differ in origin).
   */
  /**
   * Open the filter popup for a keyboard request (`Alt+Down`) on the global focused column. Maps the
   * column index to its id, no-ops when the column is unknown or non-filterable, resolves the owning
   * header from the retained panel headers, and opens the popup at that header's funnel-cell anchor —
   * the same cell a funnel click uses. In a frozen grid the owning header is whichever panel holds the
   * column, so the popup lands under the correct panel.
   *
   * @param globalCol The global focused column index (from the body's shared cursor).
   * @param ev The live dispatch envelope, forwarded so the popup inherits the focus/popup seam.
   */
  private openFilterFromKeyboard(globalCol: number, ev: DispatchEvent): void {
    const ids = this.visibleIds();
    if (globalCol < 0 || globalCol >= ids.length) return; // empty grid / out of range → no-op
    const columnId = ids[globalCol];
    const col = this.columnMap.get(columnId);
    if (col === undefined || col.filterable === false) return; // unknown or non-filterable → no-op
    for (const header of this._headers) {
      const anchor = header.funnelAnchor(columnId);
      if (anchor !== null) {
        this.openFilterPopup(columnId, anchor, ev, header);
        return;
      }
    }
  }

  private openFilterPopup(
    columnId: string,
    anchor: { x: number; y: number },
    ev: DispatchEvent,
    header: SortHeader<T>,
  ): void {
    const col = this.columnMap.get(columnId);
    if (col === undefined) return; // unknown column — no popup (guarded, never reached in practice)
    this.closeFilterPopup(); // at most one filter popup open at a time

    // Windowed: sample the first loaded row via rowAt(0), never a full materialize scan.
    const first = this.windowed ? this.source.rowAt(0) : materialize(this.source)[0];
    const sample = first !== undefined ? col.value(first) : undefined;
    const filterType = resolveFilterType(col, sample);
    const origin = absoluteRect(header);
    const holder: { view: View | null } = { view: null };

    // Build the built-in popup for this column; the customization seam either returns this (via
    // `ctx.defaultPopup()`) or its own view instead.
    const buildDefault = (): FilterPopup<T> =>
      new FilterPopup<T>({
        column: col,
        columnId,
        filterType,
        current: this.filters().get(columnId),
        distinct: () => this.distinctFor(columnId), // embeds the value-list section
        onApply: (id, next) => this.setFilter(id, next),
        onClear: (id) => this.clearFilter(id),
        onClose: () => this.closeFilterPopup(),
      });

    // A click-away catcher goes in first (below the popup); an outside mouse-down closes the popup.
    const catcher = new PopupCatcher(() => this.closeFilterPopup());
    catcher.layout = { position: 'fill' };
    this.popupOverlay.add(catcher);

    const mountDispose = mountCellOverlay({
      host: this.popupOverlay,
      loop: { focusView: (v) => ev.focusView?.(v) },
      // anchor.y is the header row; +1 drops the popup just below the funnel. The mount adds the
      // header's absolute origin, so the rect is header-local like the funnel anchor.
      rect: { x: anchor.x, y: anchor.y + 1, width: FILTER_POPUP_WIDTH, height: FILTER_POPUP_HEIGHT },
      origin,
      // Keep the popup within the grid viewport — a funnel near the right/bottom edge must not clip
      // off-screen. The popup host is a fill layer over the grid, so its host-local viewport is the
      // grid's own size. Clamp only past the FIRST layout, when the grid's bounds are measured.
      clamp: this.bounds.width > 0 ? { width: this.bounds.width, height: this.bounds.height } : undefined,
      build: () => {
        // The customization seam: a factory receives the column context (with `defaultPopup()`) and
        // returns the view to mount; without one, the built-in popup is used.
        const view: View = this.filterPopupFactory
          ? this.filterPopupFactory({
              column: col,
              columnId,
              filterType,
              current: this.filters().get(columnId),
              distinct: () => this.distinctFor(columnId),
              onApply: (id, next) => this.setFilter(id, next),
              onClear: (id) => this.clearFilter(id),
              onClose: () => this.closeFilterPopup(),
              defaultPopup: buildDefault,
            })
          : buildDefault();
        holder.view = view;
        return view;
      },
    });
    // Close disposes both the popup mount (removing the popup + its reactive scope) and the catcher.
    this.popupDispose = () => {
      mountDispose();
      this.popupOverlay.remove(catcher);
    };
    // Focus a leaf inside the popup — mountCellOverlay focuses the mounted view (a Group), not a focus
    // leaf. The built-in popup (and any custom view that opts in) exposes `focusTarget()`; otherwise the
    // view itself is focused.
    const mounted = holder.view;
    if (mounted !== null) {
      const withTarget = mounted as { focusTarget?: () => View };
      ev.focusView?.(withTarget.focusTarget ? withTarget.focusTarget() : mounted);
    }
  }

  /** Dispose the open filter popup (removing it from the overlay), if any. Idempotent. */
  private closeFilterPopup(): void {
    this.popupDispose?.();
    this.popupDispose = null;
  }

  /**
   * Snapshot the focused record's key from the current display, so a mutator can re-find it after the
   * display re-derives (the focused record stays under the cursor even when its display index moves).
   * Returns `undefined` when the grid is empty. Selection needs no snapshot — it is a `rowKey` set that
   * survives re-sort/re-filter unchanged; only a delete prunes it.
   */
  private focusAnchorKey(): Key | undefined {
    const before = this.display();
    const n = before.length;
    if (n === 0) return undefined;
    const row = before[Math.max(0, Math.min(this.focused(), n - 1))];
    if (row === undefined) return undefined; // an unloaded windowed row has no anchor key (no rowKey(undefined))
    return this.source.rowKey(row);
  }

  /**
   * The one sort mutator. Sets the new key list, then — on the client path only — re-anchors the cursor
   * to the same record it was on before the re-sort (by row key), so the focused record stays under the
   * cursor when its display index moves. The `selectedKeys` set is untouched (its keys are stable). A
   * push-down source re-queries asynchronously, so a synchronous re-anchor makes sense only in memory.
   */
  private applySort(next: SortKey[]): void {
    const anchor = this.focusAnchorKey();

    this.sortKeys.set(next);

    if (this.source.setSort) return; // push-down re-queries; the client-side re-anchor doesn't apply
    const after = this.display();
    if (anchor !== undefined) {
      const i = after.findIndex((r) => this.source.rowKey(r) === anchor);
      if (i >= 0) this.focused.set(i);
    }
  }

  /**
   * The one filter mutator. Sets the new model, then — on the client path only — re-anchors the cursor
   * by row key. Unlike a re-sort, a filter can REMOVE the focused row: when its anchor is gone the cursor
   * clamps into the shrunk display. The `selectedKeys` set is untouched — a selected row that is filtered
   * out simply stops being displayed and re-highlights when the filter clears. A push-down source
   * re-queries asynchronously, so a synchronous re-anchor makes sense only in memory.
   */
  private applyFilter(next: FilterModel): void {
    const anchor = this.focusAnchorKey();

    this.filters.set(next);

    if (this.source.setFilter) return; // push-down re-queries; the client-side re-anchor doesn't apply
    const after = this.display();
    if (anchor !== undefined) {
      const i = after.findIndex((r) => this.source.rowKey(r) === anchor);
      // The focused row survived → follow it; else clamp the cursor into the shrunk display.
      this.focused.set(i >= 0 ? i : Math.max(0, Math.min(this.focused(), after.length - 1)));
    }
  }

  /**
   * The current row selection, keyed by `rowKey`. Reactive — reading it inside an effect re-runs when
   * the selection changes. The set survives re-sort/re-filter (the keys are stable); a delete prunes it.
   *
   * @returns The selected row keys (empty when nothing is selected).
   * @example
   * ```ts
   * import { EditableDataGrid } from '@jsvision/datagrid';
   * const grid = new EditableDataGrid({ columns, source }); // default 'multi'
   * grid.selectRow(1); // select the row whose rowKey is 1
   * grid.toggleRow(3); // add row 3 → { 1, 3 }
   * [...grid.selectedKeys()]; // [1, 3]
   * grid.clearSelection(); // {}
   * ```
   */
  selectedKeys(): ReadonlySet<Key> {
    return this.selection.read();
  }

  /**
   * The record under the row cursor (reactive), or `undefined` when the grid is empty. Re-anchored by
   * `rowKey` after a sort/filter, so it follows the same record even as its display index moves — the
   * natural binding target for a master-detail link. The cursor is clamped into range, so a transiently-
   * stale cursor never returns `undefined` while rows exist.
   *
   * @returns The focused record, or `undefined` on an empty grid.
   */
  focusedRow(): T | undefined {
    const rows = this.display();
    const n = rows.length;
    if (n === 0) return undefined;
    return rows[Math.max(0, Math.min(this.focused(), n - 1))];
  }

  /**
   * The `rowKey` of the focused record (reactive), or `undefined` when the grid is empty. Shares the same
   * clamped cursor as {@link focusedRow}.
   *
   * @returns The focused row's key, or `undefined` on an empty grid.
   */
  focusedKey(): Key | undefined {
    return this.focusAnchorKey();
  }

  /** Whether the grid body currently holds keyboard focus (used by the Tab-navigation helper). */
  isBodyFocused(): boolean {
    return this._center.state.focused;
  }

  /**
   * Whether an in-cell editor is currently open on this grid. Note that while editing the keyboard focus
   * is on the editor overlay, not the body — so the Tab-navigation helper treats a grid as its active
   * target when its body is focused OR it is editing (a Tab then commits and advances by cell).
   */
  isEditing(): boolean {
    return this._center.isEditing();
  }

  /**
   * Advance the cell cursor one step forward (left-to-right, top-to-bottom), wrapping at a row end. If an
   * editor is open it is committed first; a **vetoed** commit keeps the editor open and returns `'moved'`
   * WITHOUT advancing — `'moved'` means "the grid handled Tab; do not hand focus away", not "the cursor
   * advanced". At the last cell of the last row it returns `'exit'` (the caller moves to the next widget).
   *
   * @returns `'moved'` when the grid handled the step (advanced, or held an open editor), else `'exit'`.
   * @example
   * ```ts
   * const r = await grid.nextCell();
   * if (r === 'exit') loop.focusNext(); // at the grid edge → leave to the next widget
   * ```
   */
  async nextCell(): Promise<'moved' | 'exit'> {
    return this.advanceCell(true);
  }

  /**
   * Retreat the cell cursor one step (the mirror of {@link nextCell}), wrapping at column 0. An open edit
   * is committed first; a vetoed commit keeps the editor open and returns `'moved'` without moving. At
   * `(0, 0)` it returns `'exit'`.
   *
   * @returns `'moved'` when the grid handled the step, else `'exit'` at the grid start.
   * @example
   * ```ts
   * const r = await grid.prevCell();
   * if (r === 'exit') loop.focusPrev();
   * ```
   */
  async prevCell(): Promise<'moved' | 'exit'> {
    return this.advanceCell(false);
  }

  /** The visible column count the cell cursor ranges over (visible order minus hidden columns). */
  private totalVisibleCols(): number {
    return this.visibleIds().length;
  }

  /**
   * Shared cell-advance: commit an open edit first (a vetoed commit stays put), then move the container's
   * cursor signals to the pure next/previous cell — or report `'exit'` at the grid edge. A hop that wraps
   * to a different row consults the row-leave gate first (the just-committed cell marked the row edited);
   * on a block the cursor stays and the grid keeps focus (`'moved'`).
   */
  private async advanceCell(forward: boolean): Promise<'moved' | 'exit'> {
    if (this._center.isEditing()) {
      const committed = await this._center.commitEdit();
      if (!committed) return 'moved'; // vetoed → editor stays open, cursor does not advance
    }
    const cols = this.totalVisibleCols();
    const rows = this.display().length;
    const move = forward
      ? nextCellIndex(this.focusedCol(), this.focused(), cols, rows)
      : prevCellIndex(this.focusedCol(), this.focused(), cols, rows);
    if (move === 'exit') return 'exit';
    if (move.row !== this.focused() && !this.rowGate.tryLeave()) return 'moved'; // blocked row-edge hop → stay
    this.focused.set(move.row);
    this.focusedCol.set(move.col);
    return 'moved';
  }

  /**
   * Select exactly `key`, replacing any prior selection, and make it the range anchor.
   *
   * @param key The row key to select.
   */
  selectRow(key: Key): void {
    this.selection.selectOnly(key);
  }

  /**
   * Toggle a row's membership under the selection mode (`multi` adds/removes; `single` replaces), and
   * make it the range anchor.
   *
   * @param key The row key to toggle.
   */
  toggleRow(key: Key): void {
    this.selection.toggle(key);
  }

  /**
   * Extend the selection to `toKey` as a contiguous display-order range from the current anchor (or, when
   * no anchor is set, from the focused row). A no-op on an empty grid.
   *
   * @param toKey The far end of the range, in the current display order.
   */
  selectRange(toKey: Key): void {
    this.selection.rangeTo(toKey);
  }

  /** Select every displayed (filtered/sorted) row — the header checkbox's select-all target. */
  selectAllDisplayed(): void {
    this.selection.selectAllDisplayed();
  }

  /** Clear the row selection and its range anchor. */
  clearSelection(): void {
    this.selection.clear();
  }

  /**
   * Insert a row through the data-source mutation seam. `at` is a **source-array** index (append when
   * omitted). A no-op when the source is read-only (exposes no `insert`) — the grid never persists on its
   * own. The row must already carry its `rowKey` (the caller owns key generation). With an active client
   * sort the row re-sorts to its value-determined display position on the next derive; a push-down source
   * owns its own ordering.
   *
   * @param row The row to insert (already carrying its `rowKey`).
   * @param at The source index to splice at; appended when omitted.
   * @example
   * ```ts
   * grid.insertRow({ id: 10, name: 'New' });    // appended
   * grid.insertRow({ id: 11, name: 'Top' }, 0); // spliced at the front of the source
   * ```
   */
  insertRow(row: T, at?: number): void {
    this.mutations.insertRow(row, at);
  }

  /**
   * Remove rows by key through the data-source mutation seam, then prune those keys from the selection
   * (a deleted row never stays selected). A no-op on the source when it is read-only (exposes no
   * `remove`); the selection is still pruned either way. Keys not present are ignored.
   *
   * @param keys The row keys to remove.
   * @example
   * ```ts
   * grid.deleteRows([10, 11]); // removed from the source and de-selected
   * ```
   */
  deleteRows(keys: readonly Key[]): void {
    this.mutations.deleteRows(keys);
  }

  /**
   * Insert a structured clone of the row identified by `key`, adjacent to it, carrying a fresh key from
   * the `assignKey` option. A no-op (with a dev warning) when `assignKey` is not configured — it never
   * inserts a key-colliding row. Also a no-op when `key` is absent from the display, or when the row is
   * not structured-cloneable (holds a function, a class instance, etc.) — the clone is attempted inside a
   * guard, so a non-cloneable row warns instead of throwing and never leaves a partial insert.
   *
   * @param key The key of the row to duplicate.
   * @example
   * ```ts
   * // With `assignKey: (clone) => ({ ...clone, id: nextId() })` configured:
   * grid.duplicateRow(10); // a clone with a fresh id is inserted right after row 10
   * ```
   */
  duplicateRow(key: Key): void {
    this.mutations.duplicateRow(key);
  }
}
