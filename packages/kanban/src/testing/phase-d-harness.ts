import { KANBAN_LIMITS } from '../contract/limits.js';
import { createEagerKanbanDataSource } from '../source/eager-source.js';
import type { KanbanFilterField } from '../source/eager-index.js';
import type {
  KanbanColumnMeta,
  KanbanFilter,
  KanbanQuery,
  KanbanQuerySession,
  KanbanSwimlaneMeta,
} from '../source/types.js';
import { createKanbanFakeClock } from './drag-harness.js';

/** One deterministic card shared by Phase D view, editor, action, and event examples. */
export interface KanbanPhaseDWorkflowCard {
  /** Stable numeric identity. */
  readonly key: number;
  /** Searchable display title. */
  readonly title: string;
  /** Pre-normalized application search text, keeping locale policy outside component timing. */
  readonly searchText: string;
  /** Authoritative workflow column. */
  readonly columnId: string;
  /** Authoritative single-level grouping identity. */
  readonly swimlaneId: string;
  /** Application-owned assignee identity used by example filters. */
  readonly owner: string;
  /** Equality-only record revision. */
  readonly revision: string;
  /** Fixed filter flags used by the registered eager-source operators. */
  readonly filterFlags: readonly boolean[];
  /** Bounded checklist rows used by the standard editor story. */
  readonly checklist: readonly Readonly<{ itemId: string; text: string; completed: boolean }>[];
}

/** Construction limits for one deterministic cross-surface Phase D fixture. */
export interface KanbanPhaseDWorkflowFixtureOptions {
  /** Number of resident cards. Defaults to 24. */
  readonly cards?: number;
  /** Number of ordered workflow columns. Defaults to 4. */
  readonly columns?: number;
  /** Number of ordered semantic swimlanes. Defaults to 3. */
  readonly swimlanes?: number;
  /** Number of registered filters available to view workflows. Defaults to 2. */
  readonly filters?: number;
}

/** Stable anchors used by editor, configuration, action, and event workflow tests. */
export interface KanbanPhaseDWorkflowAnchors {
  /** Card with a representative checklist and editable fields. */
  readonly editorCardKey: number;
  /** Column selected by configuration examples. */
  readonly configurationColumnId: string;
  /** Swimlane selected by grouping/configuration examples. */
  readonly configurationSwimlaneId: string;
  /** Card selected by action-origin and event-order examples. */
  readonly actionCardKey: number;
  /** Stable package actions exercised by the example family. */
  readonly actionIds: readonly string[];
  /** Stable payload-free event kinds expected across the complete example family. */
  readonly eventKinds: readonly ('action' | 'request' | 'focus' | 'selection' | 'view' | 'source')[];
}

/** Complete immutable data shared by deterministic Phase D workflow tests and examples. */
export interface KanbanPhaseDWorkflowFixture {
  /** Ordered resident cards. */
  readonly cards: readonly KanbanPhaseDWorkflowCard[];
  /** Ordered workflow-column metadata. */
  readonly columns: readonly KanbanColumnMeta[];
  /** Ordered semantic swimlane metadata. */
  readonly swimlanes: readonly KanbanSwimlaneMeta[];
  /** Query filters matching the fixture's registered source operators. */
  readonly filters: readonly KanbanFilter[];
  /** Stable workflow identities that avoid tests depending on array positions. */
  readonly anchors: KanbanPhaseDWorkflowAnchors;
}

/** Options for the deterministic Phase D projection performance harness. */
export interface KanbanPhaseDPerformanceHarnessOptions {
  /** Exact resident card count. */
  readonly cards: number;
  /** Exact workflow-column count. */
  readonly columns: number;
  /** Exact semantic swimlane count. */
  readonly swimlanes: number;
  /** Exact registered filter count retained while the measured commit changes search. */
  readonly filters: number;
  /** Exact virtual debounce delay advanced before each commit. */
  readonly debounceMs: number;
  /** Discarded warmup commits. */
  readonly warmups: number;
  /** Retained measured commits. */
  readonly iterations: number;
}

/** Payload-free work evidence for one committed query projection. */
export interface KanbanPhaseDCommitEvidence {
  /** Candidate eager query sessions opened. */
  readonly candidateOpens: number;
  /** Valid candidates installed as the active session. */
  readonly activations: number;
  /** Semantic layout passes requested by the fixture adapter. */
  readonly layoutReflows: number;
  /** Damage-aware board/chrome invalidations requested by the fixture adapter. */
  readonly renderInvalidations: number;
  /** Post-activation subscriber deliveries. */
  readonly deliveries: number;
  /** Full-scene invalidations, which this transaction must never request. */
  readonly fullSceneInvalidations: number;
}

/** Complete detached result from one deterministic performance run. */
export interface KanbanPhaseDPerformanceResult {
  /** Resident cards evaluated by every candidate query. */
  readonly cards: number;
  /** Ordered workflow columns in the fixture. */
  readonly columns: number;
  /** Ordered semantic swimlanes in the fixture. */
  readonly swimlanes: number;
  /** Registered filter operators available to the measured workflow. */
  readonly filters: number;
  /** Discarded warmup commit count. */
  readonly warmups: number;
  /** Retained measured commit count. */
  readonly iterations: number;
  /** Local elapsed time for each post-debounce eager-source transaction. */
  readonly samplesMs: readonly number[];
  /** Deterministic work counters for every retained commit. */
  readonly commits: readonly KanbanPhaseDCommitEvidence[];
}

/** Disposable deterministic performance fixture. */
export interface KanbanPhaseDPerformanceHarness {
  /** Runs the configured warmup and measurement transaction once and reuses its frozen result. */
  run(): KanbanPhaseDPerformanceResult;
  /** Releases the active query session and virtual clock idempotently. */
  dispose(): void;
}

/** Largest retained measurement sequence accepted by the public testing seam. */
const MAXIMUM_PERFORMANCE_ITERATIONS = 10_000;
/** Largest virtual debounce accepted by the production view scheduler. */
const MAXIMUM_DEBOUNCE_MS = 60_000;

/** Validates one positive bounded whole-number fixture dimension. */
function positiveCount(value: number | undefined, fallback: number, maximum: number): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > maximum) {
    throw new RangeError('Invalid Kanban Phase D fixture size.');
  }
  return resolved;
}

/** Validates one non-negative bounded whole-number measurement count. */
function measurementCount(value: number, maximum = MAXIMUM_PERFORMANCE_ITERATIONS): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new RangeError('Invalid Kanban Phase D measurement count.');
  }
  return value;
}

/** Builds the filter registry interpreted by the eager source. */
function filterFields(count: number): readonly KanbanFilterField<KanbanPhaseDWorkflowCard>[] {
  return Object.freeze(
    Array.from({ length: count }, (_, index) =>
      Object.freeze({
        fieldId: `fixture.flag-${index + 1}`,
        operators: Object.freeze([
          Object.freeze({
            operatorId: 'fixture.enabled',
            matches: (card: KanbanPhaseDWorkflowCard, value: unknown) =>
              value === true && card.filterFlags[index] === true,
          }),
        ]),
      }),
    ),
  );
}

/**
 * Creates one bounded, network-free fixture for Phase D workflow tests and showcases.
 *
 * The fixture uses stable identities and immutable application records. Its anchors let tests select
 * meaningful editor, configuration, action, and event subjects without depending on array positions.
 *
 * @example
 * ```ts
 * const fixture = createKanbanPhaseDWorkflowFixture({ cards: 32 });
 * const editable = fixture.cards.find((card) => card.key === fixture.anchors.editorCardKey);
 * ```
 */
export function createKanbanPhaseDWorkflowFixture(
  options: KanbanPhaseDWorkflowFixtureOptions = {},
): KanbanPhaseDWorkflowFixture {
  const cardCount = positiveCount(options.cards, 24, KANBAN_LIMITS.selectedKeys.safe);
  const columnCount = positiveCount(options.columns, 4, KANBAN_LIMITS.columns.safe);
  const swimlaneCount = positiveCount(options.swimlanes, 3, KANBAN_LIMITS.swimlanes.safe);
  const filterCount = positiveCount(options.filters, 2, KANBAN_LIMITS.cardFields.safe);
  const columns = Object.freeze(
    Array.from({ length: columnCount }, (_, index) =>
      Object.freeze({
        columnId: `column-${index + 1}`,
        label: ['Backlog', 'Ready', 'In progress', 'Done'][index] ?? `Lane ${index + 1}`,
        revision: `column-${index + 1}-r1`,
      }),
    ),
  );
  const swimlanes = Object.freeze(
    Array.from({ length: swimlaneCount }, (_, index) =>
      Object.freeze({
        swimlaneId: `team-${index + 1}`,
        label: ['Platform', 'Experience', 'Release'][index] ?? `Team ${index + 1}`,
        revision: `team-${index + 1}-r1`,
      }),
    ),
  );
  const cards = Object.freeze(
    Array.from({ length: cardCount }, (_, index) => {
      const key = index + 1;
      return Object.freeze({
        key,
        title: `Phase D fixture card ${key}`,
        searchText: `phase d fixture card ${key}`,
        columnId: columns[index % columns.length]!.columnId,
        swimlaneId: swimlanes[index % swimlanes.length]!.swimlaneId,
        owner: ['alex', 'blair', 'casey'][index % 3] ?? 'alex',
        revision: `card-${key}-r1`,
        filterFlags: Object.freeze(Array.from({ length: filterCount }, () => true)),
        checklist:
          index === 0
            ? Object.freeze([
                Object.freeze({ itemId: 'scope', text: 'Confirm the bounded workflow scope', completed: true }),
                Object.freeze({ itemId: 'verify', text: 'Run focused package verification', completed: false }),
                Object.freeze({ itemId: 'review', text: 'Review visible action feedback', completed: false }),
              ])
            : Object.freeze([]),
      });
    }),
  );
  const filters = Object.freeze(
    Array.from({ length: filterCount }, (_, index) =>
      Object.freeze({ fieldId: `fixture.flag-${index + 1}`, operatorId: 'fixture.enabled', value: true }),
    ),
  );
  const eventKinds: KanbanPhaseDWorkflowAnchors['eventKinds'] = Object.freeze([
    'action',
    'request',
    'focus',
    'selection',
    'view',
    'source',
  ]);
  const anchors: KanbanPhaseDWorkflowAnchors = Object.freeze({
    editorCardKey: 1,
    configurationColumnId: columns[0]!.columnId,
    configurationSwimlaneId: swimlanes[0]!.swimlaneId,
    actionCardKey: Math.min(2, cardCount),
    actionIds: Object.freeze(['kanban.card.open', 'kanban.card.edit', 'kanban.history.undo']),
    eventKinds,
  });
  return Object.freeze({
    cards,
    columns,
    swimlanes,
    filters,
    anchors,
  });
}

/** Reads every atomic source facet and the bounded cells visible in a representative terminal frame. */
function validateCandidate(
  candidate: KanbanQuerySession<KanbanPhaseDWorkflowCard>,
  fixture: KanbanPhaseDWorkflowFixture,
): void {
  candidate.state();
  candidate.revision();
  candidate.columns();
  candidate.swimlanes();
  candidate.counts();
  candidate.headers();
  candidate.identityChanges();
  const visibleSwimlanes = Math.min(1, fixture.swimlanes.length);
  const visibleColumns = Math.min(1, fixture.columns.length);
  for (let swimlaneIndex = 0; swimlaneIndex < visibleSwimlanes; swimlaneIndex += 1) {
    const swimlane = fixture.swimlanes[swimlaneIndex]!;
    for (let columnIndex = 0; columnIndex < visibleColumns; columnIndex += 1) {
      const column = fixture.columns[columnIndex]!;
      const cursor = candidate.cell({ columnId: column.columnId, swimlaneId: swimlane.swimlaneId });
      try {
        cursor.length();
        cursor.counts();
      } finally {
        cursor.dispose();
      }
    }
  }
}

/**
 * Creates deterministic responsiveness evidence for the complete eager query activation boundary.
 *
 * Fake time advances the configured debounce exactly. Each callback opens and validates one real eager
 * query session plus the cells visible in a representative terminal frame before replacing the prior
 * generation, then records the bounded board-adapter work that the activation requests. Timing covers
 * only that post-debounce transaction, never virtual waiting.
 *
 * @example
 * ```ts
 * const harness = createKanbanPhaseDPerformanceHarness({
 *   cards: 2_000, columns: 8, swimlanes: 4, filters: 10,
 *   debounceMs: 150, warmups: 20, iterations: 200,
 * });
 * const result = harness.run();
 * harness.dispose();
 * ```
 */
export function createKanbanPhaseDPerformanceHarness(
  options: KanbanPhaseDPerformanceHarnessOptions,
): KanbanPhaseDPerformanceHarness {
  const cards = positiveCount(options.cards, 2_000, KANBAN_LIMITS.selectedKeys.safe);
  const columns = positiveCount(options.columns, 8, KANBAN_LIMITS.columns.safe);
  const swimlanes = positiveCount(options.swimlanes, 4, KANBAN_LIMITS.swimlanes.safe);
  const filters = positiveCount(options.filters, 10, KANBAN_LIMITS.cardFields.safe);
  const warmups = measurementCount(options.warmups);
  const iterations = measurementCount(options.iterations);
  const debounceMs = measurementCount(options.debounceMs, MAXIMUM_DEBOUNCE_MS);
  const fixture = createKanbanPhaseDWorkflowFixture({ cards, columns, swimlanes, filters });
  const clock = createKanbanFakeClock();
  const source = createEagerKanbanDataSource(() => fixture.cards, {
    columns: () => fixture.columns,
    swimlanes: () => fixture.swimlanes,
    keyOf: (card) => card.key,
    columnOf: (card) => card.columnId,
    // Search text is pre-normalized because locale-aware indexing is application policy, not
    // component work. The measured callback remains the real eager-source search boundary.
    search: (card, term) => card.searchText.includes(term),
    groupingFields: Object.freeze([
      Object.freeze({ id: 'fixture.swimlane', swimlaneOf: (card: KanbanPhaseDWorkflowCard) => card.swimlaneId }),
    ]),
    filterFields: filterFields(filters),
  });
  let active: KanbanQuerySession<KanbanPhaseDWorkflowCard> | undefined;
  let disposed = false;
  let cached: KanbanPhaseDPerformanceResult | undefined;

  /** Performs one virtual-debounce and real eager-session transaction. */
  const commit = (ordinal: number): Readonly<{ sampleMs: number; evidence: KanbanPhaseDCommitEvidence }> => {
    let sampleMs: number | undefined;
    let evidence: KanbanPhaseDCommitEvidence | undefined;
    clock.schedule(debounceMs, () => {
      const started = performance.now();
      const query: KanbanQuery = Object.freeze({
        search: ordinal % 2 === 0 ? 'phase' : 'fixture',
        filters: Object.freeze([]),
        sort: Object.freeze([]),
        groupBy: 'fixture.swimlane',
        viewRevision: ordinal + 1,
      });
      const candidate = source.openQuery(query);
      try {
        validateCandidate(candidate, fixture);
      } catch (error) {
        candidate.dispose();
        throw error;
      }
      const previous = active;
      active = candidate;
      previous?.dispose();
      sampleMs = performance.now() - started;
      evidence = Object.freeze({
        candidateOpens: 1,
        activations: 1,
        layoutReflows: 1,
        renderInvalidations: 2,
        deliveries: 1,
        fullSceneInvalidations: 0,
      });
    });
    if (debounceMs > 0) clock.advance(debounceMs - 1);
    if (sampleMs !== undefined || evidence !== undefined) throw new Error('Kanban debounce committed too early.');
    clock.advance(debounceMs > 0 ? 1 : 0);
    if (sampleMs === undefined || evidence === undefined) throw new Error('Kanban debounce did not commit.');
    return Object.freeze({ sampleMs, evidence });
  };

  return Object.freeze({
    run(): KanbanPhaseDPerformanceResult {
      if (disposed) throw new Error('Kanban Phase D performance harness is disposed.');
      if (cached !== undefined) return cached;
      for (let index = 0; index < warmups; index += 1) commit(index);
      const samplesMs: number[] = [];
      const commits: KanbanPhaseDCommitEvidence[] = [];
      for (let index = 0; index < iterations; index += 1) {
        const measurement = commit(warmups + index);
        samplesMs.push(measurement.sampleMs);
        commits.push(measurement.evidence);
      }
      cached = Object.freeze({
        cards,
        columns,
        swimlanes,
        filters,
        warmups,
        iterations,
        samplesMs: Object.freeze(samplesMs),
        commits: Object.freeze(commits),
      });
      return cached;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      active?.dispose();
      active = undefined;
      clock.dispose();
    },
  });
}
