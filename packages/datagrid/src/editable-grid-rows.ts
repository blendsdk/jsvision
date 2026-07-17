/**
 * `EditableGridRows<T>` — the editable grid body. It subclasses the `@jsvision/ui` `GridRows` engine
 * to add a **column** cursor beside the engine's inherited **row** focus and to route every keyboard
 * gesture through a remappable keymap. The focused cell is overpainted so it reads distinctly inside the
 * highlighted row. The column cursor (`focusedCol`) is owned by the container and injected, so a later
 * frozen-panel split can share the very same signal with no retrofit.
 *
 * Input is one dispatch: a key resolves to a `GridAction` against the merged keymap (a per-grid override
 * layered over the default table), then routes to the matching seam — column-cursor moves; row
 * navigation delegated to the base engine's own helpers (so the whole nav table is remappable with no
 * re-implementation); begin-edit; value help; selection toggle/extend; and filter-open. A printable key
 * that resolves to nothing begins a replace-edit on an editable cell (that fallback is not remappable).
 * The editability precedence is preserved: on an editable cell a key that could either edit or select
 * begins the edit; on a read-only cell it selects or activates.
 *
 * Movement clamps to range (no wrap). `Ctrl+PgUp`/`Ctrl+PgDn` and any chord the keymap does not bind
 * fall through to the base row navigation unchanged. `Tab`/`Shift+Tab` are not handled here — an unbound
 * Tab is consumed by the framework's focus traversal before any view sees it; cell-to-cell Tab traversal
 * is wired at the application level as a loop command.
 */
import { GridRows, alignCell, apportionColumns, stringWidth, signal } from '@jsvision/ui';
import type { GridRowsConfig, ColumnGeometry, DispatchEvent, DrawContext, Signal, Group } from '@jsvision/ui';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import type { GridColumn } from './column.js';
import { isEditable } from './column.js';
import type { Key } from './selection.js';
import type { OnCommit, BeforeSave } from './commit.js';
import type { CellRect } from './overlay.js';
import { createEditController, cellKey } from './editing.js';
import type { CellRef, EditController, DirtyRegistry } from './editing.js';
import type { ErrorRegistry } from './error-registry.js';
import { safeRender } from './cell-draw.js';
import type { RenderCell } from './cell-draw.js';
import { resolveGridAction, mergeKeymap } from './keymap.js';
import type { GridAction, GridKeymap } from './keymap.js';

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
  /**
   * The merged chord→action keymap the body resolves keys against. The container computes it once
   * (`mergeKeymap(callerOverrides)`) and passes the same frozen map to every panel, so a remap is shared
   * across a frozen-panel split. Omit to use the default table.
   */
  keymap?: GridKeymap;
  /** The typed columns (parse/set/format live here; the base `columns` are the engine adapters). */
  typedColumns: GridColumn<T>[];
  /** The editor mount host (the container's absolute overlay group). */
  overlay: Group;
  /** The optional per-cell veto sink. */
  onCommit?: OnCommit<T>;
  /** The optional per-cell gate above `onCommit` (a veto reverts and skips `onCommit`). */
  beforeSave?: BeforeSave<T>;
  /** The row-identity function (from the data source). */
  rowKey: (row: T) => string | number;
  /** Bump-on-write so an in-place `set` repaints the mutated row. */
  bumpVersion: () => void;
  /** The shared dirty registry (pending-commit markers); omit to disable dirty tracking. */
  dirty?: DirtyRegistry;
  /** The shared invalid-cell registry (the `gridInvalid` band + message); omit to disable surfacing. */
  errors?: ErrorRegistry;
  /**
   * The datagrid selection set, keyed by `rowKey` — the body paints a row's `selected` role by
   * membership here (not the base's single `selected` index, which is kept only as the base's required
   * click sink). Optional: omit for a body that shows no selection (defaults to an empty set).
   */
  selectedKeys?: Signal<ReadonlySet<Key>>;
  /**
   * Toggle the selection of the row at a display index — wired to `Space` on a read-only focused cell
   * and `Ctrl`+click. The container maps the index to a key, moves the cursor to it, and toggles it.
   * Omitted for a body without selection (the gesture then falls through to the base).
   */
  onToggleRow?: (rowIndex: number) => void;
  /**
   * Extend the selection range to the row at a display index — wired to `Shift`+click and `Shift`+↑/↓.
   * The container captures the pre-move cursor row as the range's default anchor, moves the cursor to
   * the target, and unions the display-order run. Omitted for a body without selection.
   */
  onRangeToRow?: (rowIndex: number) => void;
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
  /**
   * Open-filter sink: fired when `Alt+Down` is pressed on the non-editing body, with the GLOBAL focused
   * column index and the live dispatch envelope (so the popup inherits `ev.focusView`/`ev.popupHost`).
   * The container resolves the column's filterability and owning header and opens the condition popup.
   * Optional — a body without it ignores `Alt+Down` (which then falls through to the base row cursor).
   */
  onOpenFilter?: (globalCol: number, ev: DispatchEvent) => void;
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
  /**
   * Compact density (default `false`): drop the inter-column `│` divider, reclaiming its cell so columns
   * pack tighter. The geometry apportions over the full width with no divider cells and `draw` skips the
   * `│`; the header/quick-filter must use the same setting so every band stays column-aligned.
   */
  compact?: boolean;
  /**
   * Clamp the top of this panel's virtual window to `[rowFloor, rowCeil]` (default `[0, ∞)`). Used to
   * split the row axis for frozen rows: a **pinned band** sets `rowFloor: 0, rowCeil: 0` (its window
   * never scrolls off row 0), while the **scrolling body** sets `rowFloor: N` (its window starts after
   * the N pinned rows, so a pinned row is never rendered twice). The shared `focused` cursor still ranges
   * over the whole row set; the panel that does not own the cursor simply doesn't render it (its window
   * excludes that row), and the sibling that does render it lights it up.
   */
  rowFloor?: number;
  rowCeil?: number;
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
  /** The merged chord→action keymap this body resolves keys against (defaults to the default table). */
  protected readonly keymap: GridKeymap;
  /** The typed columns (parse/set/format), parallel to the base engine `columns`. */
  protected readonly typedColumns: GridColumn<T>[];
  /** The absolute overlay group the editor mounts into. */
  protected readonly overlay: Group;
  /** The optional per-cell veto sink. */
  protected readonly onCommit?: OnCommit<T>;
  /** The optional per-cell gate above `onCommit`. */
  protected readonly beforeSave?: BeforeSave<T>;
  /** The row-identity function. */
  protected readonly rowKey: (row: T) => string | number;
  /** Bump-on-write repaint hook (the container owns the `version` signal). */
  protected readonly bumpVersion: () => void;
  /** The shared dirty registry (pending-commit markers), or `undefined` when dirty tracking is off. */
  protected readonly dirty?: DirtyRegistry;
  /** The shared invalid-cell registry (the `gridInvalid` band), or `undefined` when surfacing is off. */
  protected readonly errors?: ErrorRegistry;
  /** The datagrid selection set the body paints from (empty when the container wires no selection). */
  protected readonly selectedKeys: Signal<ReadonlySet<Key>>;
  /** Toggle-row gesture sink (`Space` on a read-only cell / `Ctrl`+click); `undefined` when off. */
  private readonly onToggleRow?: (rowIndex: number) => void;
  /** Range-extend gesture sink (`Shift`+click / `Shift`+↑↓); `undefined` when off. */
  private readonly onRangeToRow?: (rowIndex: number) => void;
  /** This panel's start index in the global column order (`0` for a single body). */
  readonly columnOffset: number;
  /** This panel's own column count (the length of its column slice). */
  readonly columnCount: number;
  /** The global visible column count (defaults to this panel's own count). */
  private readonly totalColsFn: () => number;
  /** Re-focus hop when the cursor leaves this panel's range (frozen-panel mode). */
  private readonly onCursorEnterPanel?: (globalCol: number, ev: DispatchEvent) => void;
  /** Open-filter sink for `Alt+Down` (reports the global focused column up to the container). */
  private readonly onOpenFilter?: (globalCol: number, ev: DispatchEvent) => void;
  /** Whether a mouse-down sets the global column cursor (frozen-panel mode). */
  private readonly mouseColumns: boolean;
  /** Whether moving the cursor off-screen scrolls this panel to reveal it (center panel). */
  private readonly autoScrollColumns: boolean;
  /** Grid-wide focus predicate (frozen-panel mode); `undefined` for a single body. */
  private readonly panelActive?: () => boolean;
  /** Reactive column-width trigger (bound for repaint on a live resize/auto-fit); `undefined` when off. */
  private readonly widthTick?: () => unknown;
  /** Whether to reserve + paint the inter-column divider (`false` in compact density). */
  private readonly dividers: boolean;
  /** Lower / upper clamp on the virtual window's top row (frozen-rows split); defaults `0` / `∞`. */
  private readonly rowFloor: number;
  private readonly rowCeil: number;
  /** The in-cell editing lifecycle controller. */
  protected readonly controller: EditController;

  /**
   * @param cfg The base grid config plus the injected cursor + editing wiring (see {@link EditableGridRowsConfig}).
   */
  constructor(cfg: EditableGridRowsConfig<T>) {
    super(cfg);
    this.focusedCol = cfg.focusedCol;
    // The container passes an already-merged, frozen map shared by every panel; a direct caller may omit
    // it, in which case the default table is used (merged over itself for a stable frozen instance).
    this.keymap = cfg.keymap ?? mergeKeymap();
    this.typedColumns = cfg.typedColumns;
    this.overlay = cfg.overlay;
    this.onCommit = cfg.onCommit;
    this.beforeSave = cfg.beforeSave;
    this.rowKey = cfg.rowKey;
    this.bumpVersion = cfg.bumpVersion;
    this.dirty = cfg.dirty;
    this.errors = cfg.errors;
    this.selectedKeys = cfg.selectedKeys ?? signal<ReadonlySet<Key>>(new Set());
    this.onToggleRow = cfg.onToggleRow;
    this.onRangeToRow = cfg.onRangeToRow;
    this.columnOffset = cfg.columnOffset ?? 0;
    this.columnCount = cfg.columns.length;
    this.totalColsFn = cfg.totalCols ?? (() => this.columns.length);
    this.onCursorEnterPanel = cfg.onCursorEnterPanel;
    this.onOpenFilter = cfg.onOpenFilter;
    this.mouseColumns = cfg.mouseColumns ?? false;
    this.autoScrollColumns = cfg.autoScrollColumns ?? false;
    this.panelActive = cfg.panelActive;
    this.widthTick = cfg.widthTick;
    this.dividers = cfg.compact !== true;
    this.rowFloor = cfg.rowFloor ?? 0;
    this.rowCeil = cfg.rowCeil ?? Number.POSITIVE_INFINITY;
    // The controller reaches this body only through the EditHost seam below — no access to protected state.
    this.controller = createEditController<T>({
      body: this,
      overlay: this.overlay,
      typedColumns: this.typedColumns,
      onCommit: this.onCommit,
      beforeSave: this.beforeSave,
      bumpVersion: this.bumpVersion,
      dirty: this.dirty,
      errors: this.errors,
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
      // Repaint when the datagrid selection set changes (the body paints by set membership, so the
      // base's own `selected` bind does not cover it).
      this.bind(
        () => this.selectedKeys(),
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
      // Repaint when the invalid set changes, so the `gridInvalid` band appears/clears reactively.
      const errors = this.errors;
      if (errors !== undefined) {
        this.bind(
          () => errors.keys(),
          () => undefined,
        );
      }
    });
  }

  /** Whether an in-cell editor is currently open on this body. */
  isEditing(): boolean {
    return this.controller.isEditing();
  }

  /**
   * Commit an open editor without advancing the cursor or refocusing (the Tab command path has no event
   * envelope). Resolves whether the value committed; the caller advances by cell and restores focus.
   */
  commitEdit(): Promise<boolean> {
    return this.controller.commitEdit();
  }

  /**
   * The column geometry for this panel — like the base, but honouring compact density (no reserved
   * divider cell) so the header/body/quick-filter all apportion identically.
   */
  protected override geometry(width: number): ColumnGeometry {
    return apportionColumns(this.columns, this.autoWidths(), width, this.dividers);
  }

  /**
   * Keep the focused row visible, then clamp the window top into `[rowFloor, rowCeil]`. A pinned band
   * (`rowFloor: 0, rowCeil: 0`) never scrolls off row 0; a scrolling body (`rowFloor: N`) never renders
   * a pinned row — so the shared cursor is drawn by whichever panel's window contains it, never both.
   */
  protected override updateTop(): void {
    super.updateTop();
    this.topItem = clamp(this.topItem, this.rowFloor, this.rowCeil);
  }

  /**
   * Selection is cursor-only on a plain click: the base moves the row cursor via `focusTo`, then calls
   * `select(index)` to set its single-index highlight — but the datagrid paints selection from the
   * `selectedKeys` set (toggled by `Space`/`Ctrl`+click/`Shift`/the checkbox column), so this override
   * makes that per-click `select` a no-op. A plain click therefore never changes the selection (and the
   * base's `activate()`, which also calls `select`, no longer highlights either). The base `selected`
   * signal stays at its initial value — it is kept only because `GridRowsConfig` requires it.
   */
  protected override select(): void {
    // Intentionally empty — see the doc above: a plain click is cursor-only.
  }

  /**
   * Resolve a key to a `GridAction` against the merged keymap and route it, falling back to printable
   * type-to-edit; handle selection clicks; let everything else reach the base (row navigation,
   * activation, mouse, wheel).
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'key') {
      const action = resolveGridAction(inner, this.keymap);
      if (action !== undefined && this.runAction(action, ev)) {
        ev.handled = true;
        return;
      }
      // A printable that resolved to no action begins a replace-edit on an editable cell (not remappable).
      if (this.tryPrintableEdit(inner, ev)) {
        ev.handled = true;
        return;
      }
    }
    if (inner.type === 'mouse' && inner.kind === 'down') {
      // A body click sets the column cursor to the clicked cell (single-click cell focus).
      if (this.mouseColumns) this.setColFromClick(ev);
      // A double-click on an editable cell begins the edit — intercept before super.onEvent so the base's
      // clickCount===2 row-activate does not also fire on an editable cell.
      if (this.handleDoubleClickEdit(ev)) {
        ev.handled = true;
        return;
      }
      // Ctrl/Shift+click drive selection (toggle / range) instead of a plain cursor move — intercept
      // before the base so the base's plain focus+select does not also run.
      if (this.handleSelectionClick(inner, ev)) {
        ev.handled = true;
        return;
      }
    }
    super.onEvent(ev);
  }

  /**
   * Route a resolved {@link GridAction} to its behavior seam; returns whether it was consumed. Navigation
   * actions are global-cursor ops and always run. Edit / value-help / selection actions carry the same
   * per-panel and editability guards the pre-keymap handlers did: an edit begins only on an editable
   * focused cell this panel owns, and a panel that does not own the global cursor (`localCol() < 0`) — or
   * whose cursor sits on a pinned band row (`focused() < rowFloor`) — does not begin an edit, so a
   * frozen-panel split never double-fires or edits the wrong panel's column 0.
   *
   * @param action The resolved grid action.
   * @param ev The dispatch envelope (forwarded to the edit controller / cursor hop / filter opener).
   * @returns Whether the action was consumed (an unconsumed key falls through to the base).
   */
  private runAction(action: GridAction, ev: DispatchEvent): boolean {
    switch (action) {
      case 'moveLeft':
        this.setGlobalCol(this.focusedCol() - 1, ev);
        return true;
      case 'moveRight':
        this.setGlobalCol(this.focusedCol() + 1, ev);
        return true;
      case 'moveUp':
        this.focusBy(-1);
        return true;
      case 'moveDown':
        this.focusBy(1);
        return true;
      case 'pageUp':
        this.focusBy(-this.viewportRows());
        return true;
      case 'pageDown':
        this.focusBy(this.viewportRows());
        return true;
      case 'rowStart':
        this.setGlobalCol(0, ev);
        return true;
      case 'rowEnd':
        this.setGlobalCol(this.totalCols() - 1, ev);
        return true;
      case 'gridStart':
        this.focused.set(0);
        this.setGlobalCol(0, ev);
        return true;
      case 'gridEnd':
        this.focused.set(Math.max(0, this.display().length - 1));
        this.setGlobalCol(this.totalCols() - 1, ev);
        return true;
      case 'beginEdit':
        if (this.editableCol() < 0) return false; // read-only / other panel / pinned row → base activate
        this.controller.beginEdit(ev);
        return true;
      case 'valueHelp':
        if (this.editableCol() < 0) return false;
        this.controller.beginEdit(ev, { openDropdown: true });
        return true;
      case 'toggleSelect':
        return this.runToggleSelect();
      case 'extendUp':
        return this.runExtend(-1);
      case 'extendDown':
        return this.runExtend(1);
      case 'openFilter':
        // While a cell editor is open it owns the key (incl. its own value-help); a body without an
        // open-filter sink ignores the action (it then falls through to the base row cursor).
        if (this.onOpenFilter === undefined || this.controller.isEditing()) return false;
        this.onOpenFilter(this.focusedCol(), ev);
        return true;
      default:
        // `nextCell`/`prevCell` are delivered as loop commands (Tab); `commit`/`cancel` are owned by the
        // open editor's host — none is body-key-resolved, so let the key fall through to the base.
        return false;
    }
  }

  /**
   * Extend the selection range by one row (`delta` = ±1) from the current cursor row; returns whether it
   * was consumed. The container owns the cursor move (so it can capture the pre-move row as the range
   * anchor), so this reports the TARGET index only. A panel that does not own the cursor no-ops.
   */
  private runExtend(delta: number): boolean {
    const range = this.display().length;
    if (range === 0) return false;
    if (this.localCol() < 0) return false; // the cursor is in another panel — not ours to act on
    if (this.onRangeToRow === undefined) return false;
    this.onRangeToRow(clamp(this.focused() + delta, 0, range - 1));
    return true;
  }

  /**
   * Toggle the focused row's selection on `Space` — but only on a read-only focused cell: on an editable
   * cell the printable-edit fallback claims `Space` (a replace-edit), preserving the edit-before-select
   * precedence. A panel that does not own the cursor no-ops. Returns whether it was consumed.
   */
  private runToggleSelect(): boolean {
    if (this.editableCol() >= 0) return false; // editable focused cell → Space begins an edit instead
    const range = this.display().length;
    if (range === 0) return false;
    if (this.localCol() < 0) return false; // the cursor is in another panel — not ours to act on
    if (this.onToggleRow === undefined) return false;
    this.onToggleRow(clamp(this.focused(), 0, range - 1));
    return true;
  }

  /**
   * Selection clicks: `Ctrl`+click toggles the clicked row, `Shift`+click extends the range to it. Both
   * report the clicked display index and let the container move the cursor + apply the pure op; a plain
   * (unmodified) click returns false so the base's cursor-only focus runs. Returns whether it was
   * consumed.
   */
  private handleSelectionClick(inner: MouseEvent, ev: DispatchEvent): boolean {
    const local = ev.local;
    if (local === undefined) return false;
    const range = this.display().length;
    if (range === 0) return false;
    const rowIndex = Math.min(this.topItem + local.y, range - 1);
    if (inner.ctrl === true && inner.shift !== true) {
      if (this.onToggleRow === undefined) return false;
      this.onToggleRow(rowIndex);
      return true;
    }
    if (inner.shift === true && inner.ctrl !== true) {
      if (this.onRangeToRow === undefined) return false;
      this.onRangeToRow(rowIndex);
      return true;
    }
    return false;
  }

  /**
   * Begin an edit on a double-click over an editable cell. The event loop stamps `ev.clickCount` (same
   * cell within a 500 ms window, injectable clock) on the mouse-down, so no bespoke timer is needed. This
   * runs in the mouse-down branch before the base, so the base's `clickCount===2` row-activate never also
   * fires on an editable cell; a single click, a read-only cell, or a cell in another panel falls through
   * to the base activate. By this point the clicked cell's row (from the first down's focus) and column
   * (from `setColFromClick`) are already the cursor, so this only resolves editability and opens the editor.
   */
  private handleDoubleClickEdit(ev: DispatchEvent): boolean {
    if (ev.clickCount !== 2) return false;
    if (this.editableCol() < 0) return false; // read-only / other panel / pinned row → base activate
    return this.controller.beginEdit(ev);
  }

  /** Set the global column cursor from a mouse-down x (single-click cell focus / frozen-panel mode). */
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
   * The local column index of the focused cell IF it is editable and the cursor is on a scrolling
   * (non-pinned) row this panel owns; else -1. The single guard shared by begin-edit, value help, and
   * the printable-edit fallback — matching the pre-keymap edit precedence exactly.
   */
  private editableCol(): number {
    if (this.focused() < this.rowFloor) return -1; // the cursor is on a pinned row (the band owns it)
    const c = this.localCol();
    if (c < 0) return -1; // the cursor is in another panel — not ours to edit
    const col = this.typedColumns[c];
    return col !== undefined && isEditable(col) ? c : -1;
  }

  /**
   * The printable type-to-edit fallback: when a key resolved to no action, a non-chord single-codepoint
   * key (or `Space`) over an editable focused cell begins a replace-edit seeded with that character.
   * Detection mirrors `Input.insertPrintable` (there is no `char` field on a key event): printable iff
   * not a chord and a single code point. Returns whether it was consumed.
   */
  private tryPrintableEdit(inner: KeyEvent, ev: DispatchEvent): boolean {
    if (this.editableCol() < 0) return false; // read-only / other panel / pinned row → not editable
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
    const selectedKeys = this.selectedKeys();
    const divider = ctx.color('listDivider');

    for (let i = 0; i < rows; i += 1) {
      const item = top + i;
      if (item >= range) {
        ctx.fillRect(0, i, width, 1, ' ', normal); // blank trailing row
        continue;
      }
      const row = display[item];
      const isFocusedRow = item === focusedRow;
      const isSelectedRow = selectedKeys.has(this.rowKey(row)); // set membership, not a single index
      const zebra = this.zebra && (item & 1) === 1;
      // Row colour priority: focused > selected > zebra stripe > normal. A row in the selection set
      // paints the dedicated `gridSelectedRow` band (distinct from a normal row's bg); a blurred grid's
      // focused row keeps the base `listSelected` look.
      const roleName = isFocusedRow
        ? active
          ? 'listFocused'
          : 'listSelected'
        : isSelectedRow
          ? 'gridSelectedRow'
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
              invalid: this.errors?.has(cellKey(this.rowKey(row), tcol.id)) ?? false,
              zebra,
            },
          };
          safeRender(ctx, x, i, w, cellStyle, tcol.render, cell); // draw-error isolated
        } else {
          const text = alignCell(col.accessor(row), w, col.align ?? 'left', stringWidth);
          ctx.text(x, i, text, cellStyle); // ctx clips off-screen cells (H-scroll)
        }
        if (this.dividers) ctx.text(x + w, i, DIVIDER, divider); // divider at the column right edge (compact skips it)
      }
    }

    // Final overpaints, in precedence order cursor > gridInvalid > gridDirty: the cursor cell keeps its
    // box (paintInvalidCells skips it), an invalid cell shows a solid band, and the dirty `•` marks only
    // cells that are neither the cursor nor invalid.
    this.paintCursorCell(ctx);
    this.paintInvalidCells(ctx);
    this.paintDirtyMarkers(ctx);
  }

  /**
   * Overpaint every visible invalid cell as a filled `gridInvalid` band with its text redrawn on top —
   * a stronger signal than the pending-commit `•`, so a blocked edit reads as a hard error. The active
   * cursor cell is skipped (cursor wins over invalid), and the dirty marker yields to it (invalid wins
   * over dirty), giving the precedence cursor > gridInvalid > gridDirty. Uses the same geometry + indent
   * clamp as the base so the band lines up with the painted cell; `ctx` clips anything scrolled off.
   *
   * @param ctx The clipped, view-local paint context.
   */
  protected paintInvalidCells(ctx: DrawContext): void {
    const registry = this.errors;
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
    const style = ctx.color('gridInvalid');

    for (let i = 0; i < ctx.size.height; i += 1) {
      const item = this.topItem + i;
      if (item >= range) break;
      const row = display[item];
      const rk = this.rowKey(row);
      for (let c = 0; c < this.columns.length; c += 1) {
        const w = geom.widths[c];
        if (w <= 0 || !registry.has(cellKey(rk, this.typedColumns[c].id))) continue;
        if (active && item === focusedRow && c === focusedCol) continue; // cursor wins over the invalid band
        const x = geom.starts[c] - indent;
        ctx.fillRect(x, i, w, 1, ' ', style);
        const col = this.columns[c];
        const text = alignCell(col.accessor(row), w, col.align ?? 'left', stringWidth);
        ctx.text(x, i, text, style);
      }
    }
  }

  /**
   * Overpaint a `•` in the `gridDirty` foreground on every visible cell that has a pending commit. The
   * marker foreground is composited over whatever background the cell already shows (the cursor cell,
   * the focused/selected row, a zebra stripe, or a normal row), so it never punches a hole in a
   * coloured row. `•` measures one cell, so it never splits a wide neighbour. An invalid cell is skipped
   * — its solid band supersedes the pending marker (invalid > dirty).
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
    const selectedKeys = this.selectedKeys();
    const dirtyFg = ctx.color('gridDirty').fg;
    const cursorBg = ctx.color('gridCursor').bg;

    for (let i = 0; i < ctx.size.height; i += 1) {
      const item = this.topItem + i;
      if (item >= range) break;
      const rk = this.rowKey(display[item]);
      for (let c = 0; c < this.columns.length; c += 1) {
        const w = geom.widths[c];
        const ck = cellKey(rk, this.typedColumns[c].id);
        if (w <= 0 || !registry.has(ck)) continue;
        if (this.errors?.has(ck)) continue; // an invalid band supersedes the pending marker (invalid > dirty)
        // Recompute the cell's background so the marker composites onto it (the base's row-colour
        // priority is focused > selected > zebra > normal; the active focused cell shows the cursor bg).
        const bg =
          active && item === focusedRow && c === focusedCol
            ? cursorBg
            : item === focusedRow
              ? active
                ? ctx.color('listFocused').bg
                : ctx.color('listSelected').bg
              : selectedKeys.has(rk)
                ? ctx.color('gridSelectedRow').bg
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
