import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanCardKey, createPlacementToken } from '../contract/identity.js';
import type { CardKey, PlacementToken } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanCardMoveProposal, KanbanMovePosition, KanbanMovedCardSnapshot } from '../contract/request.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { snapshotKanbanCellAddress } from '../source/address.js';
import { isKanbanPlacementTokenCurrent, snapshotKanbanPlacementTokens } from '../source/placement.js';

/** Exact members accepted across all semantic move-position variants. */
const POSITION_KEYS = new Set([
  'kind',
  'cursorRevision',
  'beforeCardKey',
  'afterCardKey',
  'edge',
  'neighborCardKey',
  'token',
]);
/** Exact start/end position members. */
const EDGE_POSITION_KEYS = new Set(['kind', 'cursorRevision']);
/** Exact between-anchor position members. */
const BETWEEN_POSITION_KEYS = new Set(['kind', 'beforeCardKey', 'afterCardKey', 'cursorRevision']);
/** Exact window-edge position members. */
const WINDOW_POSITION_KEYS = new Set(['kind', 'edge', 'neighborCardKey', 'token', 'cursorRevision']);
/** Exact members accepted for current placement evidence. */
const EVIDENCE_KEYS = new Set(['cursorRevision', 'edges', 'cardKeys', 'placementTokens']);
/** Exact members accepted for logical edge-completeness evidence. */
const EVIDENCE_EDGE_KEYS = new Set(['start', 'end']);
/** Exact moved-card snapshot members. */
const MOVED_CARD_KEYS = new Set(['cardKey', 'source', 'sourcePlacement', 'sourceRevision', 'entityRevision']);
/** Exact card-move proposal members. */
const MOVE_PROPOSAL_KEYS = new Set(['kind', 'moved', 'target', 'position', 'viewRevision']);

/** Evidence proving that one semantic target position still belongs to the current cursor. */
export interface KanbanMovePositionEvidence {
  /** Current equality-only target cursor revision. */
  readonly cursorRevision: KanbanRevision;
  /** Whether the source has proven each logical edge complete. */
  readonly edges: Readonly<{ readonly start: 'complete' | 'unknown'; readonly end: 'complete' | 'unknown' }>;
  /** Stable card identities currently available as target anchors. */
  readonly cardKeys: readonly CardKey[];
  /** Opaque source-issued tokens that are current for this cursor revision. */
  readonly placementTokens: readonly PlacementToken[];
}

/** Pure result of checking semantic placement against current source evidence. */
export type KanbanMovePositionCurrency =
  { readonly kind: 'current' } | { readonly kind: 'unavailable'; readonly code: string };

/** Validate and detach bounded source-owned evidence before placement evaluation. */
export function snapshotKanbanMovePositionEvidence(value: unknown): KanbanMovePositionEvidence {
  try {
    const properties = snapshotKanbanDataProperties(value, EVIDENCE_KEYS.size);
    validateKanbanDataKeys(properties, EVIDENCE_KEYS);
    const edgeProperties = snapshotKanbanDataProperties(properties.edges, EVIDENCE_EDGE_KEYS.size);
    validateKanbanDataKeys(edgeProperties, EVIDENCE_EDGE_KEYS);
    if (
      Object.keys(edgeProperties).length !== EVIDENCE_EDGE_KEYS.size ||
      (edgeProperties.start !== 'complete' && edgeProperties.start !== 'unknown') ||
      (edgeProperties.end !== 'complete' && edgeProperties.end !== 'unknown')
    ) {
      return invalidMove();
    }
    const cardKeys = snapshotKanbanDataArray(properties.cardKeys, KANBAN_LIMITS.selectedKeys.safe).map(cardKey);
    const identities = cardKeys.map((key) => (typeof key === 'number' ? `n:${key}` : `s:${key.length}:${key}`));
    if (new Set(identities).size !== identities.length) return invalidMove();
    return Object.freeze({
      cursorRevision: revision(properties.cursorRevision),
      edges: Object.freeze({ start: edgeProperties.start, end: edgeProperties.end }),
      cardKeys: Object.freeze(cardKeys),
      placementTokens: snapshotKanbanPlacementTokens(properties.placementTokens),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    return invalidMove();
  }
}

/** Convert every invalid move value to one payload-free contract error. */
function invalidMove(): never {
  throw new KanbanInvalidSemanticValueError();
}

/** Validate one equality-only revision for request use. */
function revision(value: unknown): KanbanRevision {
  try {
    return snapshotKanbanRevision(value);
  } catch {
    return invalidMove();
  }
}

/** Validate one stable card identity without coercion. */
function cardKey(value: unknown): CardKey {
  if (typeof value !== 'string' && typeof value !== 'number') return invalidMove();
  try {
    return createKanbanCardKey(value);
  } catch {
    return invalidMove();
  }
}

/** Validate, detach, and freeze one dispatchable semantic move position. */
export function snapshotKanbanMovePosition(value: unknown): KanbanMovePosition {
  const properties = snapshotKanbanDataProperties(value, POSITION_KEYS.size);
  validateKanbanDataKeys(properties, POSITION_KEYS);
  const cursorRevision = revision(properties.cursorRevision);
  if (properties.kind === 'start' || properties.kind === 'end') {
    validateKanbanDataKeys(properties, EDGE_POSITION_KEYS);
    if (Object.keys(properties).length !== EDGE_POSITION_KEYS.size) return invalidMove();
    return Object.freeze({ kind: properties.kind, cursorRevision });
  }
  if (properties.kind === 'between') {
    validateKanbanDataKeys(properties, BETWEEN_POSITION_KEYS);
    if (Object.keys(properties).length !== BETWEEN_POSITION_KEYS.size) return invalidMove();
    const beforeCardKey = properties.beforeCardKey === null ? null : cardKey(properties.beforeCardKey);
    const afterCardKey = properties.afterCardKey === null ? null : cardKey(properties.afterCardKey);
    if (
      (beforeCardKey === null && afterCardKey === null) ||
      (beforeCardKey !== null && afterCardKey !== null && beforeCardKey === afterCardKey)
    ) {
      return invalidMove();
    }
    return Object.freeze({ kind: 'between', beforeCardKey, afterCardKey, cursorRevision });
  }
  if (properties.kind !== 'window-edge' || (properties.edge !== 'before' && properties.edge !== 'after')) {
    return invalidMove();
  }
  validateKanbanDataKeys(properties, WINDOW_POSITION_KEYS);
  if (Object.keys(properties).length !== WINDOW_POSITION_KEYS.size || typeof properties.token !== 'string') {
    return invalidMove();
  }
  try {
    return Object.freeze({
      kind: 'window-edge',
      edge: properties.edge,
      neighborCardKey: cardKey(properties.neighborCardKey),
      token: createPlacementToken(properties.token),
      cursorRevision,
    });
  } catch {
    return invalidMove();
  }
}

/** Validate, detach, and freeze source evidence for one moved card. */
export function snapshotKanbanMovedCard(value: unknown): KanbanMovedCardSnapshot {
  const properties = snapshotKanbanDataProperties(value, MOVED_CARD_KEYS.size);
  validateKanbanDataKeys(properties, MOVED_CARD_KEYS);
  if (Object.keys(properties).length !== MOVED_CARD_KEYS.size) return invalidMove();
  return Object.freeze({
    cardKey: cardKey(properties.cardKey),
    source: snapshotKanbanCellAddress(properties.source),
    sourcePlacement: snapshotKanbanMovePosition(properties.sourcePlacement),
    sourceRevision: revision(properties.sourceRevision),
    entityRevision: revision(properties.entityRevision),
  });
}

/** Validate, detach, and freeze one ordered atomic card-move proposal. */
export function snapshotKanbanCardMoveProposal(value: unknown): KanbanCardMoveProposal {
  const properties = snapshotKanbanDataProperties(value, MOVE_PROPOSAL_KEYS.size);
  validateKanbanDataKeys(properties, MOVE_PROPOSAL_KEYS);
  if (properties.kind !== 'card-move') return invalidMove();
  const moved = snapshotKanbanDataArray(properties.moved, KANBAN_LIMITS.selectedKeys.safe).map(snapshotKanbanMovedCard);
  if (moved.length === 0) return invalidMove();
  const identities = moved.map(({ cardKey: key }) => (typeof key === 'number' ? `n:${key}` : `s:${key.length}:${key}`));
  if (new Set(identities).size !== identities.length) return invalidMove();
  const viewRevision = properties.viewRevision === undefined ? undefined : revision(properties.viewRevision);
  return Object.freeze({
    kind: 'card-move',
    moved: Object.freeze(moved),
    target: snapshotKanbanCellAddress(properties.target),
    position: snapshotKanbanMovePosition(properties.position),
    ...(viewRevision === undefined ? {} : { viewRevision }),
  });
}

/** Check one validated semantic position against current source-owned placement evidence. */
export function evaluateKanbanMovePositionCurrency(
  position: KanbanMovePosition,
  evidence: KanbanMovePositionEvidence,
): KanbanMovePositionCurrency {
  const snapshot = snapshotKanbanMovePosition(position);
  const current = snapshotKanbanMovePositionEvidence(evidence);
  if (snapshot.cursorRevision !== current.cursorRevision) {
    return Object.freeze({ kind: 'unavailable', code: 'placement-revision-stale' });
  }
  if (snapshot.kind === 'start' || snapshot.kind === 'end') {
    return current.edges[snapshot.kind] === 'complete'
      ? Object.freeze({ kind: 'current' })
      : Object.freeze({ kind: 'unavailable', code: 'placement-edge-unknown' });
  }
  const currentKeys = new Set(current.cardKeys);
  if (snapshot.kind === 'between') {
    if (
      (snapshot.beforeCardKey !== null && !currentKeys.has(snapshot.beforeCardKey)) ||
      (snapshot.afterCardKey !== null && !currentKeys.has(snapshot.afterCardKey))
    ) {
      return Object.freeze({ kind: 'unavailable', code: 'placement-anchor-stale' });
    }
    return Object.freeze({ kind: 'current' });
  }
  if (!currentKeys.has(snapshot.neighborCardKey)) {
    return Object.freeze({ kind: 'unavailable', code: 'placement-anchor-stale' });
  }
  return isKanbanPlacementTokenCurrent(snapshot.token, current.placementTokens)
    ? Object.freeze({ kind: 'current' })
    : Object.freeze({ kind: 'unavailable', code: 'placement-token-stale' });
}
