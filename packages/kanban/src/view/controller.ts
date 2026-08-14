import { batch } from '@jsvision/ui';

import type { KanbanCardDensity } from '../card/descriptor.js';
import { KanbanInvalidQueryError } from '../contract/error.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanRevision } from '../contract/revision.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import type { KanbanQuery } from '../source/types.js';
import { snapshotKanbanQuery } from '../source/validation.js';
import type { KanbanViewRegistry } from './registry.js';
import { createKanbanViewScheduler } from './scheduler.js';
import { kanbanViewStatesEqual, snapshotKanbanViewState, transitionKanbanViewState } from './state.js';
import { createUnboundKanbanViewSummary } from './summary.js';
import type { KanbanViewSummary } from './summary.js';
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
  /** Initial sanitized search text committed with the first controller snapshot. */
  readonly search?: string;
  /** Initial card density. */
  readonly density?: KanbanCardDensity;
}

/** Construction options for one independent view controller. */
export interface KanbanViewControllerOptions {
  /** Optional initial controller-owned facets. */
  readonly initial?: KanbanViewControllerInitialState;
  /** Whole-millisecond search debounce; defaults to 150 ms. */
  readonly debounceMs?: number;
  /** Optional declarative quick-filter registry interpreted into ordinary source filters. */
  readonly registry?: KanbanViewRegistry;
}

/** @internal Prepared projection whose fallible work completed before public controller activation. */
export interface KanbanPreparedViewProjection {
  /** Installs the candidate projection without releasing the previous generation. */
  readonly commit: () => void;
  /** Confirms that every internal public channel now carries the candidate revision. */
  readonly verify: () => boolean;
  /** Restores the exact prior projection when post-install evidence is inconsistent. */
  readonly rollback: () => void;
  /** Releases the prepared candidate when it never became active. */
  readonly abort: () => void;
  /** Releases the captured prior generation after successful activation. */
  readonly retire: () => void;
}

/** @internal Exclusive board participant used to stage source-backed view transitions. */
export interface KanbanViewProjectionParticipant {
  /** Stages one candidate through all synchronous source and projection validation. */
  readonly prepare: (state: KanbanViewState, query: KanbanQuery) => KanbanPreparedViewProjection;
  /** Returns honest evidence for the last committed bound projection. */
  readonly summary: () => KanbanViewSummary;
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
    search: searchDraft(options.initial?.search ?? ''),
    filters: EMPTY,
    quickFilters: EMPTY,
    sort: EMPTY,
    columns: Object.freeze({ items: EMPTY }),
    swimlanes: Object.freeze({ items: EMPTY }),
    presentation: Object.freeze({
      density: density(options.initial?.density),
      cardFieldIds: EMPTY,
      summaryIds: EMPTY,
      checklist: 'hidden',
    }),
    revision: 0,
  });
}

/** Derives the source-facing immutable query for the currently supported controller facets. */
function queryFor(state: KanbanViewState, registry: KanbanViewRegistry | undefined): KanbanQuery {
  const visibleColumnIds = state.columns.items.filter((item) => item.visible).map((item) => item.columnId);
  const visibleSwimlaneIds = state.swimlanes.items.filter((item) => item.visible).map((item) => item.swimlaneId);
  const quickFilters = state.quickFilters.map((selection) => {
    const registration = registry?.quickFilter(selection.id);
    if (registration === undefined) throw new KanbanViewQueryError('unknown-quick-filter');
    try {
      if (registration.applicable !== undefined && registration.applicable() !== true) {
        throw new KanbanViewQueryError('quick-filter-unavailable');
      }
      if (selection.value !== undefined && registration.parameterCodec === undefined) {
        throw new KanbanViewQueryError('quick-filter-unavailable');
      }
      const value =
        selection.value === undefined
          ? (registration.filter.value ?? null)
          : registration.parameterCodec!.snapshot(selection.value);
      return Object.freeze({
        fieldId: registration.filter.fieldId,
        operatorId: registration.filter.operatorId,
        value,
      });
    } catch (error) {
      if (error instanceof KanbanViewQueryError) throw error;
      throw new KanbanViewQueryError('quick-filter-unavailable');
    }
  });
  return snapshotKanbanQuery({
    ...(state.search.length === 0 ? {} : { search: state.search }),
    filters: Object.freeze([...state.filters, ...quickFilters]),
    ...(state.grouping === undefined ? {} : { groupBy: state.grouping.fieldId }),
    sort: state.sort,
    ...(state.columns.items.length === 0 ? {} : { visibleColumnIds: Object.freeze(visibleColumnIds) }),
    ...(state.swimlanes.items.length === 0 ? {} : { visibleSwimlaneIds: Object.freeze(visibleSwimlaneIds) }),
    viewRevision: state.revision,
  });
}

/** Internal payload-free query-derivation failure exposed only as a stable result code. */
class KanbanViewQueryError extends Error {
  /** Stable public result code selected without retaining application values. */
  readonly code: string;

  /** Creates one query-derivation failure. */
  constructor(code: string) {
    super('Kanban view query could not be derived.');
    this.name = 'KanbanViewQueryError';
    this.code = code;
  }
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
  readonly #summary: KanbanViewSummary = createUnboundKanbanViewSummary();
  readonly #registry: KanbanViewRegistry | undefined;
  #state: KanbanViewState;
  #query: KanbanQuery;
  #participant: KanbanViewProjectionParticipant | undefined;
  #participantLease: object | undefined;
  #committing = false;
  #disposed = false;

  /** Initializes one committed state/query pair before any callback can observe it. */
  constructor(options: KanbanViewControllerOptions) {
    this.#registry = options.registry;
    this.#state = initialState(options);
    this.#query = queryFor(this.#state, this.#registry);
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

  /** Returns honest unbound counts until board binding supplies source evidence. */
  summary(): KanbanViewSummary {
    return this.#participant?.summary() ?? this.#summary;
  }

  /** Validates and atomically publishes one transition, with search using the scheduler boundary. */
  apply(transition: KanbanViewTransition): KanbanViewTransitionResult {
    if (this.#disposed) return Object.freeze({ kind: 'unavailable' });
    if (transition.kind === 'set-search') {
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
    try {
      const candidate = transitionKanbanViewState(this.#state, transition, nextRevision(this.#state.revision));
      return this.#commitCandidate(candidate);
    } catch {
      return Object.freeze({ kind: 'rejected', code: 'invalid-transition' });
    }
  }

  /** Validates a complete detached snapshot before replacing state and query together. */
  replace(state: unknown): KanbanViewTransitionResult {
    if (this.#disposed) return Object.freeze({ kind: 'unavailable' });
    try {
      const candidate = snapshotKanbanViewState(state, nextRevision(this.#state.revision));
      this.#scheduler.cancel();
      return this.#commitCandidate(candidate);
    } catch {
      return Object.freeze({ kind: 'rejected', code: 'invalid-state' });
    }
  }

  /** Cancels pending search and clears every active search/filter facet atomically. */
  clearFilters(): KanbanViewTransitionResult {
    if (this.#disposed) return Object.freeze({ kind: 'unavailable' });
    this.#scheduler.cancel();
    try {
      return this.#commitCandidate(
        transitionKanbanViewState(this.#state, { kind: 'clear-filters' }, nextRevision(this.#state.revision)),
      );
    } catch {
      return Object.freeze({ kind: 'rejected', code: 'invalid-transition' });
    }
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

  /** Attaches one exclusive board projection participant for its exact disposable lease. */
  attachParticipant(participant: KanbanViewProjectionParticipant): () => void {
    if (this.#disposed) throw new TypeError('Cannot bind a disposed Kanban view controller.');
    if (this.#participant !== undefined) throw new TypeError('Kanban view controller is already bound.');
    const lease = Object.freeze({});
    this.#participant = participant;
    this.#participantLease = lease;
    return () => {
      if (this.#participantLease !== lease) return;
      this.#participant = undefined;
      this.#participantLease = undefined;
    };
  }

  /** Commits one still-current scheduler generation and then notifies isolated observers. */
  #commitSearch(search: string): void {
    if (this.#disposed || search === this.#state.search) return;
    try {
      this.#commitCandidate(
        transitionKanbanViewState(this.#state, { kind: 'set-search', search }, nextRevision(this.#state.revision)),
      );
    } catch {
      // Invalid scheduled input is discarded without disturbing the last committed projection.
    }
  }

  /** Publishes a complete state/query pair before delivering isolated observer callbacks. */
  #commitCandidate(candidate: KanbanViewState): KanbanViewTransitionResult {
    if (kanbanViewStatesEqual(this.#state, candidate)) return Object.freeze({ kind: 'unchanged' });
    if (this.#committing) return Object.freeze({ kind: 'unavailable', code: 'view-transition-active' });
    let query: KanbanQuery;
    let prepared: KanbanPreparedViewProjection | undefined;
    try {
      query = queryFor(candidate, this.#registry);
      prepared = this.#participant?.prepare(candidate, query);
    } catch (error) {
      const code =
        error instanceof KanbanViewQueryError
          ? error.code
          : error instanceof KanbanInvalidQueryError && error.reason === 'unknown-comparator'
            ? 'unknown-comparator'
            : 'query-open-failed';
      return Object.freeze({ kind: 'rejected', code });
    }
    const previousState = this.#state;
    const previousQuery = this.#query;
    let installed = false;
    this.#committing = true;
    try {
      try {
        batch(() => {
          prepared?.commit();
          this.#state = candidate;
          this.#query = query;
          installed = true;
        });
      } catch {
        // A closing reactive flush can fail after every write has landed. Verification below decides
        // whether to keep the complete candidate or restore the previous complete projection.
      }
      if (!installed || prepared?.verify() === false) {
        try {
          batch(() => {
            prepared?.rollback();
            this.#state = previousState;
            this.#query = previousQuery;
          });
        } catch {
          // The rollback body restores all fields before a closing reactive flush can report failure.
        }
        try {
          prepared?.abort();
        } catch {
          // Candidate cleanup is isolated so the previous committed projection remains callable.
        }
        return Object.freeze({ kind: 'rejected', code: 'query-open-failed' });
      }
      try {
        prepared?.retire();
      } catch {
        // Retirement follows activation and cannot revoke the already verified committed projection.
      }
      for (const subscriber of [...this.#subscribers]) {
        if (this.#disposed) break;
        try {
          subscriber(this.#state, this.#query);
        } catch {
          // One application observer cannot prevent later observers from seeing a committed projection.
        }
      }
    } finally {
      this.#committing = false;
    }
    return Object.freeze({ kind: 'changed', revision: candidate.revision });
  }
}

/** Internal implementation lookup that avoids adding transaction methods to the public interface. */
const VIEW_CONTROLLER_IMPLEMENTATIONS = new WeakMap<KanbanViewController, KanbanViewControllerImpl>();

/** @internal Attaches one exclusive board participant without widening the public controller contract. */
export function attachKanbanViewProjectionParticipant(
  controller: KanbanViewController,
  participant: KanbanViewProjectionParticipant,
): () => void {
  const implementation = VIEW_CONTROLLER_IMPLEMENTATIONS.get(controller);
  if (implementation === undefined) throw new TypeError('Unsupported Kanban view controller implementation.');
  return implementation.attachParticipant(participant);
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
  const controller = new KanbanViewControllerImpl(options);
  VIEW_CONTROLLER_IMPLEMENTATIONS.set(controller, controller);
  return controller;
}
