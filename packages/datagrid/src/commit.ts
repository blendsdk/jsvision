/**
 * The per-cell commit seam: the `onCommit` veto sink and the `commitCell` primitive that drives it.
 *
 * A cell edit applies to the in-memory record immediately (so the grid reflects the change at once),
 * then `onCommit` decides whether the change stands. If it vetoes — returns `false` or rejects — the
 * edit is reverted to its previous value. A later release wires this into the interactive editor
 * (keep the editor open on veto) and layers per-row / before-save gates above it.
 */

/**
 * The change described to an `OnCommit` sink: which cell changed, its new and previous values, and the
 * (already-updated) row.
 */
export interface CellCommit<T, V = unknown> {
  /** Stable key of the edited row. */
  readonly rowKey: string | number;
  /** Id of the edited column. */
  readonly columnId: string;
  /** The new value (already applied to the record). */
  readonly value: V;
  /** The value before the edit (restored on veto). */
  readonly previous: V;
  /** The row record (already updated to `value`). */
  readonly row: T;
}

/**
 * A per-cell veto sink. Return `true` to accept the edit, `false` (or a rejected promise) to veto it;
 * on veto `commitCell` reverts the record to its previous value. Persisting an accepted change is the
 * sink's own responsibility.
 */
export type OnCommit<T> = (change: CellCommit<T>) => boolean | Promise<boolean>;

/**
 * A per-cell gate that decides **whether** an already-applied edit may proceed to `onCommit`, layered
 * directly above it. Return `true` to allow the commit to continue to `onCommit`, or `false` (or a
 * rejected promise) to veto it — a veto reverts the record to its previous value and `onCommit` is
 * **never** called. It fires after the optimistic in-memory write, so the change it receives already
 * reflects the new value. Use it for a policy check (permission, a business rule) that should short-
 * circuit persistence; client-side gating is UX only, so the authoritative check still belongs in
 * `onCommit`/the source.
 *
 * @example
 * import { commitCell } from '@jsvision/datagrid';
 * import type { BeforeSave } from '@jsvision/datagrid';
 *
 * interface Row { locked: boolean; qty: number }
 * // Block edits to a locked row before they ever reach onCommit:
 * const beforeSave: BeforeSave<Row> = (c) => !c.row.locked;
 */
export type BeforeSave<T> = (change: CellCommit<T>) => boolean | Promise<boolean>;

/**
 * Apply a cell edit immediately, run the optional `beforeSave` then `onCommit` veto gates, and revert
 * on veto.
 *
 * The write happens first (`apply(row, columnId, next)`), so the record and grid reflect the edit at
 * once. Then the two post-apply gates run in order: `beforeSave` decides *whether* to proceed, and
 * `onCommit` accepts/persists. Each is awaited; a `false` or a rejected promise from **either** reverts
 * the record with `apply(row, columnId, previous)` through the one shared revert path. A `beforeSave`
 * veto short-circuits — `onCommit` is never called. With neither gate the commit succeeds. This is a
 * single round-trip — serializing overlapping in-flight commits is a caller concern.
 *
 * @param args The edit: the `row`, `columnId`, `rowKey`, the `previous`/`next` values, an `apply`
 *   writer that mutates the record, an optional `beforeSave` gate, and an optional `onCommit` sink.
 * @returns `{ committed, value }` — whether the edit stands and the value now in the record.
 * @example
 * ```ts
 * import { commitCell } from '@jsvision/datagrid';
 * const row = { balance: 1 };
 * const apply = (r: typeof row, _col: string, v: number) => { r.balance = v; };
 * const ledger: number[] = []; // stands in for the real persistence layer (a database write, an API call)
 * const res = await commitCell({
 *   row, columnId: 'balance', rowKey: 1, previous: 1, next: 2, apply,
 *   // beforeSave/onCommit see `value` as `unknown` (it is not typed by the call's inferred V), so a
 *   // gate narrows it before using it — the same guard the grid's own examples use.
 *   beforeSave: (c) => typeof c.value === 'number' && c.value >= 0, // gate: refuse negative balances
 *   onCommit: (c) => {
 *     if (typeof c.value !== 'number') return false;
 *     ledger.push(c.value); // authoritative persistence
 *     return true;
 *   },
 * });
 * res.committed; // true — row.balance is now 2
 * ```
 */
export async function commitCell<T, V>(args: {
  row: T;
  columnId: string;
  rowKey: string | number;
  previous: V;
  next: V;
  apply: (row: T, columnId: string, v: V) => void;
  beforeSave?: BeforeSave<T>;
  onCommit?: OnCommit<T>;
}): Promise<{ committed: boolean; value: V }> {
  const { row, columnId, rowKey, previous, next, apply, beforeSave, onCommit } = args;
  apply(row, columnId, next); // immediate in-memory write

  // Both post-apply gates share one shape: absent → allow; otherwise a `false`/rejection is a veto (not
  // a crash), exactly matching the historical onCommit contract.
  const change: CellCommit<T, V> = { rowKey, columnId, value: next, previous, row };
  const gate = async (fn?: (c: CellCommit<T, V>) => boolean | Promise<boolean>): Promise<boolean> => {
    if (!fn) return true;
    try {
      return await fn(change);
    } catch {
      return false;
    }
  };

  // beforeSave runs first and short-circuits: a veto here means onCommit is never awaited.
  if (!(await gate(beforeSave)) || !(await gate(onCommit))) {
    apply(row, columnId, previous); // single revert path
    return { committed: false, value: previous };
  }
  return { committed: true, value: next };
}
