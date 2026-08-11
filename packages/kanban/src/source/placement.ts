import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidSourcePublicationError } from '../contract/error.js';
import { createKanbanCardKey, createPlacementToken } from '../contract/identity.js';
import type { CardKey, PlacementToken } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { kanbanRevisionsEqual, snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import type { KanbanPlacement, KanbanPrefetchRange } from './types.js';

/** Exact union of all accepted placement members. */
const PLACEMENT_KEYS = new Set([
  'kind',
  'cursorRevision',
  'beforeCardKey',
  'afterCardKey',
  'edge',
  'neighborCardKey',
  'token',
  'code',
  'label',
  'prefetch',
]);
/** Exact members of a half-open placement prefetch range. */
const PREFETCH_KEYS = new Set(['start', 'end']);
/** Safe machine-readable placement reason-code grammar. */
const REASON_CODE = /^[a-z][a-z0-9-]*$/u;

/** Raises the bounded public error used for invalid placement values. */
function invalidPublication(): never {
  throw new KanbanInvalidSourcePublicationError();
}

/** Returns a validated equality-only revision without coercion. */
function snapshotRevision(value: unknown): KanbanRevision {
  try {
    return snapshotKanbanRevision(value);
  } catch {
    return invalidPublication();
  }
}

/** Returns a safe stable card key while preserving string/number distinction. */
function snapshotCardKey(value: unknown): CardKey {
  if (typeof value !== 'number' && typeof value !== 'string') return invalidPublication();
  try {
    return createKanbanCardKey(value);
  } catch {
    return invalidPublication();
  }
}

/** Validates one bounded half-open prefetch hint. */
function snapshotPrefetchRange(value: unknown): KanbanPrefetchRange {
  const properties = snapshotKanbanDataProperties(value, PREFETCH_KEYS.size);
  validateKanbanDataKeys(properties, PREFETCH_KEYS);
  if (
    Object.keys(properties).length !== 2 ||
    typeof properties.start !== 'number' ||
    typeof properties.end !== 'number' ||
    !Number.isSafeInteger(properties.start) ||
    !Number.isSafeInteger(properties.end) ||
    properties.start < 0 ||
    properties.end < properties.start
  ) {
    return invalidPublication();
  }
  return Object.freeze({ start: properties.start, end: properties.end });
}

/** Validates, detaches, and freezes one revision-bound semantic placement. */
export function snapshotKanbanPlacement(value: unknown): KanbanPlacement {
  try {
    const properties = snapshotKanbanDataProperties(value, PLACEMENT_KEYS.size);
    validateKanbanDataKeys(properties, PLACEMENT_KEYS);
    const cursorRevision = snapshotRevision(properties.cursorRevision);

    if (properties.kind === 'start' || properties.kind === 'end') {
      if (Object.keys(properties).length !== 2) return invalidPublication();
      return Object.freeze({ kind: properties.kind, cursorRevision });
    }
    if (properties.kind === 'between') {
      if (Object.keys(properties).length !== 4) return invalidPublication();
      const beforeCardKey = properties.beforeCardKey === null ? null : snapshotCardKey(properties.beforeCardKey);
      const afterCardKey = properties.afterCardKey === null ? null : snapshotCardKey(properties.afterCardKey);
      if (
        (beforeCardKey === null && afterCardKey === null) ||
        (beforeCardKey !== null && afterCardKey !== null && beforeCardKey === afterCardKey)
      ) {
        return invalidPublication();
      }
      return Object.freeze({ kind: 'between', beforeCardKey, afterCardKey, cursorRevision });
    }
    if (properties.kind === 'window-edge') {
      if (properties.edge !== 'before' && properties.edge !== 'after') return invalidPublication();
      const keys = Object.keys(properties).length;
      if (keys !== 4 && keys !== 5) return invalidPublication();
      const token = properties.token;
      return Object.freeze({
        kind: 'window-edge',
        edge: properties.edge,
        neighborCardKey: snapshotCardKey(properties.neighborCardKey),
        ...(token === undefined
          ? {}
          : { token: typeof token === 'string' ? createPlacementToken(token) : invalidPublication() }),
        cursorRevision,
      });
    }
    if (properties.kind !== 'unavailable') return invalidPublication();
    const code = properties.code;
    if (typeof code !== 'string' || code.length > 128 || !REASON_CODE.test(code)) return invalidPublication();
    const label = properties.label;
    if (label !== undefined && typeof label !== 'string') return invalidPublication();
    const sanitizedLabel =
      typeof label === 'string'
        ? sanitizeContractText(label, 512)
            .replace(/[\t\n]+/gu, ' ')
            .trim()
        : undefined;
    const prefetch = properties.prefetch === undefined ? undefined : snapshotPrefetchRange(properties.prefetch);
    const expectedKeys = 3 + (label === undefined ? 0 : 1) + (prefetch === undefined ? 0 : 1);
    if (Object.keys(properties).length !== expectedKeys) return invalidPublication();
    return Object.freeze({
      kind: 'unavailable',
      code,
      ...(sanitizedLabel === undefined || sanitizedLabel.length === 0 ? {} : { label: sanitizedLabel }),
      ...(prefetch === undefined ? {} : { prefetch }),
      cursorRevision,
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/**
 * Rejects any placement derived from a different cursor revision.
 *
 * Call this immediately before forwarding a future mutation request so a stale opaque token or
 * neighbor anchor can never reach application code.
 */
export function assertKanbanPlacementCurrent(
  placement: KanbanPlacement,
  currentRevision: KanbanRevision,
): KanbanPlacement {
  const snapshot = snapshotKanbanPlacement(placement);
  if (!kanbanRevisionsEqual(snapshot.cursorRevision, snapshotRevision(currentRevision))) {
    return invalidPublication();
  }
  return snapshot;
}

/**
 * Validate a bounded set of current opaque placement tokens without interpreting their contents.
 *
 * Duplicate tokens are rejected because one source evidence set must name each authority token once.
 */
export function snapshotKanbanPlacementTokens(value: unknown): readonly PlacementToken[] {
  try {
    const tokens = snapshotKanbanDataArray(value, KANBAN_LIMITS.ensureRangeCards.safe).map((entry) => {
      if (typeof entry !== 'string') return invalidPublication();
      return createPlacementToken(entry);
    });
    if (new Set(tokens).size !== tokens.length) return invalidPublication();
    return Object.freeze(tokens);
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Check opaque token membership only after validating the complete current source-owned set. */
export function isKanbanPlacementTokenCurrent(token: PlacementToken, current: unknown): boolean {
  let candidate: PlacementToken;
  try {
    candidate = createPlacementToken(token);
  } catch {
    return invalidPublication();
  }
  return snapshotKanbanPlacementTokens(current).includes(candidate);
}
