/**
 * `RowMutations<T>` — the container-side row-CRUD controller for {@link EditableDataGrid}: insert,
 * delete, and duplicate, routed through the data source's optional `insert`/`remove` mutation seam so
 * the grid never persists on its own. An in-memory source splices its signal; a windowed/server source
 * persists via those callbacks.
 *
 * This is the mutation wiring kept out of `grid.ts` (which stays a thin set of public delegators over
 * these methods), the twin of {@link GridSelection}: a delete removes via the seam and then prunes the
 * selection so a deleted row never stays selected. The caller owns key generation — `insertRow` takes a
 * row already carrying its `rowKey`, and `duplicateRow` mints the clone's key through `assignKey`.
 */
import type { GridDataSource } from './data-source.js';
import type { GridSelection } from './grid-selection.js';
import type { Key } from './selection.js';

/** Construction config for {@link RowMutations}. */
export interface RowMutationsConfig<T> {
  /** The data source (the mutation seam plus row identity). */
  readonly source: GridDataSource<T>;
  /** The current display rows — `duplicateRow` finds the original here before cloning it. */
  readonly display: () => T[];
  /** The selection controller — a delete prunes the removed keys from it. */
  readonly selection: GridSelection<T>;
  /** Mint the clone's fresh key (the caller owns key generation); without it, `duplicateRow` no-ops. */
  readonly assignKey?: (clone: T, original: T) => T;
  /** Dev-warning sink (already scoped) — used for the `duplicateRow` no-op cases. */
  readonly warn: (message: string) => void;
}

/**
 * The container's row-CRUD controller. Every method routes through the source's optional mutation seam,
 * so a read-only source (one exposing no `insert`/`remove`) makes the mutators safe no-ops — the grid
 * never writes behind the source's back. `grid.ts` wires `insertRow`/`deleteRows`/`duplicateRow` straight
 * to these.
 */
export class RowMutations<T> {
  private readonly source: GridDataSource<T>;
  private readonly display: () => T[];
  private readonly selection: GridSelection<T>;
  private readonly assignKey?: (clone: T, original: T) => T;
  private readonly warn: (message: string) => void;

  /** @param cfg The source seam, the display accessor, the selection controller, and the key minter. */
  constructor(cfg: RowMutationsConfig<T>) {
    this.source = cfg.source;
    this.display = cfg.display;
    this.selection = cfg.selection;
    this.assignKey = cfg.assignKey;
    this.warn = cfg.warn;
  }

  /**
   * Insert a row at a **source-array** index (append when `at` is omitted). A no-op when the source is
   * read-only. With an active client sort the row re-sorts to its value-determined display position on
   * the next derive; a push-down source owns its own ordering.
   *
   * @param row The row to insert (already carrying its `rowKey`).
   * @param at The source index to splice at; appended when omitted.
   */
  insertRow(row: T, at?: number): void {
    this.source.insert?.(row, at);
  }

  /**
   * Remove rows by key through the seam, then prune those keys from the selection. A no-op on the source
   * when it is read-only; the selection is pruned either way (grid-local state, not a source mutation).
   *
   * @param keys The row keys to remove.
   */
  deleteRows(keys: readonly Key[]): void {
    this.source.remove?.(keys);
    this.selection.prune(keys);
  }

  /**
   * Insert a structured clone of the row `key`, adjacent to it, carrying a fresh key from `assignKey`.
   * A no-op (with a dev warning) when `assignKey` is absent — it never inserts a key-colliding row. Also
   * a no-op when `key` is absent from the display, or when the row is not structured-cloneable (holds a
   * function, class instance, etc.): the clone is attempted inside a guard, so it warns instead of
   * throwing and never leaves a partial insert.
   *
   * @param key The key of the row to duplicate.
   */
  duplicateRow(key: Key): void {
    if (!this.assignKey) {
      this.warn('no `assignKey` configured — duplicate is a no-op (it never collides a key).');
      return;
    }
    const original = this.display().find((r) => this.source.rowKey(r) === key);
    if (original === undefined) return; // absent from the display — nothing to clone
    let clone: T;
    try {
      clone = structuredClone(original);
    } catch {
      this.warn('the row is not structured-cloneable — duplicate skipped (no partial insert).');
      return;
    }
    const newRow = this.assignKey(clone, original);
    const at = this.sourceIndexOf(key);
    this.insertRow(newRow, at >= 0 ? at + 1 : undefined);
  }

  /** The source-array index of the row with `key`, or `-1` when absent (a linear scan over the seam). */
  private sourceIndexOf(key: Key): number {
    for (let i = 0, n = this.source.length(); i < n; i += 1) {
      const row = this.source.rowAt(i);
      if (row !== undefined && this.source.rowKey(row) === key) return i;
    }
    return -1;
  }
}
