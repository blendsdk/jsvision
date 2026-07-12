/**
 * A hand-written windowed `GridDataSource` double over a fixed array. It implements the same interface
 * as the in-memory `fromRows` source but through a different mechanism (no reactive signal), so the
 * shared source-contract suite proves the grid body is genuinely source-agnostic. It loads eagerly —
 * every row is already present — which is all RD-01 needs; a real windowed/server source that yields
 * `undefined` for not-yet-loaded rows is a later concern.
 */
import type { GridDataSource } from '../../src/data-source.js';

/**
 * Build a windowed source double over a fixed array.
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
    ensureRange: () => {
      // Eager double: every row is already loaded, so a range request is a no-op.
    },
  };
}
