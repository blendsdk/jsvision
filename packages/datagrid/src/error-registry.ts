/**
 * The invalid-cell registry: the reactive twin of the dirty registry, but each cell carries a
 * validation message and there is one shared "active" message channel for the grid's message band.
 *
 * A cell is marked invalid with {@link ErrorRegistry.set} (a blocked commit — a failed `validate`,
 * an unparseable value, or a vetoed change) and cleared with {@link ErrorRegistry.clear} (a successful
 * re-commit, or an abandoned edit). Distinct from the dirty registry: dirty means a commit is in flight;
 * invalid means a commit was blocked and never took. The band's active message follows a single
 * last-writer-wins channel shared by keyed `set` and the keyless {@link ErrorRegistry.note} (used by the
 * row gate for a message not anchored to one cell), so the band always shows the most recent problem and
 * falls back to a still-invalid cell rather than going blank.
 */
import { signal } from '@jsvision/ui';

/** A reactive registry of cells whose last commit was blocked, each with a message, plus the active one. */
export interface ErrorRegistry {
  /** Mark a cell invalid with `message`; it also becomes the active (band) message. */
  set(key: string, message: string): void;
  /** Clear a cell. If it held the active message, the band recomputes to the next still-invalid cell. */
  clear(key: string): void;
  /** Whether a cell is invalid — a reactive read (re-runs in an effect on change). */
  has(key: string): boolean;
  /** The message for a cell, or `undefined` — a reactive read. */
  message(key: string): string | undefined;
  /** The current active message to show in the band, or `null` — a reactive read. */
  active(): string | null;
  /**
   * Push (or clear, with `null`) a **transient** message that has no cell key — used by the row gate for
   * a cross-field message not anchored to one invalid cell. It shares the single last-writer-wins active
   * channel with keyed `set`. `note(null)` recomputes the active message to the most-recent still-invalid
   * keyed cell (else `null`), so clearing a transient message never hides one a red cell still needs.
   */
  note(message: string | null): void;
  /** The invalid-cell key set (for the paint pass) — a reactive read. */
  keys(): ReadonlySet<string>;
}

/**
 * Create a reactive {@link ErrorRegistry}. `set`/`clear` publish a **fresh** `Map` reference so effects
 * that read `has`/`keys`/`message` re-run, driving the `gridInvalid` overpaint reactively; a small
 * companion signal carries the single active-message channel that the band binds. Uses only bare signals
 * — no `computed` — matching the package's controller convention.
 *
 * @returns An {@link ErrorRegistry}.
 * @example
 * ```ts
 * import { createErrorRegistry, cellKey } from '@jsvision/datagrid';
 * const errors = createErrorRegistry();
 * errors.set(cellKey(1, 'qty'), 'Quantity must be positive');
 * errors.has(cellKey(1, 'qty')); // true
 * errors.active();               // 'Quantity must be positive'
 * errors.clear(cellKey(1, 'qty'));
 * errors.active();               // null
 * ```
 */
export function createErrorRegistry(): ErrorRegistry {
  const messages = signal<ReadonlyMap<string, string>>(new Map());
  const activeMsg = signal<string | null>(null);
  // The key whose message is currently active, or null when the active message is a transient `note`
  // (or there is none). Kept outside the reactive graph purely as recompute bookkeeping: it lets a
  // `clear` on an unrelated cell leave a note (or another cell's message) showing, while a `clear` on
  // the active cell falls the band back to the next still-invalid cell.
  let activeKey: string | null = null;

  /** The most-recently-set surviving entry (Map preserves insertion order; `set` re-inserts to the end). */
  const lastEntry = (m: ReadonlyMap<string, string>): [string, string] | undefined => {
    let last: [string, string] | undefined;
    for (const entry of m) last = entry;
    return last;
  };

  /** Point the active channel at the most-recent still-invalid cell, or clear it when none remain. */
  const recomputeActive = (): void => {
    const last = lastEntry(messages());
    activeKey = last ? last[0] : null;
    activeMsg.set(last ? last[1] : null);
  };

  return {
    set: (key, message) => {
      const next = new Map(messages());
      next.delete(key); // re-insert so this key is the most-recent (insertion-order) entry for the fallback
      next.set(key, message);
      messages.set(next);
      activeKey = key;
      activeMsg.set(message);
    },
    clear: (key) => {
      if (!messages().has(key)) return;
      const next = new Map(messages());
      next.delete(key);
      messages.set(next);
      if (activeKey === key) recomputeActive(); // the shown message's cell went away → fall back
    },
    has: (key) => messages().has(key),
    message: (key) => messages().get(key),
    active: () => activeMsg(),
    note: (message) => {
      if (message === null) {
        recomputeActive(); // a transient row/veto message cleared → keep a still-invalid cell's message
      } else {
        activeKey = null; // a keyless transient message owns the band until it is cleared or superseded
        activeMsg.set(message);
      }
    },
    keys: () => new Set(messages().keys()),
  };
}
