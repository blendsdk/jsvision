/**
 * A hand-written eager `GridDataSource` double over a fixed array. It implements the same interface as
 * the in-memory `fromRows` source but through a different mechanism (no reactive signal), so the shared
 * source-contract suite proves the grid body is genuinely source-agnostic. Every row is already present
 * and it declares no windowing seam, so it takes the eager read path exactly like `fromRows`. A real
 * async windowed/server source that yields `undefined` for not-yet-loaded rows is a separate double
 * (`async-windowed-source.ts`).
 */
import type { GridDataSource } from '../../src/data-source.js';

/**
 * Build an eager source double over a fixed array.
 *
 * @param rows The backing rows (eagerly present).
 * @param rowKey Stable identity for a row.
 * @returns A `GridDataSource` satisfying the same contract as `fromRows`.
 */
export function windowedSource<T>(rows: readonly T[], rowKey: (row: T) => string | number): GridDataSource<T> {
  return {
    rowKey,
    length: () => rows.length,
    rowAt: (index) => (index >= 0 && index < rows.length ? rows[index] : undefined),
    // No `ensureRange`: this is the eager double, so it must not be classified windowed. The async
    // windowed double lives in `async-windowed-source.ts`.
  };
}
