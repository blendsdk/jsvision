import type { KanbanCardDensity } from '../card/descriptor.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanRevision } from '../contract/revision.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import type { KanbanQuery } from '../source/types.js';
import { createKanbanViewScheduler } from './scheduler.js';
import type {
  KanbanSearchPolicy,
  KanbanViewController,
  KanbanViewState,
  KanbanViewSubscriber,
  KanbanViewTransition,
  KanbanViewTransitionResult,
} from './types.js';

/** Standard delay between search input and one committed query publication. */
export const KANBAN_VIEW_SEARCH_DEBOUNCE_MS = 150;

/** Ergonomic initial facets accepted by the controller constructor. */
export interface KanbanViewControllerInitialState {
  /** Initial search persistence policy. */
  readonly searchPolicy?: KanbanSearchPolicy;
  /** Initial card density. */
  readonly density?: KanbanCardDensity;
}

/** Construction options for one independent view controller. */
export interface KanbanViewControllerOptions {
  /** Optional initial controller-owned facets. */
  readonly initial?: KanbanViewControllerInitialState;
  /** Whole-millisecond search debounce; defaults to 150 ms. */
  readonly debounceMs?: number;
}

/** Shared immutable empty collection used by the initial view and query snapshots. */
const EMPTY = Object.freeze([]);
/** UTF-8 encoder used to enforce the search byte boundary before retention. */
const ENCODER = new TextEncoder();

/** Validates a named card density without accepting a caller-defined string. */
function density(value: KanbanCardDensity | undefined): KanbanCardDensity {
  if (value === undefined) return 'comfortable';
  if (value !== 'compact' && value !== 'comfortable' && value !== 'spacious') {
    throw new TypeError('Invalid Kanban view density.');
  }
  return value;
}

/** Returns the next equality-only local revision without wrapping. */
function nextRevision(revision: KanbanRevision): number {
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Kanban view revision exhausted.');
  }
  return revision + 1;
}

/** Creates the deeply immutable initial controller snapshot. */
function initialState(options: KanbanViewControllerOptions): KanbanViewState {
  const searchPolicy = options.initial?.searchPolicy ?? 'transient';
  if (searchPolicy !== 'transient' && searchPolicy !== 'durable') {
    throw new TypeError('Invalid Kanban search policy.');
  }
  return Object.freeze({
    searchPolicy,
    search: '',
    filters: EMPTY,
    quickFilters: EMPTY,
    sort: EMPTY,
    columns: Object.freeze({ items: EMPTY }),
    swimlanes: Object.freeze({ items: EMPTY }),
    presentation: Object.freeze({
      density: density(options.initial?.density),
      cardFieldIds: EMPTY,
      checklist: 'hidden',
    }),
    revision: 0,
  });
}

/** Derives the source-facing immutable query for the currently supported controller facets. */
function queryFor(state: KanbanViewState): KanbanQuery {
  return Object.freeze({
    ...(state.search.length === 0 ? {} : { search: state.search }),
    filters: state.filters,
    sort: state.sort,
    viewRevision: state.revision,
  });
}

/** Sanitizes one search draft and rejects values that exceed the public byte limit. */
function searchDraft(value: string): string {
  if (
    typeof value !== 'string' ||
    value.length > KANBAN_LIMITS.semanticStringBytes.safe ||
    ENCODER.encode(value).byteLength > KANBAN_LIMITS.semanticStringBytes.safe
  ) {
    throw new TypeError('Invalid Kanban search value.');
  }
  return sanitizeContractText(value, KANBAN_LIMITS.semanticStringBytes.safe).replace(/[\t\n]+/gu, ' ');
}

/** Internal controller that keeps draft search scheduling separate from committed snapshots. */
class KanbanViewControllerImpl implements KanbanViewController {
  readonly #scheduler;
  readonly #subscribers = new Set<KanbanViewSubscriber>();
  #state: KanbanViewState;
  #query: KanbanQuery;
  #disposed = false;

  /** Initializes one committed state/query pair before any callback can observe it. */
  constructor(options: KanbanViewControllerOptions) {
    this.#state = initialState(options);
    this.#query = queryFor(this.#state);
    this.#scheduler = createKanbanViewScheduler(options.debounceMs ?? KANBAN_VIEW_SEARCH_DEBOUNCE_MS);
  }

  /** Returns the last committed immutable state. */
  state(): KanbanViewState {
    return this.#state;
  }

  /** Returns the source query paired with the last committed state. */
  query(): KanbanQuery {
    return this.#query;
  }

  /** Schedules search publication while later controller tasks add the remaining transitions. */
  apply(transition: KanbanViewTransition): KanbanViewTransitionResult {
    if (this.#disposed) return Object.freeze({ kind: 'unavailable' });
    if (transition.kind !== 'set-search') return Object.freeze({ kind: 'rejected', code: 'unsupported-transition' });
    let search: string;
    try {
      search = searchDraft(transition.search);
    } catch {
      return Object.freeze({ kind: 'rejected', code: 'invalid-search' });
    }
    if (search === this.#state.search && !this.#scheduler.pending()) return Object.freeze({ kind: 'unchanged' });
    this.#scheduler.schedule(() => this.#commitSearch(search));
    return Object.freeze({ kind: 'pending' });
  }

  /** Complete replacement is introduced with atomic transition publication. */
  replace(_state: unknown): KanbanViewTransitionResult {
    return this.#disposed
      ? Object.freeze({ kind: 'unavailable' })
      : Object.freeze({ kind: 'rejected', code: 'unsupported-transition' });
  }

  /** Filter clearing is introduced with the remaining atomic transitions. */
  clearFilters(): KanbanViewTransitionResult {
    return this.#disposed
      ? Object.freeze({ kind: 'unavailable' })
      : Object.freeze({ kind: 'rejected', code: 'unsupported-transition' });
  }

  /** Registers one committed-publication observer. */
  subscribe(subscriber: KanbanViewSubscriber): () => void {
    if (this.#disposed || typeof subscriber !== 'function') return () => undefined;
    this.#subscribers.add(subscriber);
    return () => this.#subscribers.delete(subscriber);
  }

  /** Cancels pending search work and releases every observer. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#scheduler.dispose();
    this.#subscribers.clear();
  }

  /** Commits one still-current scheduler generation and then notifies isolated observers. */
  #commitSearch(search: string): void {
    if (this.#disposed || search === this.#state.search) return;
    const revision = nextRevision(this.#state.revision);
    this.#state = Object.freeze({ ...this.#state, search, revision });
    this.#query = queryFor(this.#state);
    for (const subscriber of [...this.#subscribers]) {
      try {
        subscriber(this.#state, this.#query);
      } catch {
        // One application observer cannot prevent later observers from seeing a committed projection.
      }
    }
  }
}

/**
 * Creates an independent disposable owner of one immutable Kanban view projection.
 *
 * @example
 * ```ts
 * const view = createKanbanViewController({ debounceMs: 150 });
 * view.apply({ kind: 'set-search', search: 'release' });
 * view.dispose();
 * ```
 */
export function createKanbanViewController(options: KanbanViewControllerOptions = {}): KanbanViewController {
  return new KanbanViewControllerImpl(options);
}
