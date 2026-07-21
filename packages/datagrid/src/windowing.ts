/**
 * The windowed read path — how the grid presents a windowed/async {@link GridDataSource} to a body that
 * was written for a whole in-memory array.
 *
 * A windowed source (one that exposes `ensureRange`) may hold only a slice of a huge dataset at a time,
 * with `rowAt(i)` returning `undefined` for a not-yet-loaded row. The grid body, however, reads its rows
 * as `display().length` and `display()[i]`. {@link windowedView} bridges the two with a length-correct
 * lazy view: `.length` reports the source total and an integer index reads through to `source.rowAt(i)`,
 * so the body's navigation/scroll/clamp math keeps working while only the touched window is realized.
 *
 * The view deliberately supports **only** `.length` and integer indexing. Every whole-array consumer
 * (auto-width, footer aggregates, select-all, distinct, positional duplicate) is instead routed away
 * from it — but rather than trust that routing to stay complete, the view **fails loud**: any other
 * access throws, so a missed guard is a located test failure, never a silent full-scan or a crash deep in
 * unrelated code.
 */
import type { Column } from '@jsvision/ui';
import type { GridDataSource } from './data-source.js';

/**
 * Whether a source is windowed — i.e. it drives its own loading through `ensureRange`, so the grid must
 * take the lazy read path ({@link windowedView}) instead of materializing every row. An eager in-memory
 * source (no `ensureRange`) is not windowed and keeps the dense-array path unchanged.
 *
 * @param source The data source to classify.
 * @returns `true` when the source exposes `ensureRange`, `false` otherwise.
 * @example
 * ```ts
 * import { fromRows, isWindowed } from '@jsvision/datagrid';
 * import { signal } from '@jsvision/ui';
 * isWindowed(fromRows(signal([{ id: 1 }]), { rowKey: (r) => r.id })); // false — eager
 * // A source that implements `ensureRange(start, end)` returns true.
 * ```
 */
export function isWindowed<T>(source: GridDataSource<T>): boolean {
  return typeof source.ensureRange === 'function';
}

/**
 * Validate a windowed source's grid configuration at construction. A windowed source **must** push sort
 * and filter down to itself (they cannot run client-side over a partially-loaded dataset, and the grid's
 * re-anchor scans are gated by push-down presence, not by `isWindowed`) — a missing `setSort`/`setFilter`
 * is a hard misconfiguration, so this **throws**. Separately, an `auto`-width column falls back to a
 * fixed width (measuring every row would page-fault), which is recoverable, so that only **warns**.
 *
 * @param source The windowed source being configured.
 * @param columns The engine columns (checked for `auto` width).
 * @param warn The dev-warning sink (scope, message).
 * @throws If the source omits `setSort` or `setFilter`.
 */
export function validateWindowedConfig<T>(
  source: GridDataSource<T>,
  columns: readonly Column<T>[],
  warn: (scope: string, message: string) => void,
): void {
  if (!source.setSort || !source.setFilter) {
    throw new Error(
      'A windowed source (ensureRange present) must implement setSort and setFilter — sort and filter ' +
        'cannot run client-side over a partially-loaded dataset.',
    );
  }
  if (columns.some((c) => c.width === 'auto')) {
    warn(
      'windowed-auto-width',
      'auto-width columns use a fixed fallback on a windowed source (measuring every row would page-fault).',
    );
  }
}

/**
 * A length-correct, lazily-read view over a windowed source, presentable as the `display: () => T[]` the
 * grid body demands. `.length` reports the source total; an integer index returns the loaded row or
 * `undefined` (a hole is never collapsed away). It is typed `T[]`, but only `.length` and integer
 * indexing are supported — every whole-array operation (`.map`/`.find`/`.reduce`/spread/`for..of`)
 * **throws** a descriptive error, because such an operation over a windowed source would either crash on
 * the first unloaded row or full-scan the entire dataset (a fetch-storm). Route each whole-array consumer
 * behind {@link isWindowed} and read `source.rowAt(i)` directly instead.
 *
 * @param source The windowed source to present as a lazy array.
 * @returns A `T[]`-typed lazy view: length-correct, integer-indexable, and fail-loud on any other access.
 * @example
 * ```ts
 * import { windowedView } from '@jsvision/datagrid';
 * import type { GridDataSource } from '@jsvision/datagrid';
 * interface Row { id: number; name: string }
 * const loaded = new Map<number, Row>();
 * for (let i = 0; i < 50; i++) loaded.set(i, { id: i, name: `Row ${i}` });
 * const source: GridDataSource<Row> = {
 *   rowKey: (r) => r.id,
 *   length: () => 100000,
 *   rowAt: (i) => loaded.get(i),
 *   ensureRange: (start, end) => {
 *     // fetch rows [start, end) from the backing store and populate `loaded`
 *   },
 * };
 * const view = windowedView(source);   // source.length() === 100000, only rows [0,50) loaded
 * view.length;                         // 100000 (the source total)
 * view[10];                            // the loaded row
 * view[500];                           // undefined (an unloaded hole)
 * // view.map(...) or [...view] throws — gate the consumer behind isWindowed(source) first.
 * ```
 */
export function windowedView<T>(source: GridDataSource<T>): T[] {
  const unsupported = (prop: string | symbol): never => {
    throw new Error(
      `windowed display() supports only .length and integer indexing — "${String(prop)}" is a whole-array ` +
        `operation. Gate this consumer behind isWindowed(source), or read source.rowAt(i) directly.`,
    );
  };
  return new Proxy<T[]>([], {
    get(target, prop, recv) {
      if (prop === 'length') return source.length();
      if (typeof prop === 'string' && /^\d+$/.test(prop)) return source.rowAt(Number(prop));
      // Fail loud: any whole-array access (`.map`/`.find`/`.reduce`/… — all other string props) or
      // `for..of`/spread (`Symbol.iterator`) throws, so an un-gated (or future) consumer surfaces as a
      // deterministic, located test failure rather than a silent full-scan or a crash on the first hole.
      // Engine/tooling symbol probes (`Symbol.toStringTag`, inspection hooks) pass through untouched.
      if (prop === Symbol.iterator || typeof prop === 'string') return unsupported(prop);
      return Reflect.get(target, prop, recv);
    },
    has(target, prop) {
      if (prop === 'length') return true;
      if (typeof prop === 'string' && /^\d+$/.test(prop)) return Number(prop) < source.length();
      return Reflect.has(target, prop);
    },
  });
}
