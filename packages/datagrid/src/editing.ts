/**
 * The in-cell editing lifecycle: a small `idle ↔ editing` state machine that mounts an editor over the
 * focused cell, captures Enter/Esc from the editor's host, and drives the per-cell commit seam
 * (optimistic write + revert-on-veto) with per-cell serialization.
 *
 * The controller is view-agnostic: it reaches the grid body only through the {@link EditHost} seam
 * (which the body implements over its own private state), so the machine has no direct dependency on
 * the renderer's internals. Commit is **await-close** — the editor stays open across an async
 * `onCommit`, closing (and advancing) only once the veto resolves.
 */
import { Group, signal, ComboBox, DatePicker } from '@jsvision/ui';
import type { View, Signal, DispatchEvent } from '@jsvision/ui';
import { CLEARED_LAYOUT } from './cleared-layout.js';
import type { GridColumn } from './column.js';
import { isEditable } from './column.js';
import type { OnCommit, BeforeSave } from './commit.js';
import { commitCell } from './commit.js';
import type { ErrorRegistry } from './error-registry.js';
import { createCellEditor } from './cell-editor.js';
import { PARSE_FAILED } from './format.js';
import { mountCellOverlay, absoluteRect } from './overlay.js';
import type { CellRect } from './overlay.js';

/** The cell-key separator — a NUL byte, which cannot occur in a realistic row key or column id. */
const KEY_SEP = String.fromCharCode(0);

/**
 * Focus the editor's real target. A `Group` editor (a `DatePicker` or `ComboBox`) is not a focusable
 * leaf, so `focusView` (which only focuses leaves) would no-op on it — focus its `.input` child
 * instead. Leaf editors (`Input`, `CheckGroup`) are focused directly. This is what lets a keystroke
 * land in the editor and lets Enter/Esc bubble up to the editor host.
 */
function focusEditor(ev: DispatchEvent, editor: View): void {
  const target = editor instanceof DatePicker || editor instanceof ComboBox ? editor.input : editor;
  ev.focusView?.(target);
}

/**
 * A stable cell key joining the row key and column id with a NUL byte. The separator cannot occur in a
 * realistic row key or column id, so distinct cells never collide and a `rowKey`-plus-separator prefix
 * cleanly matches every cell in one row.
 *
 * @param rowKey The row's stable key.
 * @param columnId The column id.
 * @returns The joined key (`rowKey`, a NUL byte, then `columnId`).
 * @example
 * ```ts
 * import { cellKey } from '@jsvision/datagrid';
 * const k = cellKey(42, 'name'); // the row key, a NUL byte, then the column id
 * ```
 */
export const cellKey = (rowKey: string | number, columnId: string): string => `${rowKey}${KEY_SEP}${columnId}`;

/** A reactive registry of cells with a pending (not-yet-confirmed) commit. */
export interface DirtyRegistry {
  /** Mark a cell key pending. */
  add(key: string): void;
  /** Clear a cell key. */
  delete(key: string): void;
  /** Whether a cell key is pending — a reactive read (re-runs in an effect on change). */
  has(key: string): boolean;
  /** The current pending set — a reactive read (for the row/grid rollups and the marker overpaint). */
  keys(): ReadonlySet<string>;
}

/**
 * Create a reactive dirty registry. `add`/`delete` publish a **fresh** `Set` reference so effects that
 * read `has`/`keys` re-run, driving the `•` marker overpaint and the `isDirty` rollups reactively.
 *
 * @returns A {@link DirtyRegistry}.
 * @example
 * ```ts
 * import { createDirtyRegistry, cellKey } from '@jsvision/datagrid';
 * const dirty = createDirtyRegistry();
 * dirty.add(cellKey(1, 'name'));
 * dirty.has(cellKey(1, 'name')); // true
 * ```
 */
export function createDirtyRegistry(): DirtyRegistry {
  const set = signal<ReadonlySet<string>>(new Set());
  const replace = (mut: (s: Set<string>) => void): void => {
    const next = new Set(set());
    mut(next);
    set.set(next); // a fresh Set reference so reactive readers re-run
  };
  return {
    add: (k) => {
      if (!set().has(k)) {
        replace((s) => {
          s.add(k);
        });
      }
    },
    delete: (k) => {
      if (set().has(k)) {
        replace((s) => {
          s.delete(k);
        });
      }
    },
    has: (k) => set().has(k),
    keys: () => set(),
  };
}

/** The cell an edit targets. */
export interface CellRef<T> {
  /** The row record. */
  readonly row: T;
  /** The row's stable key. */
  readonly rowKey: string | number;
  /** The column index. */
  readonly col: number;
  /** The column id. */
  readonly columnId: string;
}

/**
 * The seam the {@link EditController} needs from the grid body. The body implements it over its own
 * (private) cursor/geometry state, so the controller never touches the renderer's internals.
 */
export interface EditHost<T> {
  /** The grid body view — used for the overlay's absolute origin and to refocus on close. */
  readonly body: View;
  /** The absolute overlay group the editor mounts into. */
  readonly overlay: Group;
  /** The typed columns (parse/set/format live here). */
  readonly typedColumns: GridColumn<T>[];
  /** The optional per-cell veto sink. */
  readonly onCommit?: OnCommit<T>;
  /** The optional per-cell gate above `onCommit` (a veto reverts and skips `onCommit`). */
  readonly beforeSave?: BeforeSave<T>;
  /** Bump-on-write so an in-place `set` repaints the mutated row. */
  readonly bumpVersion: () => void;
  /** The shared dirty registry (pending-commit markers); omit to disable dirty tracking. */
  readonly dirty?: DirtyRegistry;
  /** The shared invalid-cell registry (marker + message); omit to disable error surfacing. */
  readonly errors?: ErrorRegistry;
  /** Mark a row as edited (a cell committed) so the row-leave gate knows to validate it; omit to disable. */
  readonly markRowTouched?: (rowKey: string | number) => void;
  /** The focused cell (row + column), or `null` when the grid is empty. */
  currentCell(): CellRef<T> | null;
  /** The focused cell's rect in body-local coordinates (for the overlay mount). */
  cellRect(): CellRect;
  /** Advance the row cursor to the next row (clamped), keeping the column. */
  advanceRow(): void;
}

/** The editing lifecycle controller — begin-edit plus the commit/cancel it drives from the editor host. */
export interface EditController {
  /**
   * Begin editing the focused cell. Mounts a focused editor over an editable cell; a read-only cell,
   * an in-flight commit on that cell, or an already-open editor is rejected.
   *
   * @param ev The dispatch envelope carrying the focus seam.
   * @param opts `replaceWith` seeds the field with a typed character (a printable begin-edit);
   *   `openDropdown` auto-opens the dropdown when the mounted editor is a value-help `ComboBox` (F4).
   * @returns Whether an editor was opened.
   */
  beginEdit(ev: DispatchEvent, opts?: { replaceWith?: string; openDropdown?: boolean }): boolean;
  /** Whether an editor is currently open. */
  isEditing(): boolean;
  /**
   * Commit an open editor (parse → veto → write) without advancing the cursor or refocusing anything,
   * and resolve whether the value committed. Unlike the `Enter` path (which advances by row and refocuses
   * the body from its event envelope), this is driven by the envelope-free `Tab` command path: the caller
   * advances by cell and restores focus. Resolves `false` when idle, unparseable, or vetoed (the editor
   * then stays open); `true` after a successful commit (the editor is closed).
   */
  commitEdit(): Promise<boolean>;
}

type EditState<T> =
  { kind: 'idle' } | { kind: 'editing'; cell: CellRef<T>; field: Signal<string>; editor: View; dispose: () => void };

/**
 * Build the in-cell editing controller for a grid body.
 *
 * @param host The grid-body seam the controller drives (see {@link EditHost}).
 * @returns The {@link EditController} the body wires into its key handling.
 * @example
 * ```ts
 * // Inside a grid body that implements EditHost over its own state (createEditController is internal —
 * // not re-exported from the package barrel — so a caller inside the package imports it by relative path):
 * import { Group } from '@jsvision/ui';
 * import type { DispatchEvent } from '@jsvision/ui';
 * import { createEditController } from './editing.js';
 * import type { EditHost, CellRef } from './editing.js';
 * import type { CellRect } from './overlay.js';
 * import { column } from './column.js';
 *
 * interface Row { id: number; name: string }
 * const rows: Row[] = [{ id: 1, name: 'Ada' }];
 * const typedColumns = [
 *   column({ id: 'name', title: 'Name', value: (r: Row) => r.name, parse: (t: string) => t, set: (r: Row, v: string) => { r.name = v; } }),
 * ];
 * const body = new Group();
 * const overlay = new Group();
 * let focusedIndex = 0;
 * const host: EditHost<Row> = {
 *   body,
 *   overlay,
 *   typedColumns,
 *   bumpVersion: () => {},
 *   currentCell: (): CellRef<Row> | null => {
 *     const row = rows[focusedIndex];
 *     return row === undefined ? null : { row, rowKey: row.id, col: 0, columnId: 'name' };
 *   },
 *   cellRect: (): CellRect => ({ x: 0, y: focusedIndex, width: 10, height: 1 }),
 *   advanceRow: () => { focusedIndex = Math.min(focusedIndex + 1, rows.length - 1); },
 * };
 * const controller = createEditController<Row>(host);
 * // In the body's key handler, on F2/Enter/printable over an editable cell:
 * const ev: DispatchEvent = { event: { type: 'key', key: 'F2', ctrl: false, alt: false, shift: false }, handled: false };
 * controller.beginEdit(ev);
 * ```
 */
export function createEditController<T>(host: EditHost<T>): EditController {
  let state: EditState<T> = { kind: 'idle' };
  // Per-cell serialization guard: at most one commit in flight per cell, so a second Enter (or a
  // begin-edit) on a cell whose commit is still resolving is ignored rather than overlapping.
  const committing = new Set<string>();

  function beginEdit(ev: DispatchEvent, opts?: { replaceWith?: string; openDropdown?: boolean }): boolean {
    if (state.kind !== 'idle') return false;
    const cell = host.currentCell();
    if (cell === null) return false;
    const tcol = host.typedColumns[cell.col];
    if (tcol === undefined || !isEditable(tcol) || committing.has(cellKey(cell.rowKey, cell.columnId))) {
      return false;
    }
    // Seed the editor from the cell's current display text — but a nullish value seeds EMPTY (never the
    // literal "null" or a formatted null), so clearing an already-null cell and re-committing keeps it
    // null. The `nullDisplay` string is a render affordance, not editable text.
    const seedValue = tcol.value(cell.row);
    const seed =
      opts?.replaceWith ??
      (seedValue === null || seedValue === undefined
        ? ''
        : tcol.format
          ? tcol.format(seedValue, cell.row)
          : String(seedValue));
    const field = signal(seed);
    // A holder read back after the mount — the editor is built inside the overlay's root (below), and a
    // closure-assigned local would not narrow cleanly for the read.
    const built: { editor: View | null } = { editor: null };
    const dispose = mountCellOverlay({
      host: host.overlay,
      loop: { focusView: (v: View) => ev.focusView?.(v) },
      rect: host.cellRect(),
      origin: absoluteRect(host.body),
      // Built INSIDE the mount's reactive root so a typed editor's field bridges (which create their
      // effects eagerly at construction) are owned by that scope and disposed when the overlay closes.
      build: () => {
        const e = createCellEditor(tcol, field, { overlay: host.overlay }, cell.row);
        built.editor = e;
        if (e === null) return null; // a read-only editor kind → mount nothing
        const editorHost = new Group();
        // Every other prop is reset explicitly, not merely left unset: a custom editor factory's own
        // layout on the view it returns is intentionally discarded, so an editor always fills its cell
        // no matter what the factory set. An explicit `undefined` clears a prop back to its default.
        e.setLayout({ ...CLEARED_LAYOUT, position: 'fill' });
        editorHost.add(e);
        // Enter/Esc bubble up the focus chain from the editor (which leaves them unhandled) to this host.
        editorHost.onEvent = (ev2: DispatchEvent): void => onEditorKey(ev2);
        return editorHost;
      },
    });
    const editor = built.editor;
    if (editor === null) {
      dispose(); // tear down the empty root the null build created
      return false; // defensive — isEditable guaranteed an editor unless the kind is explicitly readonly
    }
    focusEditor(ev, editor); // focus the inner editor (its `.input` for Group editors) so keys land + bubble
    state = { kind: 'editing', cell, field, editor, dispose };
    if (opts?.openDropdown && editor instanceof ComboBox) {
      const combo = editor;
      // Value help (F4): open the dropdown via the ComboBox's public Alt+Down trigger (`open()` is
      // protected). The spread reuses the real envelope's popupHost/focusView, so it opens exactly as a
      // user's Alt+Down would.
      //
      // Defer the open to a microtask: the ComboBox was mounted this same tick and has no laid-out
      // bounds yet, and the dropdown anchors on those bounds. Opening synchronously would place an empty,
      // zero-width popup at the cell's edge — the layout pass runs at the end of the tick, after this
      // handler. The microtask fires after that pass, so the anchor reads the settled cell geometry.
      // Re-check the editor is still open, since an Esc/commit could close it before the microtask runs.
      queueMicrotask(() => {
        if (state.kind !== 'editing' || state.editor !== combo) return;
        combo.onEvent({
          ...ev,
          event: { type: 'key', key: 'down', ctrl: false, alt: true, shift: false },
          handled: false,
        });
      });
    }
    return true;
  }

  function onEditorKey(ev2: DispatchEvent): void {
    if (state.kind !== 'editing') return;
    const k = ev2.event;
    if (k.type !== 'key') return;
    if (k.key === 'escape') {
      cancel(ev2);
      ev2.handled = true;
    } else if (k.key === 'enter') {
      void commit(ev2);
      ev2.handled = true;
    }
    // everything else stays in the Input (already handled there)
  }

  function closeEditor(): void {
    if (state.kind !== 'editing') return;
    state.dispose(); // remove the editor host and dispose its reactive scope (owner disposal)
  }

  function cancel(ev2: DispatchEvent): void {
    if (state.kind === 'editing') {
      // Abandoning a blocked edit must clear the cell's marker: the record kept its prior valid value,
      // so a lingering `gridInvalid` band would mark a valid-valued cell with no passive recovery.
      const { cell } = state;
      host.errors?.clear(cellKey(cell.rowKey, cell.columnId));
    }
    closeEditor();
    state = { kind: 'idle' };
    ev2.focusView?.(host.body); // refocus the body — nothing was ever written to the record
  }

  /**
   * The shared commit core: parse the field, run the optimistic write through the veto, and — only on a
   * successful commit — close the editor and go idle. It does NOT advance the cursor or refocus anything,
   * so both the `Enter` path (advance-by-row + envelope refocus) and the `Tab` path (advance-by-cell +
   * caller refocus) build on it without duplicating logic. Resolves whether the value committed.
   */
  async function commitValue(): Promise<boolean> {
    if (state.kind !== 'editing') return false;
    const { cell, field } = state;
    const ck = cellKey(cell.rowKey, cell.columnId);
    if (committing.has(ck)) return false; // a commit for this cell is already resolving — serialize
    const tcol = host.typedColumns[cell.col];
    const raw = field();
    // A `nullable` column clears to null on an empty edit (bypassing `parse`), so null is stored and
    // rendered (via `nullDisplay`) distinctly from ''. A non-nullable column keeps parsing '' as before
    // (a text column yields '', a numeric column yields PARSE_FAILED → rejected below).
    const value = tcol.nullable === true && raw === '' ? null : tcol.parse!(raw);
    // An unparseable edit is a blocked commit: keep the editor open and write nothing (no sentinel or
    // NaN ever reaches the record), and mark the cell with a generic message.
    if (value === PARSE_FAILED) {
      host.errors?.set(ck, 'Invalid value');
      return false;
    }
    // Pre-apply per-cell validation — runs on the parsed typed value before any write. Skipped on a
    // nullable clear (`value === null`): an empty clear is not a typed value, so a validator written for
    // the typed `V` never receives `null`. A non-null message blocks: nothing is written, the editor
    // stays open, and the cell is marked.
    if (value !== null) {
      const message = tcol.validate?.(value, cell.row);
      if (message != null) {
        host.errors?.set(ck, message);
        return false;
      }
    }
    const previous = tcol.value(cell.row);
    committing.add(ck);
    host.dirty?.add(ck); // mark the cell pending until the commit resolves
    const res = await commitCell({
      row: cell.row,
      columnId: cell.columnId,
      rowKey: cell.rowKey,
      previous,
      next: value,
      apply: (r, _c, v) => tcol.set!(r, v),
      beforeSave: host.beforeSave,
      onCommit: host.onCommit,
    });
    host.bumpVersion(); // repaint the new (or reverted) value — the row mutated in place
    host.dirty?.delete(ck); // the source now reflects the value (committed or reverted) — no longer pending
    committing.delete(ck);
    if (res.committed) {
      host.errors?.clear(ck); // the cell now holds a committed, valid value
      host.markRowTouched?.(cell.rowKey); // the row was edited → the row-leave gate will validate it
      closeEditor();
      state = { kind: 'idle' };
      return true;
    }
    // A post-apply veto (beforeSave / onCommit) already reverted the record to `previous`; mark the cell
    // and surface a generic reason (the gates return only a boolean), keeping the editor open.
    host.errors?.set(ck, 'Change was rejected');
    return false;
  }

  async function commit(ev2: DispatchEvent): Promise<void> {
    // The Enter path: on a successful commit, advance to the same column of the next row and refocus the
    // body from this event's envelope.
    if (await commitValue()) {
      host.advanceRow();
      ev2.focusView?.(host.body);
    }
  }

  async function commitEdit(): Promise<boolean> {
    // The Tab path: commit only. The command that drives Tab has no event envelope, so this cannot
    // refocus the body the way Enter does — the caller advances by cell and restores focus.
    return commitValue();
  }

  return {
    beginEdit,
    isEditing: () => state.kind === 'editing',
    commitEdit,
  };
}
