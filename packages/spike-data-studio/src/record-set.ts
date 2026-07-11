/**
 * The `RecordSet` spine — the shared cursor + edit-buffer that both a grid and a bound form read.
 *
 * Design bet (the thing the spike validates): the edit buffer **is** a set of per-field signals.
 * Binding a control to `field('name')` is a normal two-way signal binding; moving the cursor writes
 * the new row's values into those same signals inside a `batch`, so every bound control repaints in
 * one coalesced frame with **no manual re-wire**. Dirty state is derived by comparing each buffer
 * signal to the committed row — no separate bookkeeping.
 *
 * Commit uses the Probe 2 xmin optimistic update; a concurrent change surfaces as a `'conflict'`
 * event rather than a lost update. A `beforeSave` hook lets a trusted handler veto or mutate a save
 * (Probe 6).
 */
import { signal, batch } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { DataSource, MetaRow } from './data-source.js';

/** The context a `beforeSave` handler receives — read/mutate the pending values, or veto the save. */
export interface SaveContext {
  get(field: string): string;
  set(field: string, value: string): void;
  veto(message: string): void;
  readonly key: Record<string, unknown>;
  readonly isInsert: boolean;
}

/** A veto thrown by a beforeSave handler; `commit()` rejects with this and does not touch the DB. */
export class SaveVetoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveVetoError';
  }
}

type SaveHandler = (ctx: SaveContext) => void;
type Unsub = () => void;

/** The outcome of a {@link RecordSet.commit}. */
export type CommitResult =
  | { status: 'ok'; row: MetaRow }
  | { status: 'conflict' }
  | { status: 'vetoed'; message: string }
  | { status: 'error'; message: string };

/**
 * A reactive cursor + edit buffer over a {@link DataSource}. Construct with a pre-fetched window (the
 * grid/form bind synchronously); call {@link RecordSet.moveTo} etc. to move the cursor, {@link
 * RecordSet.field} to bind a control, and {@link RecordSet.commit} to flush.
 */
export class RecordSet {
  /** The window array the grid binds to (a new reference on any page/refresh so the grid repaints). */
  readonly rows: Signal<MetaRow[]>;
  /** The cursor position (index into {@link rows}). */
  readonly position: Signal<number>;

  private readonly buffers = new Map<string, Signal<string>>();
  private readonly saveHandlers = new Set<SaveHandler>();
  private readonly listeners = new Map<string, Set<(payload?: unknown) => void>>();

  constructor(
    private readonly source: DataSource,
    initialRows: MetaRow[],
  ) {
    this.rows = signal(initialRows);
    this.position = signal(0);
  }

  /**
   * Whether any bound field differs from the committed row. Reactive when read inside a draw/effect
   * (it reads the buffer signals), so a dirty indicator repaints automatically; plain when called
   * imperatively. Not a standalone `computed`, so a RecordSet needs no owning reactive scope.
   */
  dirty(): boolean {
    return this.dirtyFields().length > 0;
  }

  /** The row under the cursor, or undefined for an empty set. */
  current(): MetaRow | undefined {
    return this.rows()[this.position()];
  }

  /**
   * Whether `row` is the cursor's current row (by identity). A grid whose current-row cell accessors
   * consult this + {@link field} gets LIVE form↔grid sync of uncommitted edits: reading a buffer
   * signal inside the grid's draw subscribes it, so a form keystroke repaints the grid cell too.
   */
  isCurrent(row: Record<string, unknown>): boolean {
    return row === this.current();
  }

  /** The live display text of a field on `row`: the edit buffer for the current row, else committed. */
  cellText(row: MetaRow, field: string): string {
    if (this.isCurrent(row) && this.buffers.has(field)) return this.field(field)();
    const v = row[field];
    return v === null || v === undefined ? '' : String(v);
  }

  /** The committed display text of a field on the current row (`''` for NULL/absent). */
  private committedText(field: string): string {
    const v = this.current()?.[field];
    return v === null || v === undefined ? '' : String(v);
  }

  /**
   * The two-way buffer signal for `field` — bind a control to this. Reads the current row's value on
   * first access; the cursor overwrites it on move. Created lazily and cached.
   */
  field(field: string): Signal<string> {
    let sig = this.buffers.get(field);
    if (!sig) {
      sig = signal(this.committedText(field));
      this.buffers.set(field, sig);
    }
    return sig;
  }

  /** The fields whose buffer differs from the committed row. */
  dirtyFields(): string[] {
    const out: string[] = [];
    for (const [field, sig] of this.buffers) {
      if (sig() !== this.committedText(field)) out.push(field);
    }
    return out;
  }

  /**
   * Overwrite every bound buffer from the current row, coalesced into one frame. Public because the
   * grid path drives the cursor directly (the grid's `focused` signal is the RecordSet position), so a
   * cursor-watch effect calls this to keep the edit buffers following the row.
   */
  syncBuffers(): void {
    batch(() => {
      for (const [field, sig] of this.buffers) sig.set(this.committedText(field));
    });
  }

  /** Move the cursor to `i` (clamped), re-sync the buffers, and fire `'current'`. */
  moveTo(i: number): void {
    const n = this.rows().length;
    const clamped = Math.max(0, Math.min(i, n - 1));
    batch(() => {
      this.position.set(clamped);
      this.syncBuffers();
    });
    this.emit('current', this.current());
  }

  next(): void {
    this.moveTo(this.position() + 1);
  }
  prev(): void {
    this.moveTo(this.position() - 1);
  }
  first(): void {
    this.moveTo(0);
  }
  last(): void {
    this.moveTo(this.rows().length - 1);
  }

  /** Discard pending edits — restore every buffer to the committed row. */
  rollback(): void {
    this.syncBuffers();
  }

  /** Register a `beforeSave` handler (trusted, in-process). Returns an unsubscribe. */
  onBeforeSave(handler: SaveHandler): Unsub {
    this.saveHandlers.add(handler);
    return () => this.saveHandlers.delete(handler);
  }

  /** Subscribe to a lifecycle event (`'current'`, `'commit'`, `'conflict'`). Returns an unsubscribe. */
  on(event: string, handler: (payload?: unknown) => void): Unsub {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(handler);
    return () => set!.delete(handler);
  }

  private emit(event: string, payload?: unknown): void {
    this.listeners.get(event)?.forEach((h) => h(payload));
  }

  /**
   * Flush the dirty fields to the DB inside the source's optimistic update. Runs `beforeSave` handlers
   * first (a veto aborts before any DB write). Returns a structured result; on `'ok'` the window row
   * is replaced (new xmin) and the buffer re-synced.
   */
  async commit(): Promise<CommitResult> {
    const row = this.current();
    if (!row) return { status: 'error', message: 'no current row' };
    const key = this.source.keyOf(row);

    // Assemble the pending values from the dirty buffers; let beforeSave mutate/veto.
    const pending: Record<string, string> = {};
    for (const f of this.dirtyFields()) pending[f] = this.field(f)();
    const ctx: SaveContext = {
      get: (f) => (f in pending ? pending[f] : this.field(f)()),
      set: (f, v) => {
        pending[f] = v;
        this.field(f).set(v);
      },
      veto: (message) => {
        throw new SaveVetoError(message);
      },
      key,
      isInsert: false,
    };
    try {
      for (const h of this.saveHandlers) h(ctx);
    } catch (err) {
      if (err instanceof SaveVetoError) return { status: 'vetoed', message: err.message };
      throw err;
    }

    if (Object.keys(pending).length === 0) return { status: 'ok', row };

    // Coerce empty string on a nullable column to NULL; otherwise pass the text (pg casts, parameterized).
    const values: Record<string, unknown> = {};
    for (const [f, text] of Object.entries(pending)) {
      const col = this.source.meta.columns.find((c) => c.name === f);
      values[f] = text === '' && col && !col.notNull ? null : text;
    }

    try {
      const res = await this.source.update(key, values, row.xmin);
      if (!res.ok) {
        this.emit('conflict', key);
        return { status: 'conflict' };
      }
      // Replace the row in the window with the returned (fresh-xmin) row, then re-sync buffers.
      const next = this.rows().slice();
      next[this.position()] = res.row;
      this.rows.set(next);
      this.syncBuffers();
      this.emit('commit', res.row);
      return { status: 'ok', row: res.row };
    } catch (err) {
      const { mapPgError } = await import('./crud.js');
      const mapped = mapPgError(err);
      return { status: 'error', message: mapped?.message ?? (err as Error).message };
    }
  }
}
