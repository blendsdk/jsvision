import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidPresentationError } from '../contract/error.js';
import { createKanbanCardKey, createKanbanColumnId, createKanbanSwimlaneId } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import { snapshotKanbanCount } from '../source/counts.js';
import type { KanbanCount } from '../source/counts.js';
import { snapshotKanbanDefinitionOfDone } from './definition-of-done.js';
import type { KanbanDefinitionOfDoneSnapshot } from './definition-of-done.js';
import type { KanbanWorkflowEvaluation, KanbanWorkflowViolationEvidence } from './wip.js';

/** Source or target semantic endpoint used by transition advice. */
export interface KanbanTransitionEndpoint {
  /** Stable workflow-column identity. */
  readonly columnId: string;
  /** Optional stable swimlane identity. */
  readonly swimlaneId?: string;
}

/** Authoritative counts supplied to one transition resolver. */
export interface KanbanTransitionCounts {
  /** Count at the source endpoint. */
  readonly source: KanbanCount;
  /** Count at the target endpoint. */
  readonly target: KanbanCount;
}

/** Complete detached context for one synchronous application transition resolver. */
export interface KanbanTransitionContext {
  /** Current semantic endpoint. */
  readonly source: KanbanTransitionEndpoint;
  /** Proposed semantic endpoint. */
  readonly target: KanbanTransitionEndpoint;
  /** Ordered application card identities participating in the proposal. */
  readonly cardKeys: readonly CardKey[];
  /** Equality-only source endpoint revision. */
  readonly sourceRevision: KanbanRevision;
  /** Equality-only target endpoint revision. */
  readonly targetRevision: KanbanRevision;
  /** Equality-only query-session revision. */
  readonly sessionRevision: KanbanRevision;
  /** Active query generation used to reject stale advice. */
  readonly queryGeneration: number;
  /** Authoritative source and target counts. */
  readonly counts: KanbanTransitionCounts;
  /** Optional complete definition-of-done evidence for the target. */
  readonly definitionOfDone?: KanbanDefinitionOfDoneSnapshot;
}

/** Pure application callback that provides transition advice without dispatching. */
export type KanbanTransitionResolver = (context: KanbanTransitionContext) => KanbanWorkflowEvaluation;

/** Optional sink for already-redacted transition observations. */
export type KanbanTransitionObservationSink = (observation: KanbanObservation) => void;

/** Exact members accepted on one semantic transition endpoint. */
const ENDPOINT_KEYS = new Set(['columnId', 'swimlaneId']);
/** Exact members accepted on a transition context. */
const CONTEXT_KEYS = new Set([
  'source',
  'target',
  'cardKeys',
  'sourceRevision',
  'targetRevision',
  'sessionRevision',
  'queryGeneration',
  'counts',
  'definitionOfDone',
]);
/** Exact members accepted on the source/target count record. */
const COUNTS_KEYS = new Set(['source', 'target']);
/** Exact members accepted from one application evaluation. */
const EVALUATION_KEYS = new Set(['kind', 'violation', 'code', 'label', 'retryable']);
/** Exact members accepted from informational WIP evidence. */
const VIOLATION_KEYS = new Set(['boundary', 'authoritativeCount', 'matchingCount', 'proposedCount', 'limit']);
/** Safe application reason-code grammar. */
const REASON_CODE = /^[a-z][a-z0-9-]*$/u;
/** ANSI control sequences removed as a unit from application-provided reason labels. */
const ANSI_CONTROL_SEQUENCE = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)?|.)/gu;
/** Bidirectional controls removed before labels reach terminal layout. */
const BIDI_CONTROLS = /[\u202a-\u202e\u2066-\u2069]/gu;

/** Converts malformed context or callback output into one payload-free public error. */
function invalidTransition(): never {
  throw new KanbanInvalidPresentationError();
}

/** Snapshots one endpoint without inferring move direction. */
function endpoint(value: unknown): KanbanTransitionEndpoint {
  const properties = snapshotKanbanDataProperties(value, ENDPOINT_KEYS.size);
  validateKanbanDataKeys(properties, ENDPOINT_KEYS);
  if (typeof properties.columnId !== 'string') return invalidTransition();
  try {
    const columnId = createKanbanColumnId(properties.columnId);
    if (properties.swimlaneId === undefined) return Object.freeze({ columnId });
    if (typeof properties.swimlaneId !== 'string') return invalidTransition();
    return Object.freeze({ columnId, swimlaneId: createKanbanSwimlaneId(properties.swimlaneId) });
  } catch {
    return invalidTransition();
  }
}

/** Snapshots ordered unique card identities without retaining caller storage. */
function cardKeys(value: unknown): readonly CardKey[] {
  const keys = snapshotKanbanDataArray(value, KANBAN_LIMITS.selectedKeys.safe).map((entry) => {
    if (typeof entry !== 'string' && typeof entry !== 'number') return invalidTransition();
    try {
      return createKanbanCardKey(entry);
    } catch {
      return invalidTransition();
    }
  });
  if (keys.length === 0 || new Set(keys).size !== keys.length) return invalidTransition();
  return Object.freeze(keys);
}

/** Snapshots source and target counts atomically. */
function transitionCounts(value: unknown): KanbanTransitionCounts {
  const properties = snapshotKanbanDataProperties(value, COUNTS_KEYS.size);
  validateKanbanDataKeys(properties, COUNTS_KEYS);
  if (Object.keys(properties).length !== COUNTS_KEYS.size) return invalidTransition();
  try {
    return Object.freeze({
      source: snapshotKanbanCount(properties.source),
      target: snapshotKanbanCount(properties.target),
    });
  } catch {
    return invalidTransition();
  }
}

/** Detaches and freezes one transition context before application code observes it. */
function transitionContext(value: unknown): KanbanTransitionContext {
  const properties = snapshotKanbanDataProperties(value, CONTEXT_KEYS.size);
  validateKanbanDataKeys(properties, CONTEXT_KEYS);
  if (
    typeof properties.queryGeneration !== 'number' ||
    !Number.isSafeInteger(properties.queryGeneration) ||
    properties.queryGeneration < 0
  ) {
    return invalidTransition();
  }
  try {
    return Object.freeze({
      source: endpoint(properties.source),
      target: endpoint(properties.target),
      cardKeys: cardKeys(properties.cardKeys),
      sourceRevision: snapshotKanbanRevision(properties.sourceRevision),
      targetRevision: snapshotKanbanRevision(properties.targetRevision),
      sessionRevision: snapshotKanbanRevision(properties.sessionRevision),
      queryGeneration: properties.queryGeneration,
      counts: transitionCounts(properties.counts),
      ...(properties.definitionOfDone === undefined
        ? {}
        : { definitionOfDone: snapshotKanbanDefinitionOfDone(properties.definitionOfDone) }),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidPresentationError) throw error;
    return invalidTransition();
  }
}

/** Snapshots exact informational violation evidence returned by an application. */
function violation(value: unknown): KanbanWorkflowViolationEvidence {
  const properties = snapshotKanbanDataProperties(value, VIOLATION_KEYS.size);
  validateKanbanDataKeys(properties, VIOLATION_KEYS);
  if (
    (properties.boundary !== 'minimum' && properties.boundary !== 'maximum') ||
    typeof properties.authoritativeCount !== 'number' ||
    !Number.isSafeInteger(properties.authoritativeCount) ||
    properties.authoritativeCount < 0 ||
    (properties.matchingCount !== undefined &&
      (typeof properties.matchingCount !== 'number' ||
        !Number.isSafeInteger(properties.matchingCount) ||
        properties.matchingCount < 0)) ||
    typeof properties.proposedCount !== 'number' ||
    !Number.isSafeInteger(properties.proposedCount) ||
    properties.proposedCount < 0 ||
    typeof properties.limit !== 'number' ||
    !Number.isSafeInteger(properties.limit) ||
    properties.limit < 0
  ) {
    return invalidTransition();
  }
  return Object.freeze({
    boundary: properties.boundary,
    authoritativeCount: properties.authoritativeCount,
    ...(properties.matchingCount === undefined ? {} : { matchingCount: properties.matchingCount }),
    proposedCount: properties.proposedCount,
    limit: properties.limit,
  });
}

/** Returns a safe bounded display label or no label when the callback omitted it. */
function evaluationLabel(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return invalidTransition();
  const label = sanitizeContractText(value.replace(ANSI_CONTROL_SEQUENCE, '').replace(BIDI_CONTROLS, ''), 512)
    .replace(/[\t\n]+/gu, ' ')
    .trim();
  return label.length === 0 ? invalidTransition() : label;
}

/** Validates and freezes one application transition evaluation. */
function evaluation(value: unknown): KanbanWorkflowEvaluation {
  const properties = snapshotKanbanDataProperties(value, EVALUATION_KEYS.size);
  validateKanbanDataKeys(properties, EVALUATION_KEYS);
  if (properties.kind === 'allowed') {
    if (properties.code !== undefined || properties.label !== undefined || properties.retryable !== undefined) {
      return invalidTransition();
    }
    return Object.freeze({
      kind: 'allowed',
      ...(properties.violation === undefined ? {} : { violation: violation(properties.violation) }),
    });
  }
  if (properties.kind === 'warning' || properties.kind === 'blocked') {
    if (
      typeof properties.code !== 'string' ||
      !REASON_CODE.test(properties.code) ||
      properties.violation !== undefined ||
      properties.retryable !== undefined
    ) {
      return invalidTransition();
    }
    const label = evaluationLabel(properties.label);
    return Object.freeze({
      kind: properties.kind,
      code: properties.code,
      ...(label === undefined ? {} : { label }),
    });
  }
  if (
    properties.kind !== 'unavailable' ||
    typeof properties.code !== 'string' ||
    !REASON_CODE.test(properties.code) ||
    typeof properties.retryable !== 'boolean' ||
    properties.violation !== undefined ||
    properties.label !== undefined
  ) {
    return invalidTransition();
  }
  return Object.freeze({ kind: 'unavailable', code: properties.code, retryable: properties.retryable });
}

/** Emits one already-redacted resolver-failure observation without trusting the sink. */
function observeResolverFailure(observe: KanbanTransitionObservationSink | undefined): void {
  if (observe === undefined) return;
  try {
    observe(createKanbanObservation({ code: 'transition-resolver-failed', scope: 'request' }));
  } catch {
    // Diagnostics must never change transition advice or expose a caught application error.
  }
}

/**
 * Mirrors synchronous application transition advice without dispatching or assuming move direction.
 *
 * Resolver failures fail closed as unavailable advice and emit only payload-free diagnostic metadata.
 *
 * @example
 * ```ts
 * const result = evaluateKanbanTransition(context, () => ({ kind: 'allowed' }));
 * ```
 */
export function evaluateKanbanTransition(
  context: KanbanTransitionContext,
  resolver: KanbanTransitionResolver,
  observe?: KanbanTransitionObservationSink,
): KanbanWorkflowEvaluation {
  const snapshot = transitionContext(context);
  try {
    return evaluation(resolver(snapshot));
  } catch {
    observeResolverFailure(observe);
    return Object.freeze({ kind: 'unavailable', code: 'transition-resolver-failed', retryable: false });
  }
}
