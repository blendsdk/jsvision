import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import type { KanbanDataProperties } from '../contract/data-snapshot.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanCardKey, createKanbanColumnId, createKanbanSwimlaneId } from '../contract/identity.js';
import type { CardKey, KanbanColumnId, KanbanSwimlaneId, PlacementToken } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanCardMoveProposal } from '../contract/request.js';
import { snapshotKanbanRequestExpectedRevisions } from '../contract/request-validation.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import { canonicalizeKanbanCellAddress } from '../source/address.js';
import { snapshotKanbanPlacementTokens } from '../source/placement.js';
import { snapshotKanbanCardMoveProposal, evaluateKanbanMovePositionCurrency } from './placement.js';

/** Pure synchronous result shared by pointer, keyboard, programmatic, menu, and dialog producers. */
export type KanbanEligibility =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'warning'; readonly code: string; readonly params?: KanbanSemanticValue }
  | { readonly kind: 'blocked'; readonly code: string; readonly params?: KanbanSemanticValue }
  | { readonly kind: 'unavailable'; readonly code: string; readonly params?: KanbanSemanticValue };

/** Current revision of one structural column used by move eligibility. */
export interface KanbanCurrentColumn {
  readonly columnId: KanbanColumnId;
  readonly revision: KanbanRevision;
}

/** Current revision of one structural swimlane used by move eligibility. */
export interface KanbanCurrentSwimlane {
  readonly swimlaneId: KanbanSwimlaneId;
  readonly revision: KanbanRevision;
}

/** Current revision of one card used by move eligibility. */
export interface KanbanCurrentCard {
  readonly cardKey: CardKey;
  readonly revision: KanbanRevision;
}

/** Complete current semantic authority required before workflow policy is evaluated. */
export interface KanbanMoveCurrentAuthority {
  readonly boardRevision?: KanbanRevision;
  readonly sourceRevision: KanbanRevision;
  readonly queryRevision: KanbanRevision;
  readonly viewRevision?: KanbanRevision;
  readonly columns: readonly KanbanCurrentColumn[];
  readonly swimlanes: readonly KanbanCurrentSwimlane[];
  readonly cards: readonly KanbanCurrentCard[];
  readonly targetCursorRevision: KanbanRevision;
  readonly targetEdges: Readonly<{ readonly start: 'complete' | 'unknown'; readonly end: 'complete' | 'unknown' }>;
  readonly targetCardKeys: readonly CardKey[];
  readonly placementTokens: readonly PlacementToken[];
}

/** Presentation-only capability state for one proposed move. */
export interface KanbanMoveCapability {
  readonly state: 'allowed' | 'disabled' | 'hidden';
  readonly reasonCode?: string;
}

/** Bounded loaded selection represented by one atomic move proposal. */
export interface KanbanLoadedMoveSelection {
  readonly kind: 'loaded';
  readonly orderedCardKeys: readonly CardKey[];
  readonly maximum: number;
}

/** Server-side selection that cannot be expanded into an ordered atomic move locally. */
export interface KanbanServerMoveSelection {
  readonly kind: 'server';
}

/** Selection authority accepted by the synchronous move pipeline. */
export type KanbanMoveSelection = KanbanLoadedMoveSelection | KanbanServerMoveSelection;

/** Complete input contract for the pure move-eligibility pipeline. */
export interface EvaluateKanbanMoveEligibilityInput {
  readonly proposal: KanbanCardMoveProposal;
  readonly current: KanbanMoveCurrentAuthority;
  readonly expected: unknown;
  readonly capability: KanbanMoveCapability;
  readonly selection: KanbanMoveSelection;
  readonly ordering: unknown;
  readonly transition: unknown;
  readonly definitionOfDone: unknown;
  readonly wip: unknown;
  readonly unchanged: boolean;
}

/** Exact eligibility-input members. */
const INPUT_KEYS = new Set([
  'proposal',
  'current',
  'expected',
  'capability',
  'selection',
  'ordering',
  'transition',
  'definitionOfDone',
  'wip',
  'unchanged',
]);
/** Exact current-authority members. */
const CURRENT_KEYS = new Set([
  'boardRevision',
  'sourceRevision',
  'queryRevision',
  'viewRevision',
  'columns',
  'swimlanes',
  'cards',
  'targetCursorRevision',
  'targetEdges',
  'targetCardKeys',
  'placementTokens',
]);
/** Exact structural revision entry members. */
const COLUMN_KEYS = new Set(['columnId', 'revision']);
const SWIMLANE_KEYS = new Set(['swimlaneId', 'revision']);
const CARD_KEYS = new Set(['cardKey', 'revision']);
/** Exact capability and selection members. */
const CAPABILITY_KEYS = new Set(['state', 'reasonCode']);
const SELECTION_KEYS = new Set(['kind', 'orderedCardKeys', 'maximum']);
/** Exact edge-evidence members. */
const EDGE_KEYS = new Set(['start', 'end']);
/** Exact ordering-policy members. */
const ORDERING_KEYS = new Set(['sorted', 'filtered', 'filteredPlacement']);
/** Exact workflow-advice members. */
const ADVICE_KEYS = new Set(['kind', 'code', 'params']);
/** Machine-readable reason-code grammar. */
const REASON_CODE = /^[a-z][a-z0-9-]*$/u;
/** Shared immutable allowed result. */
const ALLOWED: KanbanEligibility = Object.freeze({ kind: 'allowed' });

/** Reject malformed eligibility input without retaining application values. */
function invalidEligibility(): never {
  throw new KanbanInvalidSemanticValueError();
}

/** Validate one equality-only revision for eligibility use. */
function revision(value: unknown): KanbanRevision {
  try {
    return snapshotKanbanRevision(value);
  } catch {
    return invalidEligibility();
  }
}

/** Validate one card identity without coercion. */
function cardKey(value: unknown): CardKey {
  if (typeof value !== 'string' && typeof value !== 'number') return invalidEligibility();
  try {
    return createKanbanCardKey(value);
  } catch {
    return invalidEligibility();
  }
}

/** Create a collision-safe key that preserves numeric and string card identity. */
function cardIdentity(value: CardKey): string {
  return typeof value === 'number' ? `n:${value}` : `s:${value.length}:${value}`;
}

/** Read and validate one required string member. */
function requiredString(properties: KanbanDataProperties, key: string): string {
  const value = properties[key];
  if (typeof value !== 'string') return invalidEligibility();
  return value;
}

/** Snapshot a bounded unique array through one entry validator. */
function uniqueEntries<T>(
  value: unknown,
  snapshot: (entry: unknown) => T,
  identity: (entry: T) => string,
): readonly T[] {
  const entries = snapshotKanbanDataArray(value, KANBAN_LIMITS.selectedKeys.safe).map(snapshot);
  const identities = entries.map(identity);
  if (new Set(identities).size !== identities.length) return invalidEligibility();
  return Object.freeze(entries);
}

/** Snapshot one current column revision. */
function currentColumn(value: unknown): KanbanCurrentColumn {
  const properties = snapshotKanbanDataProperties(value, COLUMN_KEYS.size);
  validateKanbanDataKeys(properties, COLUMN_KEYS);
  try {
    return Object.freeze({
      columnId: createKanbanColumnId(requiredString(properties, 'columnId')),
      revision: revision(properties.revision),
    });
  } catch {
    return invalidEligibility();
  }
}

/** Snapshot one current swimlane revision. */
function currentSwimlane(value: unknown): KanbanCurrentSwimlane {
  const properties = snapshotKanbanDataProperties(value, SWIMLANE_KEYS.size);
  validateKanbanDataKeys(properties, SWIMLANE_KEYS);
  try {
    return Object.freeze({
      swimlaneId: createKanbanSwimlaneId(requiredString(properties, 'swimlaneId')),
      revision: revision(properties.revision),
    });
  } catch {
    return invalidEligibility();
  }
}

/** Snapshot one current card revision. */
function currentCard(value: unknown): KanbanCurrentCard {
  const properties = snapshotKanbanDataProperties(value, CARD_KEYS.size);
  validateKanbanDataKeys(properties, CARD_KEYS);
  return Object.freeze({ cardKey: cardKey(properties.cardKey), revision: revision(properties.revision) });
}

/** Snapshot the current authority needed by structural and revision stages. */
function currentAuthority(value: unknown): KanbanMoveCurrentAuthority {
  const properties = snapshotKanbanDataProperties(value, CURRENT_KEYS.size);
  validateKanbanDataKeys(properties, CURRENT_KEYS);
  const edgeProperties = snapshotKanbanDataProperties(properties.targetEdges, EDGE_KEYS.size);
  validateKanbanDataKeys(edgeProperties, EDGE_KEYS);
  if (
    (edgeProperties.start !== 'complete' && edgeProperties.start !== 'unknown') ||
    (edgeProperties.end !== 'complete' && edgeProperties.end !== 'unknown')
  ) {
    return invalidEligibility();
  }
  const boardRevision = properties.boardRevision === undefined ? undefined : revision(properties.boardRevision);
  const viewRevision = properties.viewRevision === undefined ? undefined : revision(properties.viewRevision);
  return Object.freeze({
    ...(boardRevision === undefined ? {} : { boardRevision }),
    sourceRevision: revision(properties.sourceRevision),
    queryRevision: revision(properties.queryRevision),
    ...(viewRevision === undefined ? {} : { viewRevision }),
    columns: uniqueEntries(properties.columns, currentColumn, ({ columnId }) => columnId),
    swimlanes: uniqueEntries(properties.swimlanes, currentSwimlane, ({ swimlaneId }) => swimlaneId),
    cards: uniqueEntries(properties.cards, currentCard, ({ cardKey: key }) => cardIdentity(key)),
    targetCursorRevision: revision(properties.targetCursorRevision),
    targetEdges: Object.freeze({ start: edgeProperties.start, end: edgeProperties.end }),
    targetCardKeys: uniqueEntries(properties.targetCardKeys, cardKey, cardIdentity),
    placementTokens: snapshotKanbanPlacementTokens(properties.placementTokens),
  });
}

/** Return the first structural absence before consulting revision or policy state. */
function structuralStage(proposal: KanbanCardMoveProposal, current: KanbanMoveCurrentAuthority): KanbanEligibility {
  const columns = new Set(current.columns.map(({ columnId }) => columnId));
  const swimlanes = new Set(current.swimlanes.map(({ swimlaneId }) => swimlaneId));
  const cards = new Set(current.cards.map(({ cardKey: key }) => cardIdentity(key)));
  const addresses = [...proposal.moved.map(({ source }) => source), proposal.target];
  for (const address of addresses) {
    if (!columns.has(address.columnId)) return Object.freeze({ kind: 'unavailable', code: 'column-not-found' });
    if (address.swimlaneId !== undefined && !swimlanes.has(address.swimlaneId)) {
      return Object.freeze({ kind: 'unavailable', code: 'swimlane-not-found' });
    }
  }
  for (const moved of proposal.moved) {
    if (!cards.has(cardIdentity(moved.cardKey))) return Object.freeze({ kind: 'unavailable', code: 'card-not-found' });
  }
  return ALLOWED;
}

/** Compare captured authority with the current structural, card, and cursor revisions. */
function revisionStage(
  proposal: KanbanCardMoveProposal,
  current: KanbanMoveCurrentAuthority,
  expectedValue: unknown,
): KanbanEligibility {
  const expected = snapshotKanbanRequestExpectedRevisions(expectedValue);
  for (const key of ['board', 'source', 'query'] as const) {
    const captured = expected[key];
    const live = current[`${key}Revision`];
    if (captured !== undefined && captured !== live) {
      return Object.freeze({ kind: 'unavailable', code: `stale-${key}-revision` });
    }
  }
  if (proposal.viewRevision !== undefined && proposal.viewRevision !== current.viewRevision) {
    return Object.freeze({ kind: 'unavailable', code: 'stale-view-revision' });
  }
  const columns = new Map(current.columns.map((column) => [column.columnId, column.revision]));
  const cards = new Map(current.cards.map((card) => [cardIdentity(card.cardKey), card.revision]));
  for (const moved of proposal.moved) {
    if (columns.get(moved.source.columnId) !== moved.sourceRevision) {
      return Object.freeze({ kind: 'unavailable', code: 'stale-source-placement' });
    }
    if (cards.get(cardIdentity(moved.cardKey)) !== moved.entityRevision) {
      return Object.freeze({ kind: 'unavailable', code: 'stale-card-revision' });
    }
  }
  const currency = evaluateKanbanMovePositionCurrency(proposal.position, {
    cursorRevision: current.targetCursorRevision,
    edges: current.targetEdges,
    cardKeys: current.targetCardKeys,
    placementTokens: current.placementTokens,
  });
  return currency.kind === 'current' ? ALLOWED : Object.freeze({ kind: 'unavailable', code: currency.code });
}

/** Snapshot and evaluate the presentation-only capability stage. */
function capabilityStage(value: unknown): KanbanEligibility {
  const properties = snapshotKanbanDataProperties(value, CAPABILITY_KEYS.size);
  validateKanbanDataKeys(properties, CAPABILITY_KEYS);
  if (properties.state === 'allowed') return ALLOWED;
  if (properties.state !== 'disabled' && properties.state !== 'hidden') return invalidEligibility();
  const reasonCode = properties.reasonCode;
  if (reasonCode !== undefined && (typeof reasonCode !== 'string' || !REASON_CODE.test(reasonCode))) {
    return invalidEligibility();
  }
  return Object.freeze({ kind: 'blocked', code: reasonCode ?? 'move-capability-disabled' });
}

/** Snapshot and evaluate atomic selection representability and ordering. */
function selectionStage(value: unknown, proposal: KanbanCardMoveProposal): KanbanEligibility {
  const properties = snapshotKanbanDataProperties(value, SELECTION_KEYS.size);
  validateKanbanDataKeys(properties, SELECTION_KEYS);
  if (properties.kind === 'server') return Object.freeze({ kind: 'unavailable', code: 'selection-unrepresentable' });
  if (
    properties.kind !== 'loaded' ||
    typeof properties.maximum !== 'number' ||
    !Number.isSafeInteger(properties.maximum) ||
    properties.maximum < 1 ||
    properties.maximum > KANBAN_LIMITS.selectedKeys.absolute
  ) {
    return invalidEligibility();
  }
  const keys = uniqueEntries(properties.orderedCardKeys, cardKey, cardIdentity);
  if (keys.length > properties.maximum || keys.length !== proposal.moved.length) {
    return Object.freeze({ kind: 'blocked', code: 'selection-limit-exceeded' });
  }
  if (keys.some((key, index) => key !== proposal.moved[index]!.cardKey)) {
    return Object.freeze({ kind: 'blocked', code: 'selection-mismatch' });
  }
  return ALLOWED;
}

/** Whether every moved card originates in the proposed target cell. */
function isWithinOneCell(proposal: KanbanCardMoveProposal): boolean {
  const target = canonicalizeKanbanCellAddress(proposal.target);
  return proposal.moved.every(({ source }) => canonicalizeKanbanCellAddress(source) === target);
}

/** Evaluate whether the active sort/filter projection can represent manual placement safely. */
function orderingStage(value: unknown, proposal: KanbanCardMoveProposal): KanbanEligibility {
  const properties = snapshotKanbanDataProperties(value, ORDERING_KEYS.size);
  validateKanbanDataKeys(properties, ORDERING_KEYS);
  if (typeof properties.sorted !== 'boolean' || typeof properties.filtered !== 'boolean') {
    return invalidEligibility();
  }
  const filteredPlacement = properties.filteredPlacement;
  if (filteredPlacement !== 'not-required' && filteredPlacement !== 'resolved' && filteredPlacement !== 'unavailable') {
    return invalidEligibility();
  }
  if (!isWithinOneCell(proposal)) return ALLOWED;
  if (properties.sorted) return Object.freeze({ kind: 'blocked', code: 'sorted-manual-order' });
  if (properties.filtered && filteredPlacement !== 'resolved') {
    return Object.freeze({ kind: 'unavailable', code: 'filtered-placement-unavailable' });
  }
  return ALLOWED;
}

/** Snapshot one precomputed result from a pure transition, DoD, or WIP policy evaluator. */
function workflowAdvice(value: unknown): KanbanEligibility {
  const properties = snapshotKanbanDataProperties(value, ADVICE_KEYS.size);
  validateKanbanDataKeys(properties, ADVICE_KEYS);
  if (properties.kind === 'allowed') {
    if (Object.keys(properties).length !== 1) return invalidEligibility();
    return ALLOWED;
  }
  if (properties.kind !== 'warning' && properties.kind !== 'blocked' && properties.kind !== 'unavailable') {
    return invalidEligibility();
  }
  if (typeof properties.code !== 'string' || !REASON_CODE.test(properties.code)) return invalidEligibility();
  const params = properties.params === undefined ? undefined : snapshotKanbanSemanticValue(properties.params);
  return Object.freeze({
    kind: properties.kind,
    code: properties.code,
    ...(params === undefined ? {} : { params }),
  });
}

/** Preserve transition-before-definition ordering within the workflow-policy stage. */
function transitionStage(transition: unknown, definitionOfDone: unknown): KanbanEligibility {
  const transitionResult = workflowAdvice(transition);
  return transitionResult.kind === 'allowed' ? workflowAdvice(definitionOfDone) : transitionResult;
}

/** Return the configured no-op policy only after every earlier policy stage allows dispatch. */
function unchangedStage(value: unknown): KanbanEligibility {
  if (typeof value !== 'boolean') return invalidEligibility();
  return value ? Object.freeze({ kind: 'blocked', code: 'unchanged-placement' }) : ALLOWED;
}

/**
 * Evaluate immutable move facts in fixed fail-closed order without dispatching or authorizing.
 *
 * Later workflow stages are composed after structural, revision, capability, and selection facts so
 * stale or unrepresentable requests cannot be presented as policy warnings.
 *
 * @example
 * ```ts
 * const eligibility = evaluateKanbanMoveEligibility(currentMoveFacts);
 * if (eligibility.kind === 'allowed') submitMove();
 * ```
 */
export function evaluateKanbanMoveEligibility(input: unknown): KanbanEligibility {
  const properties = snapshotKanbanDataProperties(input, INPUT_KEYS.size);
  validateKanbanDataKeys(properties, INPUT_KEYS);
  const proposal = snapshotKanbanCardMoveProposal(properties.proposal);
  const current = currentAuthority(properties.current);
  const structure = structuralStage(proposal, current);
  if (structure.kind !== 'allowed') return structure;
  const revisions = revisionStage(proposal, current, properties.expected);
  if (revisions.kind !== 'allowed') return revisions;
  const capability = capabilityStage(properties.capability);
  if (capability.kind !== 'allowed') return capability;
  const selection = selectionStage(properties.selection, proposal);
  if (selection.kind !== 'allowed') return selection;
  const ordering = orderingStage(properties.ordering, proposal);
  if (ordering.kind !== 'allowed') return ordering;
  const transition = transitionStage(properties.transition, properties.definitionOfDone);
  if (transition.kind !== 'allowed') return transition;
  const wip = workflowAdvice(properties.wip);
  if (wip.kind !== 'allowed') return wip;
  return unchangedStage(properties.unchanged);
}
