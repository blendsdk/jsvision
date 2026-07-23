/**
 * `GridSelection<T>` — the container-side row-selection controller for {@link EditableDataGrid}: a
 * reactive `selectedKeys` set plus a stored range anchor, driven by the pure ops in `selection.ts`, with
 * the gesture coordination (moving the row cursor as a row is toggled/ranged) folded in.
 *
 * This is the stateful selection wiring kept out of `grid.ts` (which stays a thin set of public
 * delegators over these methods): the container instantiates one `GridSelection`, injects its
 * `keys` signal into the body for paint, and routes every gesture/API call here. Selection is keyed by
 * `rowKey`, so it needs no reconcile on re-sort/re-filter — the same keys re-highlight wherever their
 * rows move; only a delete prunes the set (via {@link GridSelection.prune}).
 */
import { signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import { toggleKey, selectRange, selectAll, triState } from './selection.js';
import type { Key, SelectionMode, TriState } from './selection.js';

/** Construction config for {@link GridSelection}. */
export interface GridSelectionConfig<T> {
  /** Selection mode: `'single'` replaces on each pick; `'multi'` accumulates. */
  readonly mode: SelectionMode;
  /** The shared row cursor — a gesture re-homes it to the toggled/ranged row. */
  readonly focused: Signal<number>;
  /** The current display rows (a gesture maps a display index to a key through {@link rowKey}). */
  readonly display: () => T[];
  /** Row identity (from the data source). */
  readonly rowKey: (row: T) => Key;
  /**
   * Whether the source is windowed. Select-all / tri-state / range selection all enumerate the **whole**
   * display (`display().map(rowKey)`), which a windowed source cannot serve, so they are disabled; only a
   * single-row keyed toggle on a **loaded** row survives.
   */
  readonly windowed?: boolean;
}

/**
 * The container's row-selection controller — a `selectedKeys` signal + a range anchor, applying the pure
 * `selection.ts` ops under the grid's {@link SelectionMode}. Never mutates a set in place: each op sets a
 * fresh `ReadonlySet<Key>` so the body's bound `keys` repaints. The `*AtRow`/`rangeToRow` gesture methods
 * additionally move the row cursor, so `grid.ts` wires the body callbacks straight to them.
 */
export class GridSelection<T> {
  /** The reactive selection set the body binds and paints from (membership keyed by `rowKey`). */
  readonly keys: Signal<ReadonlySet<Key>> = signal<ReadonlySet<Key>>(new Set());
  /** The range anchor — the last non-shift pick, from which a `Shift` range extends. `null` = none. */
  private anchor: Key | null = null;
  private readonly mode: SelectionMode;
  private readonly focused: Signal<number>;
  private readonly display: () => T[];
  private readonly rowKey: (row: T) => Key;
  private readonly windowed: boolean;

  /** @param cfg The selection mode plus the shared cursor + display + row-identity seams. */
  constructor(cfg: GridSelectionConfig<T>) {
    this.mode = cfg.mode;
    this.focused = cfg.focused;
    this.display = cfg.display;
    this.rowKey = cfg.rowKey;
    this.windowed = cfg.windowed ?? false;
  }

  /** The current selection (reactive read). */
  read(): ReadonlySet<Key> {
    return this.keys();
  }

  /** Replace the selection with just `key` and make it the range anchor (the public `selectRow`). */
  selectOnly(key: Key): void {
    this.keys.set(new Set([key]));
    this.anchor = key;
  }

  /** Toggle `key`'s membership under the mode and make it the range anchor (the public `toggleRow`). */
  toggle(key: Key): void {
    this.keys.set(toggleKey(this.keys(), key, this.mode));
    this.anchor = key;
  }

  /**
   * Extend the selection to `toKey` as a display-order range from the current anchor (the public
   * `selectRange`). With no anchor yet it starts from the focused row. A no-op on an empty grid.
   *
   * @param toKey The far end of the range, in the current display order.
   */
  rangeTo(toKey: Key): void {
    if (this.windowed) return; // range enumerates the whole display — disabled for windowed
    const fallback = this.focusedKey();
    if (fallback === undefined) return;
    this.extend(toKey, fallback);
  }

  /** Select every displayed row — the header select-all (over the current filtered display). */
  selectAllDisplayed(): void {
    if (this.windowed) return; // can't enumerate unloaded keys without page-faulting — disabled for windowed
    this.keys.set(selectAll(this.displayKeys()));
  }

  /** The header tri-state over the current display: `none` / `some` / `all` of the displayed rows selected. */
  currentTriState(): TriState {
    if (this.windowed) return 'none'; // select-all/tri-state disabled for windowed → always reads empty
    return triState(this.keys(), this.displayKeys());
  }

  /** The header-checkbox toggle: when every displayed row is selected, clear; otherwise select them all. */
  toggleAll(): void {
    if (this.windowed) return; // disabled for windowed (the select-all affordance is inert)
    if (this.currentTriState() === 'all') this.clear();
    else this.selectAllDisplayed();
  }

  /** Clear the selection and the range anchor. */
  clear(): void {
    this.keys.set(new Set());
    this.anchor = null;
  }

  /**
   * Gesture: toggle the row at a display index (`Space` on a read-only cell / `Ctrl`+click). Moves the
   * cursor to the row first (a `Ctrl`+click re-homes it; `Space` is already there), then toggles its key.
   *
   * @param rowIndex The display index of the row to toggle.
   */
  toggleAtRow(rowIndex: number): void {
    const rows = this.display();
    if (rows.length === 0) return;
    const i = clampIndex(rowIndex, rows.length);
    if (rows[i] === undefined) return; // an unloaded (placeholder) row — no-op (never rowKey(undefined))
    this.focused.set(i);
    this.toggle(this.rowKey(rows[i]));
  }

  /**
   * Gesture: extend the range to the row at a display index (`Shift`+click / `Shift`+↑↓). Captures the
   * pre-move cursor row as the range's default anchor (used only when no anchor is set yet), moves the
   * cursor to the target, and unions the display-order run onto the selection.
   *
   * @param rowIndex The display index of the range's moving end.
   */
  rangeToRow(rowIndex: number): void {
    if (this.windowed) return; // range enumerates the whole display — disabled for windowed
    const rows = this.display();
    if (rows.length === 0) return;
    const i = clampIndex(rowIndex, rows.length);
    const fallbackAnchor = this.rowKey(rows[clampIndex(this.focused(), rows.length)]);
    this.focused.set(i);
    this.extend(this.rowKey(rows[i]), fallbackAnchor);
  }

  /**
   * Prune deleted keys from the selection and drop the anchor if its row is gone — called after a row
   * delete so a removed row never stays selected or anchors a range. No-op when nothing overlaps.
   *
   * @param removed The keys whose rows were deleted.
   */
  prune(removed: Iterable<Key>): void {
    const gone = removed instanceof Set ? removed : new Set(removed);
    if (gone.size === 0) return;
    let changed = false;
    const next = new Set(this.keys());
    for (const k of gone) if (next.delete(k)) changed = true;
    if (changed) this.keys.set(next);
    if (this.anchor !== null && gone.has(this.anchor)) this.anchor = null;
  }

  /** Union the display-order run `anchor..toKey` onto the selection; preserve the anchor for a further extend. */
  private extend(toKey: Key, fallbackAnchor: Key): void {
    const anchor = this.anchor ?? fallbackAnchor;
    this.keys.set(selectRange(this.keys(), anchor, toKey, this.displayKeys(), this.mode));
    this.anchor = anchor;
  }

  /** The current display order mapped to keys — the range/select-all input. */
  private displayKeys(): Key[] {
    return this.display().map(this.rowKey);
  }

  /** The focused row's key (clamped into range), or `undefined` when the grid is empty. */
  private focusedKey(): Key | undefined {
    const rows = this.display();
    if (rows.length === 0) return undefined;
    return this.rowKey(rows[clampIndex(this.focused(), rows.length)]);
  }
}

/** Clamp a display index into `[0, length)` (length is always ≥ 1 at the call sites). */
function clampIndex(i: number, length: number): number {
  return Math.max(0, Math.min(i, length - 1));
}
