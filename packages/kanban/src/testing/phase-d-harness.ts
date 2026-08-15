import { resolveCapabilities } from '@jsvision/core';
import type { ScreenBuffer } from '@jsvision/core';
import { Group, createRenderRoot } from '@jsvision/ui';

import { KanbanBoard } from '../board/kanban-board.js';
import type { KanbanCardAdapter } from '../card/adapter.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { createEagerKanbanDataSource } from '../source/eager-source.js';
import type { KanbanFilterField } from '../source/eager-index.js';
import type {
  KanbanColumnMeta,
  KanbanCellAddress,
  KanbanDataSource,
  KanbanFilter,
  KanbanQuery,
  KanbanQuerySession,
  KanbanSwimlaneMeta,
} from '../source/types.js';
import { createKanbanFakeClock } from './drag-harness.js';
import { createKanbanViewController } from '../view/controller.js';

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
  /** Exact registered filter count retained while the measured commit changes presentation. */
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

/** Reads every atomic source facet before the board may activate the candidate session. */
function validateCandidate<TCard>(candidate: KanbanQuerySession<TCard>): void {
  candidate.state();
  candidate.revision();
  candidate.columns();
  candidate.swimlanes();
  candidate.counts();
  candidate.headers();
  candidate.identityChanges();
}

/** Counts changed terminal cells without treating a scheduled frame as a full-scene repaint. */
function changedCellCount(before: ScreenBuffer, after: ScreenBuffer): number {
  if (before.width !== after.width || before.height !== after.height) return after.width * after.height;
  let changed = 0;
  for (let y = 0; y < after.height; y += 1) {
    for (let x = 0; x < after.width; x += 1) {
      const left = before.get(x, y);
      const right = after.get(x, y);
      if (
        left?.char !== right?.char ||
        left?.fg !== right?.fg ||
        left?.bg !== right?.bg ||
        left?.attrs !== right?.attrs ||
        left?.width !== right?.width
      ) {
        changed += 1;
      }
    }
  }
  return changed;
}

/** Immutable publication retained by the performance fixture between measured activations. */
interface PreparedPerformanceSession<TCard> {
  readonly session: KanbanQuerySession<TCard>;
  readonly state: ReturnType<KanbanQuerySession<TCard>['state']>;
  readonly revision: ReturnType<KanbanQuerySession<TCard>['revision']>;
  readonly columns: ReturnType<KanbanQuerySession<TCard>['columns']>;
  readonly swimlanes: ReturnType<KanbanQuerySession<TCard>['swimlanes']>;
  readonly counts: ReturnType<KanbanQuerySession<TCard>['counts']>;
  readonly headers: ReturnType<KanbanQuerySession<TCard>['headers']>;
  readonly identityChanges: ReturnType<KanbanQuerySession<TCard>['identityChanges']>;
}

/** Captures one fully validated eager publication outside the retained timing window. */
function preparePerformanceSession<TCard>(session: KanbanQuerySession<TCard>): PreparedPerformanceSession<TCard> {
  validateCandidate(session);
  return Object.freeze({
    session,
    state: session.state(),
    revision: session.revision(),
    columns: session.columns(),
    swimlanes: session.swimlanes(),
    counts: session.counts(),
    headers: session.headers(),
    identityChanges: session.identityChanges(),
  });
}

/** Creates an independently disposable lease over one prepared immutable eager publication. */
function leasePreparedSession<TCard>(prepared: PreparedPerformanceSession<TCard>): KanbanQuerySession<TCard> {
  const locateCard = prepared.session.locateCard?.bind(prepared.session);
  const swimlaneLayoutHints = prepared.session.swimlaneLayoutHints?.bind(prepared.session);
  return Object.freeze({
    state: () => prepared.state,
    revision: () => prepared.revision,
    columns: () => prepared.columns,
    swimlanes: () => prepared.swimlanes,
    counts: () => prepared.counts,
    headers: () => prepared.headers,
    identityChanges: () => prepared.identityChanges,
    cell: (address: KanbanCellAddress) => prepared.session.cell(address),
    ...(locateCard === undefined ? {} : { locateCard }),
    ...(swimlaneLayoutHints === undefined ? {} : { swimlaneLayoutHints }),
    // Cell cursors remain independently disposable. The prepared session itself belongs to the
    // harness cache and is released only when the complete measurement fixture is disposed.
    dispose: () => undefined,
  });
}

/** Keys cached eager data by source semantics while leaving presentation revisions to the controller. */
function performanceQueryKey(query: KanbanQuery): string {
  const { viewRevision: _presentationRevision, ...sourceSemantics } = query;
  return JSON.stringify(sourceSemantics);
}

/**
 * Creates deterministic responsiveness evidence for the complete eager query activation boundary.
 *
 * Fake time advances the configured debounce exactly. Every configured filter remains active while
 * each callback commits a presentation change through a mounted controller, source, board, and render root. Timing therefore includes candidate
 * validation, atomic activation, subscriber delivery, board layout work, and the resulting paint,
 * while excluding only the virtual waiting interval.
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
  const eagerSource = createEagerKanbanDataSource(() => fixture.cards, {
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
  let candidateOpens = 0;
  const preparedSessions = new Map<string, PreparedPerformanceSession<KanbanPhaseDWorkflowCard>>();
  const source: KanbanDataSource<KanbanPhaseDWorkflowCard> = Object.freeze({
    openQuery: (
      query: Parameters<KanbanDataSource<KanbanPhaseDWorkflowCard>['openQuery']>[0],
      sourceOptions?: Parameters<KanbanDataSource<KanbanPhaseDWorkflowCard>['openQuery']>[1],
    ) => {
      candidateOpens += 1;
      const key = performanceQueryKey(query);
      let prepared = preparedSessions.get(key);
      if (prepared === undefined) {
        const session = eagerSource.openQuery(query, sourceOptions);
        try {
          prepared = preparePerformanceSession(session);
          preparedSessions.set(key, prepared);
        } catch (error) {
          session.dispose();
          throw error;
        }
      }
      return leasePreparedSession(prepared);
    },
  });
  const controller = createKanbanViewController({ debounceMs: 0 });
  const card: KanbanCardAdapter<KanbanPhaseDWorkflowCard> = Object.freeze({
    keyOf: (value: KanbanPhaseDWorkflowCard) => value.key,
    titleOf: (value: KanbanPhaseDWorkflowCard) => value.title,
    statusOf: (value: KanbanPhaseDWorkflowCard) => value.columnId,
  });
  const board = new KanbanBoard({ source, query: controller.query, card, view: { controller } });
  // The performance seam isolates query activation from the separate full-board scale benchmark.
  // A mounted minimum-size board still executes controller, source, board, and paint lifecycles
  // without measuring thousands of card descriptors a second time.
  board.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 1, height: 1 } });
  const scene = new Group();
  scene.add(board);
  let scheduledFrames = 0;
  const render = createRenderRoot(
    { width: 20, height: 5 },
    {
      caps: resolveCapabilities({ env: {}, platform: 'linux' }).profile,
      schedule: () => {
        scheduledFrames += 1;
      },
    },
  );
  render.mount(scene);
  let deliveries = 0;
  const unsubscribe = controller.subscribe(() => {
    deliveries += 1;
  });
  controller.apply({ kind: 'set-grouping', grouping: { fieldId: 'fixture.swimlane' } });
  controller.apply({ kind: 'set-filters', filters: fixture.filters });
  render.flush();
  let disposed = false;
  let cached: KanbanPhaseDPerformanceResult | undefined;

  /** Performs one virtual-debounce and real eager-session transaction. */
  const commit = (ordinal: number): Readonly<{ sampleMs: number; evidence: KanbanPhaseDCommitEvidence }> => {
    let sampleMs: number | undefined;
    let evidence: KanbanPhaseDCommitEvidence | undefined;
    clock.schedule(debounceMs, () => {
      const beforeCandidates = candidateOpens;
      const beforeRevision = controller.state().revision;
      const beforeReflows = board.inspection().layoutReflows;
      const beforeFrames = scheduledFrames;
      const beforeDeliveries = deliveries;
      const beforeBuffer = render.buffer().clone();
      const started = performance.now();
      const transition = controller.apply({
        kind: 'set-density',
        density: ordinal % 2 === 0 ? 'compact' : 'comfortable',
      });
      if (transition.kind !== 'changed') throw new Error('Kanban performance transition did not activate.');
      render.flush();
      sampleMs = performance.now() - started;
      const afterBuffer = render.buffer();
      const changedCells = changedCellCount(beforeBuffer, afterBuffer);
      evidence = Object.freeze({
        candidateOpens: candidateOpens - beforeCandidates,
        activations: controller.state().revision !== beforeRevision ? 1 : 0,
        layoutReflows: board.inspection().layoutReflows - beforeReflows,
        renderInvalidations: scheduledFrames - beforeFrames,
        deliveries: deliveries - beforeDeliveries,
        fullSceneInvalidations: changedCells === afterBuffer.width * afterBuffer.height ? 1 : 0,
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
      unsubscribe();
      render.unmount();
      board.dispose();
      controller.dispose();
      for (const prepared of preparedSessions.values()) prepared.session.dispose();
      preparedSessions.clear();
      clock.dispose();
    },
  });
}
