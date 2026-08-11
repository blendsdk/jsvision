import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import type { KanbanDataProperties } from '../contract/data-snapshot.js';
import { snapshotKanbanLabel } from '../contract/capability.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanCardKey, createKanbanColumnId, createKanbanSwimlaneId } from '../contract/identity.js';
import type { CardKey, KanbanColumnId, KanbanSwimlaneId, PlacementToken } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanCardMoveProposal } from '../contract/request.js';
import {
  snapshotKanbanRequestExpectedRevisions,
  snapshotKanbanRequestProposal,
} from '../contract/request-validation.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import { canonicalizeKanbanCellAddress, snapshotKanbanCellAddress } from '../source/address.js';
import { snapshotKanbanPlacementTokens } from '../source/placement.js';
import {
  evaluateKanbanMovePositionCurrency,
  snapshotKanbanCardMoveProposal,
  snapshotKanbanMovePositionEvidence,
} from './placement.js';
import type { KanbanMovePositionEvidence } from './placement.js';

/** Pure synchronous result shared by pointer, keyboard, programmatic, menu, and dialog producers. */
export type KanbanEligibility =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'warning'; readonly code: string; readonly params?: KanbanSemanticValue }
  | { readonly kind: 'blocked'; readonly code: string; readonly params?: KanbanSemanticValue }
  | { readonly kind: 'unavailable'; readonly code: string; readonly params?: KanbanSemanticValue };

/** Current revision of one structural column used by move eligibility. */
export interface KanbanCurrentColumn {
  /** Stable workflow-column identity. */
  readonly columnId: KanbanColumnId;
  /** Current equality-only entity revision. */
  readonly revision: KanbanRevision;
}

/** Current revision of one structural swimlane used by move eligibility. */
export interface KanbanCurrentSwimlane {
  /** Stable explicit-swimlane identity. */
  readonly swimlaneId: KanbanSwimlaneId;
  /** Current equality-only entity revision. */
  readonly revision: KanbanRevision;
}

/** Current revision of one card used by move eligibility. */
export interface KanbanCurrentCard {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Current equality-only entity revision. */
  readonly revision: KanbanRevision;
}

/** Complete current semantic authority required before workflow policy is evaluated. */
export interface KanbanMoveCurrentAuthority {
  /** Current board revision when the application publishes board-wide authority. */
  readonly boardRevision?: KanbanRevision;
  /** Current source generation revision. */
  readonly sourceRevision: KanbanRevision;
  /** Current query revision. */
  readonly queryRevision: KanbanRevision;
  /** Current saved or transient view revision when one controls placement. */
  readonly viewRevision?: KanbanRevision;
  /** Bounded current workflow columns and their entity revisions. */
  readonly columns: readonly KanbanCurrentColumn[];
  /** Bounded current explicit swimlanes and their entity revisions. */
  readonly swimlanes: readonly KanbanCurrentSwimlane[];
  /** Bounded current cards relevant to this proposal and its captured expectations. */
  readonly cards: readonly KanbanCurrentCard[];
  /** Per-source-cell evidence used to revalidate every moved card's original interval. */
  readonly sourceCells: readonly KanbanMoveSourceCellEvidence[];
  /** Current destination cursor revision. */
  readonly targetCursorRevision: KanbanRevision;
  /** Current completeness of the destination's logical edges. */
  readonly targetEdges: Readonly<{ readonly start: 'complete' | 'unknown'; readonly end: 'complete' | 'unknown' }>;
  /** Current destination anchors visible to semantic placement. */
  readonly targetCardKeys: readonly CardKey[];
  /** Current source-issued opaque destination placement tokens. */
  readonly placementTokens: readonly PlacementToken[];
}

/** Current semantic placement evidence for one distinct source cell. */
export interface KanbanMoveSourceCellEvidence extends KanbanMovePositionEvidence {
  /** Stable column/swimlane address whose cursor issued this evidence. */
  readonly address: Readonly<{ readonly columnId: KanbanColumnId; readonly swimlaneId?: KanbanSwimlaneId }>;
}

/** Presentation-only capability state for one proposed move. */
export interface KanbanMoveCapability {
  /** Presentation state; this value never authorizes persistence. */
  readonly state: 'allowed' | 'disabled' | 'hidden';
  /** Optional machine-readable reason for a disabled or hidden move. */
  readonly reasonCode?: string;
}

/** Bounded loaded selection represented by one atomic move proposal. */
export interface KanbanLoadedMoveSelection {
  /** Selection discriminator. */
  readonly kind: 'loaded';
  /** Ordered stable keys represented by the atomic proposal. */
  readonly orderedCardKeys: readonly CardKey[];
  /** Caller-selected atomic ceiling, bounded by the package manifest. */
  readonly maximum: number;
}

/** Server-side selection that cannot be expanded into an ordered atomic move locally. */
export interface KanbanServerMoveSelection {
  /** Selection discriminator for a set that cannot be expanded locally. */
  readonly kind: 'server';
}

/** Selection authority accepted by the synchronous move pipeline. */
export type KanbanMoveSelection = KanbanLoadedMoveSelection | KanbanServerMoveSelection;

/** Complete input contract for the pure move-eligibility pipeline. */
export interface EvaluateKanbanMoveEligibilityInput {
  /** Exact immutable semantic move proposal. */
  readonly proposal: KanbanCardMoveProposal;
  /** Current bounded structure, revision, and placement authority. */
  readonly current: KanbanMoveCurrentAuthority;
  /** Coordinator-captured equality revisions. */
  readonly expected: unknown;
  /** Presentation-only move capability. */
  readonly capability: KanbanMoveCapability;
  /** Atomic local or unrepresentable server selection. */
  readonly selection: KanbanMoveSelection;
  /** Current sort/filter placement policy evidence. */
  readonly ordering: unknown;
  /** Output from the pure transition evaluator. */
  readonly transition: unknown;
  /** Output from the definition-of-done policy. */
  readonly definitionOfDone: unknown;
  /** Output from the pure WIP evaluator. */
  readonly wip: unknown;
  /** Whether the proposal returns cards to the unchanged semantic interval. */
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
  'sourceCells',
  'targetCursorRevision',
  'targetEdges',
  'targetCardKeys',
  'placementTokens',
]);
/** Exact structural revision entry members. */
const COLUMN_KEYS = new Set(['columnId', 'revision']);
const SWIMLANE_KEYS = new Set(['swimlaneId', 'revision']);
const CARD_KEYS = new Set(['cardKey', 'revision']);
/** Exact source-cell evidence members. */
const SOURCE_CELL_KEYS = new Set(['address', 'cursorRevision', 'edges', 'cardKeys', 'placementTokens']);
/** Exact capability and selection members. */
const CAPABILITY_KEYS = new Set(['state', 'reasonCode']);
const SELECTION_KEYS = new Set(['kind', 'orderedCardKeys', 'maximum']);
const CAPABILITY_ALLOWED_KEYS = new Set(['state']);
const CAPABILITY_RESTRICTED_KEYS = new Set(['state', 'reasonCode']);
const SELECTION_SERVER_KEYS = new Set(['kind']);
const SELECTION_LOADED_KEYS = new Set(['kind', 'orderedCardKeys', 'maximum']);
/** Exact edge-evidence members. */
const EDGE_KEYS = new Set(['start', 'end']);
/** Exact ordering-policy members. */
const ORDERING_KEYS = new Set(['sorted', 'filtered', 'filteredPlacement']);
/** Exact workflow-advice members. */
const ADVICE_KEYS = new Set(['kind', 'code', 'params', 'label', 'retryable', 'violation']);
const ADVICE_ALLOWED_KEYS = new Set(['kind', 'violation']);
const ADVICE_CUSTOM_KEYS = new Set(['kind', 'code', 'params']);
const ADVICE_LABEL_KEYS = new Set(['kind', 'code', 'label']);
const ADVICE_UNAVAILABLE_KEYS = new Set(['kind', 'code', 'retryable']);
const VIOLATION_KEYS = new Set(['boundary', 'authoritativeCount', 'matchingCount', 'proposedCount', 'limit']);
/** Machine-readable reason-code grammar. */
const REASON_CODE = /^[a-z][a-z0-9-]*$/u;
/** Shared immutable allowed result. */
const ALLOWED: KanbanEligibility = Object.freeze({ kind: 'allowed' });
/** Standard proposals that always require application confirmation before dispatch. */
const DESTRUCTIVE_REQUEST_KINDS = new Set([
  'card-archive',
  'card-delete',
  'column-delete',
  'swimlane-delete',
  'saved-view-delete',
]);

/** Pure coordinator input describing whether a currently eligible proposal needs confirmation. */
export type KanbanConfirmationClassification =
  | Extract<KanbanEligibility, { readonly kind: 'warning' }>
  | { readonly kind: 'destructive' }
  | { readonly kind: 'not-required' };

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
  maximum: number,
  snapshot: (entry: unknown) => T,
  identity: (entry: T) => string,
): readonly T[] {
  const entries = snapshotKanbanDataArray(value, maximum).map(snapshot);
  const identities = entries.map(identity);
  if (new Set(identities).size !== identities.length) return invalidEligibility();
  return Object.freeze(entries);
}

/** Snapshot one distinct source cell and its bounded placement evidence. */
function sourceCell(value: unknown): KanbanMoveSourceCellEvidence {
  const properties = snapshotKanbanDataProperties(value, SOURCE_CELL_KEYS.size);
  validateKanbanDataKeys(properties, SOURCE_CELL_KEYS);
  const address = snapshotKanbanCellAddress(properties.address);
  const sourceCardKeys = snapshotKanbanDataArray(properties.cardKeys, KANBAN_LIMITS.ensureRangeCards.safe);
  const evidence = snapshotKanbanMovePositionEvidence({
    cursorRevision: properties.cursorRevision,
    edges: properties.edges,
    cardKeys: sourceCardKeys,
    placementTokens: properties.placementTokens,
  });
  return Object.freeze({ address, ...evidence });
}

/** Snapshot distinct source cells while enforcing one aggregate nested-evidence budget. */
function sourceCells(value: unknown): readonly KanbanMoveSourceCellEvidence[] {
  const inputs = snapshotKanbanDataArray(value, KANBAN_LIMITS.retainedCursors.safe);
  const cells: KanbanMoveSourceCellEvidence[] = [];
  const identities = new Set<string>();
  let nestedEntries = 0;
  for (const input of inputs) {
    const cell = sourceCell(input);
    nestedEntries += cell.cardKeys.length + cell.placementTokens.length;
    if (nestedEntries > KANBAN_LIMITS.selectedKeys.safe) return invalidEligibility();
    const identity = canonicalizeKanbanCellAddress(cell.address);
    if (identities.has(identity)) return invalidEligibility();
    identities.add(identity);
    cells.push(cell);
  }
  return Object.freeze(cells);
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
    columns: uniqueEntries(properties.columns, KANBAN_LIMITS.columns.safe, currentColumn, ({ columnId }) => columnId),
    swimlanes: uniqueEntries(
      properties.swimlanes,
      KANBAN_LIMITS.swimlanes.safe,
      currentSwimlane,
      ({ swimlaneId }) => swimlaneId,
    ),
    cards: uniqueEntries(properties.cards, KANBAN_LIMITS.selectedKeys.safe, currentCard, ({ cardKey: key }) =>
      cardIdentity(key),
    ),
    sourceCells: sourceCells(properties.sourceCells),
    targetCursorRevision: revision(properties.targetCursorRevision),
    targetEdges: Object.freeze({ start: edgeProperties.start, end: edgeProperties.end }),
    targetCardKeys: uniqueEntries(properties.targetCardKeys, KANBAN_LIMITS.selectedKeys.safe, cardKey, cardIdentity),
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
  const swimlanes = new Map(current.swimlanes.map((swimlane) => [swimlane.swimlaneId, swimlane.revision]));
  const cards = new Map(current.cards.map((card) => [cardIdentity(card.cardKey), card.revision]));
  for (const entity of expected.entities ?? []) {
    const live =
      entity.kind === 'card'
        ? cards.get(cardIdentity(entity.cardKey))
        : entity.kind === 'column'
          ? columns.get(entity.columnId)
          : swimlanes.get(entity.swimlaneId);
    if (live === undefined) return Object.freeze({ kind: 'unavailable', code: `${entity.kind}-not-found` });
    if (live !== entity.revision) {
      return Object.freeze({ kind: 'unavailable', code: `stale-${entity.kind}-revision` });
    }
  }
  const sourceCells = new Map(
    current.sourceCells.map((cell) => [canonicalizeKanbanCellAddress(cell.address), cell] as const),
  );
  for (const moved of proposal.moved) {
    const source = sourceCells.get(canonicalizeKanbanCellAddress(moved.source));
    if (source === undefined) return Object.freeze({ kind: 'unavailable', code: 'source-placement-unavailable' });
    if (source.cursorRevision !== moved.sourceRevision) {
      return Object.freeze({ kind: 'unavailable', code: 'stale-source-placement' });
    }
    if (cards.get(cardIdentity(moved.cardKey)) !== moved.entityRevision) {
      return Object.freeze({ kind: 'unavailable', code: 'stale-card-revision' });
    }
    const sourceCurrency = evaluateKanbanMovePositionCurrency(moved.sourcePlacement, {
      cursorRevision: source.cursorRevision,
      edges: source.edges,
      cardKeys: source.cardKeys,
      placementTokens: source.placementTokens,
    });
    if (sourceCurrency.kind !== 'current') {
      return Object.freeze({ kind: 'unavailable', code: `source-${sourceCurrency.code}` });
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
  if (properties.state === 'allowed') {
    validateKanbanDataKeys(properties, CAPABILITY_ALLOWED_KEYS);
    if (Object.keys(properties).length !== CAPABILITY_ALLOWED_KEYS.size) return invalidEligibility();
    return ALLOWED;
  }
  if (properties.state !== 'disabled' && properties.state !== 'hidden') return invalidEligibility();
  validateKanbanDataKeys(properties, CAPABILITY_RESTRICTED_KEYS);
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
  if (properties.kind === 'server') {
    validateKanbanDataKeys(properties, SELECTION_SERVER_KEYS);
    if (Object.keys(properties).length !== SELECTION_SERVER_KEYS.size) return invalidEligibility();
    return Object.freeze({ kind: 'unavailable', code: 'selection-unrepresentable' });
  }
  validateKanbanDataKeys(properties, SELECTION_LOADED_KEYS);
  if (
    properties.kind !== 'loaded' ||
    typeof properties.maximum !== 'number' ||
    !Number.isSafeInteger(properties.maximum) ||
    properties.maximum < 1 ||
    properties.maximum > KANBAN_LIMITS.selectedKeys.absolute
  ) {
    return invalidEligibility();
  }
  const keys = uniqueEntries(properties.orderedCardKeys, KANBAN_LIMITS.selectedKeys.safe, cardKey, cardIdentity);
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

/** Snapshot exact informational WIP violation evidence before discarding non-terminal metadata. */
function workflowViolation(value: unknown): void {
  const properties = snapshotKanbanDataProperties(value, VIOLATION_KEYS.size);
  validateKanbanDataKeys(properties, VIOLATION_KEYS);
  if (properties.boundary !== 'minimum' && properties.boundary !== 'maximum') return invalidEligibility();
  for (const key of ['authoritativeCount', 'proposedCount', 'limit'] as const) {
    const count = properties[key];
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return invalidEligibility();
  }
  const matchingCount = properties.matchingCount;
  if (
    matchingCount !== undefined &&
    (typeof matchingCount !== 'number' || !Number.isSafeInteger(matchingCount) || matchingCount < 0)
  ) {
    return invalidEligibility();
  }
}

/** Validate and detach one result from a pure transition, DoD, WIP, or custom policy evaluator. */
export function snapshotKanbanEligibility(value: unknown): KanbanEligibility {
  const properties = snapshotKanbanDataProperties(value, ADVICE_KEYS.size);
  validateKanbanDataKeys(properties, ADVICE_KEYS);
  if (properties.kind === 'allowed') {
    validateKanbanDataKeys(properties, ADVICE_ALLOWED_KEYS);
    if (properties.violation !== undefined) workflowViolation(properties.violation);
    return ALLOWED;
  }
  if (properties.kind !== 'warning' && properties.kind !== 'blocked' && properties.kind !== 'unavailable') {
    return invalidEligibility();
  }
  if (typeof properties.code !== 'string' || !REASON_CODE.test(properties.code)) return invalidEligibility();
  if (properties.violation !== undefined) return invalidEligibility();
  if (properties.params !== undefined && properties.label !== undefined) return invalidEligibility();
  if (properties.kind === 'unavailable' && Object.hasOwn(properties, 'retryable')) {
    validateKanbanDataKeys(properties, ADVICE_UNAVAILABLE_KEYS);
  } else if (Object.hasOwn(properties, 'label')) {
    if (properties.kind === 'unavailable') return invalidEligibility();
    validateKanbanDataKeys(properties, ADVICE_LABEL_KEYS);
  } else {
    validateKanbanDataKeys(properties, ADVICE_CUSTOM_KEYS);
  }
  const params = properties.params === undefined ? undefined : snapshotKanbanSemanticValue(properties.params);
  const label = properties.label === undefined ? undefined : snapshotKanbanLabel(properties.label);
  if (properties.label !== undefined && label === undefined) return invalidEligibility();
  if (properties.kind === 'unavailable') {
    if (properties.retryable !== undefined && typeof properties.retryable !== 'boolean') return invalidEligibility();
  } else if (properties.retryable !== undefined) {
    return invalidEligibility();
  }
  const mappedParams =
    params ??
    (label !== undefined
      ? Object.freeze({ label })
      : properties.retryable === undefined
        ? undefined
        : Object.freeze({ retryable: properties.retryable }));
  return Object.freeze({
    kind: properties.kind,
    code: properties.code,
    ...(mappedParams === undefined ? {} : { params: mappedParams }),
  });
}

/** Preserve transition-before-definition ordering within the workflow-policy stage. */
function transitionStage(transition: unknown, definitionOfDone: unknown): KanbanEligibility {
  const transitionResult = snapshotKanbanEligibility(transition);
  return transitionResult.kind === 'allowed' ? snapshotKanbanEligibility(definitionOfDone) : transitionResult;
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
  const wip = snapshotKanbanEligibility(properties.wip);
  if (wip.kind !== 'allowed') return wip;
  return unchangedStage(properties.unchanged);
}

/**
 * Classify warning and destructive proposals without invoking a confirmer or dispatcher.
 *
 * Blocked and unavailable proposals are not confirmation candidates because they cannot proceed to
 * dispatch. A warning retains its bounded code and parameters even when the proposal is also
 * destructive, allowing one confirmation dialog to explain the more specific policy outcome.
 */
export function classifyKanbanRequestConfirmation(
  proposal: unknown,
  eligibility: unknown,
): KanbanConfirmationClassification {
  const request = snapshotKanbanRequestProposal(proposal);
  const result = snapshotKanbanEligibility(eligibility);
  if (result.kind === 'warning') return result;
  if (result.kind !== 'allowed') return Object.freeze({ kind: 'not-required' });
  return DESTRUCTIVE_REQUEST_KINDS.has(request.kind)
    ? Object.freeze({ kind: 'destructive' })
    : Object.freeze({ kind: 'not-required' });
}
