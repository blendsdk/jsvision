/**
 * Validation surfacing helpers for the data grid: the reactive message band that shows the active
 * validation / veto message. The per-row cross-field gate (`validateRow`) and its row-leave trap layer
 * onto this module in a later slice.
 */
import { Text } from '@jsvision/ui';
import type { View } from '@jsvision/ui';

/**
 * Build the grid's one-line message band — a reactive `Text` bound to the active validation/veto
 * message. It shows the empty string (a blank line) when there is no active message, so the band's row
 * stays reserved and the body never jumps as messages come and go. The message is sanitized for free at
 * the draw boundary, so an echoed control byte cannot inject.
 *
 * @param active A reactive getter for the current active message, or `null` when there is none.
 * @param severity The band's severity styling (`'error'` for a validation/veto message); read once.
 * @returns A `Text` view to place in the grid's footer region.
 * @example
 * ```ts
 * import { createErrorRegistry } from '@jsvision/datagrid';
 * const errors = createErrorRegistry();
 * const band = buildMessageBand(() => errors.active(), () => 'error');
 * // place `band` in the footer region; it repaints as errors.set/clear change the active message
 * ```
 */
export function buildMessageBand(active: () => string | null, severity: () => 'error' | 'warning'): View {
  return new Text(() => active() ?? '', { severity: severity() });
}

/**
 * The result of a per-row cross-field `validateRow` check: `ok` accepts the row; on `!ok` the row-leave
 * is blocked, `message` is surfaced, and the cursor refocuses the column named by `field` (falling back
 * to the current column when `field` is absent or unknown).
 */
export interface RowValidation {
  /** Whether the row passes — `false` blocks the leave. */
  readonly ok: boolean;
  /** The message to surface on failure. */
  readonly message?: string;
  /** The column id to refocus on failure (the offending field). */
  readonly field?: string;
}

/** The dependencies {@link createRowGate} reads on demand — no owned reactive state (controller convention). */
export interface RowGateDeps<T> {
  /** The caller's cross-field validator, or `undefined` for no gate. */
  validateRow?: (row: T) => RowValidation;
  /** The record under the row cursor, or `undefined` on an empty grid. */
  focusedRow(): T | undefined;
  /** The focused row's key, or `undefined` on an empty grid. */
  focusedKey(): string | number | undefined;
  /** Whether the row was edited this visit (a cell in it committed) — the trigger for the gate. */
  isRowTouched(rowKey: string | number): boolean;
  /** Forget a row's touched mark (called on a passing leave, so a validated row does not re-trap). */
  clearTouched(rowKey: string | number): void;
  /** The visible column index for a column id, or `-1` when it is unknown/hidden. */
  columnIndex(columnId: string): number;
  /** The current column-cursor index (the refocus fallback). */
  currentColumn(): number;
  /** Move the column cursor to `index` and focus that cell. */
  focusColumn(index: number): void;
  /** Push (or clear, with `null`) the active band message. */
  note(message: string | null): void;
}

/** The row-leave decision surface — every leave path consults {@link RowGate.tryLeave} first. */
export interface RowGate {
  /**
   * Whether the cursor may leave the current row. Returns `true` (allow) when there is no `validateRow`,
   * the grid is empty, or the row is untouched. For a touched row it runs `validateRow`: on pass it
   * forgets the touched mark, clears the message, and allows; on fail it refocuses the offending field,
   * surfaces the message, and blocks. A throwing validator is treated as a blocking failure, never a crash.
   */
  tryLeave(): boolean;
}

/**
 * Build the per-row leave gate. It owns no reactive state — every call reads live grid state through the
 * injected {@link RowGateDeps}, matching the package's controller convention.
 *
 * @param deps The live-state accessors + sinks the gate drives (see {@link RowGateDeps}).
 * @returns A {@link RowGate}.
 * @example
 * ```ts
 * const gate = createRowGate<Line>({
 *   validateRow: (r) => (r.end > r.start ? { ok: true } : { ok: false, message: 'End after start', field: 'end' }),
 *   focusedRow: () => grid.focusedRow(), focusedKey: () => grid.focusedKey(),
 *   isRowTouched: (k) => touched.has(k), clearTouched: (k) => touched.delete(k),
 *   columnIndex: (id) => visibleIds.indexOf(id), currentColumn: () => focusedCol(),
 *   focusColumn: (i) => focusedCol.set(i), note: (m) => errors.note(m),
 * });
 * if (!gate.tryLeave()) return; // block the row-leave, cursor already refocused the offending field
 * ```
 */
export function createRowGate<T>(deps: RowGateDeps<T>): RowGate {
  return {
    tryLeave(): boolean {
      const validateRow = deps.validateRow;
      if (validateRow === undefined) return true; // no gate configured
      const key = deps.focusedKey();
      const row = deps.focusedRow();
      if (key === undefined || row === undefined) return true; // empty grid
      if (!deps.isRowTouched(key)) return true; // an untouched row leaves freely, even a pre-invalid seed

      let res: RowValidation;
      try {
        res = validateRow(row);
      } catch {
        res = { ok: false }; // a throwing validator is a blocking failure, never a crash
      }
      if (res.ok) {
        deps.clearTouched(key); // a validated row will not re-trap on a later leave
        deps.note(null);
        return true;
      }
      // Blocked: refocus the named field (fallback to the current column on an unknown/hidden id), surface
      // the message, and keep the cursor on the row.
      const named = res.field !== undefined ? deps.columnIndex(res.field) : -1;
      deps.focusColumn(named >= 0 ? named : deps.currentColumn());
      deps.note(res.message ?? 'This row is invalid');
      return false;
    },
  };
}
