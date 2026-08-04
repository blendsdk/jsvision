/**
 * Bounded row-edit session state for Escape recovery.
 *
 * The controller remembers only successfully committed editable cells from the current row visit.
 * It keeps each column's earliest value, marks a session eligible only after row validation traps it,
 * and hands immutable attempt snapshots to the transaction layer. Prepared attempts retain their own
 * captured row and setters, so asynchronous data settlement does not depend on a still-live UI session.
 */
import type { Key } from './selection.js';
import type { OnRevertRow, RowRevert, RowRevertCell } from './commit.js';

/** One successfully accepted cell commit reported by the editor. */
export interface AcceptedCellCommit<T> {
  /** Stable key of the edited row. */
  readonly rowKey: Key;
  /** Exact row object that received the commit. */
  readonly row: T;
  /** Stable id of the committed column. */
  readonly columnId: string;
  /** Value before this individual commit. */
  readonly previous: unknown;
  /** Accepted value after this individual commit. */
  readonly value: unknown;
  /** Captured typed column setter with its value type safely erased at the editor boundary. */
  readonly apply: (row: T, value: unknown) => void;
}

/** One immutable cell operation captured for a row-revert attempt. */
export interface PreparedRowRevertCell<T> {
  /** Stable id of the committed column. */
  readonly columnId: string;
  /** Earliest value from before this row-edit session. */
  readonly value: unknown;
  /** Most recently accepted value immediately before the revert attempt. */
  readonly previous: unknown;
  /** Setter captured with the first accepted commit for this column. */
  readonly apply: (row: T, value: unknown) => void;
}

/**
 * Immutable data ownership for one asynchronous revert attempt.
 *
 * `token` is deliberately opaque. Callers pass the whole attempt back to the controller, which uses
 * object and token identity to prevent a late completion from attaching to a replacement row.
 */
export interface PreparedRowRevert<T> {
  /** Stable key captured when the attempt began. */
  readonly rowKey: Key;
  /** Original row object whose data transaction must settle. */
  readonly row: T;
  /** First-commit-ordered immutable cell operations. */
  readonly cells: readonly PreparedRowRevertCell<T>[];
  /** Opaque ownership token used for UI/session settlement. */
  readonly token: symbol;
}

/** The data outcome reported after an attempt settles. */
export type RowRevertOutcome = 'accepted' | 'rejected' | 'invalidated';

/** Result of reconciling one attempt with the live session registry. */
export interface RowRevertFinish {
  /** Whether this attempt still owned the live session when it settled. */
  readonly owned: boolean;
  /** Whether a rejected attempt left the same trapped session available for retry. */
  readonly retryable: boolean;
}

/** Internal mutable state for one committed column in a row visit. */
interface RowSessionChange<T> {
  readonly columnId: string;
  readonly apply: (row: T, value: unknown) => void;
  readonly baseline: unknown;
  current: unknown;
}

/** Internal mutable state for one exact key-and-object row visit. */
interface RowEditSession<T> {
  readonly rowKey: Key;
  readonly row: T;
  readonly changes: Map<string, RowSessionChange<T>>;
  trapped: boolean;
  reverting: boolean;
  attemptToken?: symbol;
}

/**
 * Controller surface consumed by the editor, row gate, container, and transaction flow.
 *
 * The registry is intentionally not reactive. Its consumers already own the signals that drive
 * drawing and focus; this object owns only lifecycle and identity invariants.
 */
export interface RowRevertController<T> {
  /** Record an accepted commit, retaining the first baseline and setter for each column. */
  recordCommit(change: AcceptedCellCommit<T>): void;
  /** Whether the exact key-and-object row visit contains at least one accepted commit. */
  isTouched(rowKey: Key, row: T): boolean;
  /** Whether the exact row visit is trapped and available to revert. */
  isTrapped(rowKey: Key, row: T): boolean;
  /** Whether the exact row visit currently has a revert callback in flight. */
  isReverting(rowKey: Key, row: T): boolean;
  /** Mark an existing exact row visit as trapped after row validation blocks a leave. */
  markTrapped(rowKey: Key, row: T): void;
  /** Permanently release an exact row visit after successful leave or rollback. */
  release(rowKey: Key, row: T): void;
  /**
   * Reconcile the registry with the row currently owning focus.
   *
   * A missing row, a different key, or a replacement object invalidates the previous visit. The same
   * key and exact object survive sorting, filtering, and collection republication.
   */
  reconcileFocus(rowKey: Key | undefined, row: T | undefined): void;
  /** Prepare one immutable attempt when the exact row is trapped and not already reverting. */
  prepare(rowKey: Key, row: T): PreparedRowRevert<T> | undefined;
  /** Settle only the still-owned live session; captured row data is settled by the transaction layer. */
  finish(attempt: PreparedRowRevert<T>, outcome: RowRevertOutcome): RowRevertFinish;
  /** Invalidate selected row keys, or every live session when `keys` is omitted. */
  invalidate(keys?: ReadonlySet<Key>): void;
  /** Dispose the registry and permanently reject future recording or settlement. */
  dispose(): void;
}

/** Grid-owned effects used by the row-revert transaction without coupling it to a view class. */
interface RowRevertTransactionDeps<T> {
  readonly sessions: RowRevertController<T>;
  readonly onRevertRow?: OnRevertRow<T>;
  readonly internalAllowed: boolean;
  readonly sourceRow: (rowKey: Key) => T | undefined;
  readonly displayedRow: (rowKey: Key) => T | undefined;
  readonly focusedRow: () => T | undefined;
  readonly focusedKey: () => Key | undefined;
  readonly bodyFocused: () => boolean;
  readonly addDirty: (key: string) => void;
  readonly deleteDirty: (key: string) => void;
  readonly clearError: (key: string) => void;
  readonly activeMessage: () => string | null;
  readonly note: (message: string | null) => void;
  readonly bumpVersion: () => void;
  readonly cellKey: (rowKey: Key, columnId: string) => string;
}

/** Attempt-owned pending presentation that must never attach to a later same-key row. */
interface RowRevertPresentation<T> {
  readonly attempt: PreparedRowRevert<T>;
  readonly keys: readonly string[];
}

/** Messages are centralized here until the catalog task replaces them with translated lookups. */
const ROW_REVERT_PENDING = 'Reverting row…';
const ROW_REVERT_FAILED = 'Could not revert row changes';
const ROW_REVERT_UNAVAILABLE = 'Row changes cannot be reverted';

/** Transaction behavior consumed by the grid's input and lifecycle wiring. */
export interface RowRevertTransactionController<T> {
  /** Begin an eligible row revert and report whether the request belongs to this feature. */
  start(rowKey: Key, row: T): boolean;
  /** Whether a callback-backed or internal revert currently owns grid presentation. */
  isPending(): boolean;
  /** Detach a pending attempt when focus or source identity changes. */
  reconcile(rowKey: Key | undefined, row: T | undefined): void;
  /** Invalidate attempts for selected row keys before a mutation can reuse them. */
  invalidate(keys: ReadonlySet<Key>): void;
  /** Suppress every later grid-state write while captured row data is still allowed to settle. */
  dispose(): void;
}

/** Restore attempted cells in reverse order and report whether every setter honored its contract. */
function compensate<T>(attempt: PreparedRowRevert<T>, cells: readonly PreparedRowRevertCell<T>[]): boolean {
  let complete = true;
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    const cell = cells[index];
    try {
      cell.apply(attempt.row, cell.previous);
    } catch {
      // Continue through every captured original. A throwing recovery setter has already broken the
      // documented column contract, so best-effort recovery is safer than leaving later cells unrestored.
      complete = false;
    }
  }
  return complete;
}

/** Build the frozen public payload without exposing captured setters or the attempt token. */
function publicChange<T>(attempt: PreparedRowRevert<T>): RowRevert<T> {
  const cells = Object.freeze(
    attempt.cells.map((cell) =>
      Object.freeze<RowRevertCell>({
        columnId: cell.columnId,
        value: cell.value,
        previous: cell.previous,
      }),
    ),
  );
  return Object.freeze({ rowKey: attempt.rowKey, row: attempt.row, cells });
}

/**
 * Create the optimistic row-revert transaction coordinator.
 *
 * Captured-row writes are deliberately separated from live grid settlement. A late veto always
 * compensates its original row, while token, source, focus, and disposal guards prevent that completion
 * from writing presentation or session state into a replacement grid context.
 */
export function createRowRevertTransactionController<T>(
  deps: RowRevertTransactionDeps<T>,
): RowRevertTransactionController<T> {
  let presentation: RowRevertPresentation<T> | undefined;
  let disposed = false;

  const ownsPresentation = (attempt: PreparedRowRevert<T>): boolean => presentation?.attempt.token === attempt.token;

  const detach = (attempt: PreparedRowRevert<T>): void => {
    const current = presentation;
    if (disposed || current?.attempt.token !== attempt.token) return;
    for (const key of current.keys) deps.deleteDirty(key);
    if (deps.activeMessage() === ROW_REVERT_PENDING) deps.note(null);
    presentation = undefined;
  };

  const sourceIdentityChanged = (attempt: PreparedRowRevert<T>): boolean =>
    deps.sourceRow(attempt.rowKey) !== deps.displayedRow(attempt.rowKey);

  const live = (attempt: PreparedRowRevert<T>): boolean =>
    !disposed &&
    deps.bodyFocused() &&
    deps.sourceRow(attempt.rowKey) === attempt.row &&
    deps.focusedKey() === attempt.rowKey &&
    deps.focusedRow() === attempt.row &&
    deps.sessions.isReverting(attempt.rowKey, attempt.row) &&
    ownsPresentation(attempt);

  const settle = async (attempt: PreparedRowRevert<T>): Promise<void> => {
    let accepted = true;
    if (deps.onRevertRow !== undefined) {
      try {
        accepted = await deps.onRevertRow(publicChange(attempt));
      } catch {
        accepted = false;
      }
    }

    const compensationComplete = accepted ? true : compensate(attempt, attempt.cells);
    if (disposed) return;

    // A custom non-reactive source can replace a row without invalidating the cached display. Refresh
    // exactly once before judging focus/session ownership so settlement never attaches to the old view.
    const identityChanged = sourceIdentityChanged(attempt);
    if (identityChanged) deps.bumpVersion();

    if (!live(attempt)) {
      // A focus-only stale veto still changed a row that remains visible. Repaint that compensation,
      // while an identity-change repaint above already covers a newly discovered replacement.
      if (!accepted && !identityChanged && deps.sourceRow(attempt.rowKey) === attempt.row) deps.bumpVersion();
      detach(attempt);
      deps.sessions.finish(attempt, 'invalidated');
      return;
    }

    if (accepted) {
      for (const key of presentation?.keys ?? []) deps.clearError(key);
      detach(attempt);
      deps.sessions.finish(attempt, 'accepted');
      return;
    }

    // Compensation is its own coherent mutation stage and therefore receives one repaint. A broken
    // recovery setter makes the captured journal untrustworthy, so it cannot remain retryable.
    deps.bumpVersion();
    detach(attempt);
    deps.sessions.finish(attempt, compensationComplete ? 'rejected' : 'invalidated');
    deps.note(ROW_REVERT_FAILED);
  };

  return {
    start(rowKey, row): boolean {
      if (disposed || !deps.sessions.isTrapped(rowKey, row)) return false;
      if (deps.sessions.isReverting(rowKey, row)) return true;

      // Persistence authority must be decided before prepare marks the session reverting or a setter
      // touches data. Per-cell persistence cannot safely stand in for one atomic row callback.
      if (deps.onRevertRow === undefined && !deps.internalAllowed) {
        deps.note(ROW_REVERT_UNAVAILABLE);
        return true;
      }

      const attempt = deps.sessions.prepare(rowKey, row);
      if (attempt === undefined) return true;
      const keys = Object.freeze(attempt.cells.map((cell) => deps.cellKey(rowKey, cell.columnId)));
      presentation = { attempt, keys };
      for (const key of keys) deps.addDirty(key);
      deps.note(ROW_REVERT_PENDING);

      const attempted: PreparedRowRevertCell<T>[] = [];
      try {
        for (const cell of attempt.cells) {
          attempted.push(cell); // include a setter that mutates and then throws in recovery
          cell.apply(attempt.row, cell.value);
        }
      } catch {
        compensate(attempt, attempted);
        if (!disposed) {
          deps.bumpVersion();
          detach(attempt);
          deps.sessions.finish(attempt, 'invalidated');
          deps.note(ROW_REVERT_FAILED);
        }
        return true;
      }

      deps.bumpVersion();
      void settle(attempt);
      return true;
    },

    isPending(): boolean {
      return !disposed && presentation !== undefined;
    },

    reconcile(rowKey, row): void {
      if (disposed || presentation === undefined) return;
      const attempt = presentation.attempt;
      if (rowKey === attempt.rowKey && row === attempt.row) return;
      detach(attempt);
      deps.sessions.finish(attempt, 'invalidated');
    },

    invalidate(keys): void {
      if (disposed || presentation === undefined || !keys.has(presentation.attempt.rowKey)) return;
      const attempt = presentation.attempt;
      detach(attempt);
      deps.sessions.finish(attempt, 'invalidated');
    },

    dispose(): void {
      disposed = true;
      presentation = undefined;
    },
  };
}

/** Return whether a session belongs to the supplied exact row identity. */
function sameRow<T>(session: RowEditSession<T> | undefined, rowKey: Key, row: T): session is RowEditSession<T> {
  return session !== undefined && session.rowKey === rowKey && session.row === row;
}

/**
 * Create a bounded row-revert session controller.
 *
 * @param enabled Whether row validation is configured. Disabled controllers discard commit reports so
 *   ordinary editable grids retain no unused history.
 * @returns A controller that owns accepted-commit journals and asynchronous attempt identity.
 */
export function createRowRevertController<T>(enabled: boolean): RowRevertController<T> {
  const sessions = new Map<Key, RowEditSession<T>>();
  let disposed = false;

  const exact = (rowKey: Key, row: T): RowEditSession<T> | undefined => {
    const session = sessions.get(rowKey);
    if (sameRow(session, rowKey, row)) return session;
    if (session !== undefined) sessions.delete(rowKey);
    return undefined;
  };

  return {
    recordCommit(change): void {
      if (!enabled || disposed) return;

      // A grid visit has one focused row. Dropping every other key keeps retained state bounded even
      // when a caller republishes or reorders its collection between event-loop turns.
      for (const key of sessions.keys()) {
        if (key !== change.rowKey) sessions.delete(key);
      }

      let session = exact(change.rowKey, change.row);
      if (session === undefined) {
        session = {
          rowKey: change.rowKey,
          row: change.row,
          changes: new Map(),
          trapped: false,
          reverting: false,
        };
        sessions.set(change.rowKey, session);
      }

      const prior = session.changes.get(change.columnId);
      if (prior === undefined) {
        session.changes.set(change.columnId, {
          columnId: change.columnId,
          apply: change.apply,
          baseline: change.previous,
          current: change.value,
        });
      } else {
        prior.current = change.value;
      }
    },

    isTouched(rowKey, row): boolean {
      if (disposed) return false;
      return (exact(rowKey, row)?.changes.size ?? 0) > 0;
    },

    isTrapped(rowKey, row): boolean {
      if (disposed) return false;
      const session = exact(rowKey, row);
      return session?.trapped === true && session.changes.size > 0;
    },

    isReverting(rowKey, row): boolean {
      if (disposed) return false;
      return exact(rowKey, row)?.reverting === true;
    },

    markTrapped(rowKey, row): void {
      if (disposed) return;
      const session = exact(rowKey, row);
      if (session !== undefined && session.changes.size > 0) session.trapped = true;
    },

    release(rowKey, row): void {
      if (disposed) return;
      const session = sessions.get(rowKey);
      if (sameRow(session, rowKey, row)) sessions.delete(rowKey);
    },

    reconcileFocus(rowKey, row): void {
      if (disposed) return;
      for (const [key, session] of sessions) {
        if (rowKey === undefined || row === undefined || key !== rowKey || session.row !== row) {
          sessions.delete(key);
        }
      }
    },

    prepare(rowKey, row): PreparedRowRevert<T> | undefined {
      if (disposed) return undefined;
      const session = exact(rowKey, row);
      if (session === undefined || !session.trapped || session.reverting || session.changes.size === 0) {
        return undefined;
      }

      const token = Symbol('row-revert-attempt');
      session.reverting = true;
      session.attemptToken = token;
      const cells = Object.freeze(
        [...session.changes.values()].map((change) =>
          Object.freeze<PreparedRowRevertCell<T>>({
            columnId: change.columnId,
            value: change.baseline,
            previous: change.current,
            apply: change.apply,
          }),
        ),
      );
      return Object.freeze({ rowKey, row, cells, token });
    },

    finish(attempt, outcome): RowRevertFinish {
      if (disposed) return { owned: false, retryable: false };
      const session = sessions.get(attempt.rowKey);
      const owned =
        sameRow(session, attempt.rowKey, attempt.row) && session.reverting && session.attemptToken === attempt.token;
      if (!owned) return { owned: false, retryable: false };

      if (outcome === 'rejected') {
        session.reverting = false;
        session.attemptToken = undefined;
        return { owned: true, retryable: true };
      }

      sessions.delete(attempt.rowKey);
      return { owned: true, retryable: false };
    },

    invalidate(keys): void {
      if (disposed) return;
      if (keys === undefined) {
        sessions.clear();
        return;
      }
      for (const key of keys) sessions.delete(key);
    },

    dispose(): void {
      disposed = true;
      sessions.clear();
    },
  };
}
