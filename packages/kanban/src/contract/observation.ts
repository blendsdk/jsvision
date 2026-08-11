import type { CardKey, KanbanColumnId, KanbanOperationId, KanbanSwimlaneId } from './identity.js';
import { KANBAN_LIMITS, KanbanInvalidLimitError } from './limits.js';
import type { KanbanRequest } from './request.js';
import { snapshotKanbanDataProperties, validateKanbanDataKeys } from './data-snapshot.js';
import type { KanbanDataProperties } from './data-snapshot.js';
import { sanitizeContractText } from './text-safety.js';
import type { KanbanOperationState } from '../operation/types.js';

/** Runtime scope in which an isolated application or package failure occurred. */
export type KanbanObservationScope = 'board' | 'query' | 'source' | 'cell' | 'card' | 'renderer' | 'request';

/** Bounded numeric counters that provide payload-free diagnostic context. */
export type KanbanObservationCounts = Readonly<Record<string, number>>;

/** Coarse monotonic elapsed-time band that avoids exposing precise timing data. */
export type KanbanObservationDurationBucket = 'under-10ms' | 'under-100ms' | 'under-1s' | 'under-10s' | '10s-or-more';

/** Safe diagnostic metadata that never contains application records, queries, tokens, or raw errors. */
export interface KanbanObservation {
  /** Stable sanitized reason code. */
  readonly code: string;
  /** Small semantic scope used to route diagnostics. */
  readonly scope: KanbanObservationScope;
  /** Optional operation identity for payload-free request lifecycle diagnostics. */
  readonly operationId?: KanbanOperationId;
  /** Optional request discriminator for payload-free operation lifecycle diagnostics. */
  readonly kind?: KanbanRequest['kind'];
  /** Optional operation lifecycle state. */
  readonly state?: KanbanOperationState;
  /** Optional coarse elapsed time since the operation was admitted. */
  readonly duration?: KanbanObservationDurationBucket;
  /** Optional application card identity, preserving string and number distinction. */
  readonly cardKey?: CardKey;
  /** Optional validated workflow-column identity. */
  readonly columnId?: KanbanColumnId;
  /** Optional validated swimlane identity. */
  readonly swimlaneId?: KanbanSwimlaneId;
  /** Optional bounded payload-free counters. */
  readonly counts?: KanbanObservationCounts;
  /** Optional sanitized display label. */
  readonly message?: string;
}

/** Input accepted when converting a caught callback failure to safe diagnostic metadata. */
export interface KanbanObservationInput extends Omit<KanbanObservation, 'message'> {
  /** Raw callback failure, deliberately ignored after failure classification. */
  readonly error?: unknown;
  /** Optional already-safe label; raw exception messages must never be supplied here. */
  readonly message?: string;
}

/** Maximum characters retained from one sanitized observation label. */
const MAX_MESSAGE_CHARACTERS = 512;
/** Maximum reason-code characters retained by the local diagnostic contract. */
const MAX_CODE_CHARACTERS = 128;
/** Maximum number of numeric counter entries retained in one observation. */
const MAX_COUNT_ENTRIES = 32;
/** Allowlisted diagnostic reason and counter-key grammar. */
const SAFE_CODE = /^[a-z][a-z0-9-]*$/u;
/** Terminal controls rejected from structural identities retained in diagnostics. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
/** Maximum encoded size of an identity retained in diagnostics. */
const MAX_ID_BYTES = 256;
/** Shared encoder for bounded diagnostic identities. */
const OBSERVATION_ENCODER = new TextEncoder();
/** Exact members accepted at the diagnostic boundary. */
const OBSERVATION_KEYS = new Set([
  'code',
  'scope',
  'operationId',
  'kind',
  'state',
  'duration',
  'cardKey',
  'columnId',
  'swimlaneId',
  'counts',
  'error',
  'message',
]);

/** Narrow one optional duration band to the closed payload-free union. */
function safeDuration(value: unknown): KanbanObservationDurationBucket | undefined {
  switch (value) {
    case 'under-10ms':
    case 'under-100ms':
    case 'under-1s':
    case 'under-10s':
    case '10s-or-more':
      return value;
    default:
      return undefined;
  }
}

/** Narrows an untrusted value to one allowlisted observation scope. */
function isObservationScope(value: unknown): value is KanbanObservationScope {
  return (
    value === 'board' ||
    value === 'query' ||
    value === 'source' ||
    value === 'cell' ||
    value === 'card' ||
    value === 'renderer' ||
    value === 'request'
  );
}

/** Narrow one optional request discriminator without retaining custom payload data. */
function safeRequestKind(value: unknown): KanbanRequest['kind'] | undefined {
  switch (value) {
    case 'card-create':
    case 'card-update':
    case 'card-duplicate':
    case 'card-archive':
    case 'card-delete':
    case 'card-move':
    case 'column-add':
    case 'column-update':
    case 'column-reorder':
    case 'column-delete':
    case 'swimlane-add':
    case 'swimlane-update':
    case 'swimlane-reorder':
    case 'swimlane-delete':
    case 'saved-view-save':
    case 'saved-view-rename':
    case 'saved-view-delete':
    case 'extension':
      return value;
    default:
      return undefined;
  }
}

/** Narrow one optional operation state to the closed public lifecycle union. */
function safeOperationState(value: unknown): KanbanOperationState | undefined {
  switch (value) {
    case 'proposed':
    case 'pending':
    case 'accepted':
    case 'committed':
    case 'rejected':
    case 'cancelled':
    case 'superseded':
      return value;
    default:
      return undefined;
  }
}

/** Sanitizes and bounds a display label without reading a caught error. */
function safeMessage(message: unknown): string | undefined {
  if (typeof message !== 'string') return undefined;
  const cleaned = sanitizeContractText(message, MAX_MESSAGE_CHARACTERS)
    .replace(/[\t\n]+/gu, ' ')
    .trim();
  if (cleaned.length === 0) return undefined;
  return cleaned;
}

/** Returns a safe bounded reason code, degrading invalid values to a package-owned fallback. */
function safeCode(code: unknown): string {
  return typeof code === 'string' && code.length <= MAX_CODE_CHARACTERS && SAFE_CODE.test(code)
    ? code
    : 'invalid-observation';
}

/** Retains one safe card identity while preserving the number/string distinction. */
function safeCardKey(key: unknown): CardKey | undefined {
  if (typeof key === 'number') return Number.isFinite(key) ? key : undefined;
  return safeIdentity(key);
}

/** Retains a bounded control-free structural identity or omits it. */
function safeIdentity(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_ID_BYTES ||
    CONTROL_CHARACTERS.test(value) ||
    OBSERVATION_ENCODER.encode(value).byteLength > MAX_ID_BYTES
  ) {
    return undefined;
  }
  return value;
}

/** Copies finite numeric counters without invoking accessors or retaining caller objects. */
function safeCounts(counts: unknown): KanbanObservationCounts | undefined {
  if (counts === undefined) return undefined;
  try {
    const properties = snapshotKanbanDataProperties(counts, MAX_COUNT_ENTRIES);
    const entries = Object.keys(properties).sort();
    const result: Record<string, number> = {};
    for (const key of entries) {
      const value = properties[key];
      if (!SAFE_CODE.test(key) || typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
      }
      result[key] = value;
    }
    return Object.freeze(result);
  } catch {
    return undefined;
  }
}

/** Creates one detached, frozen, redacted observation. */
export function createKanbanObservation(input: KanbanObservationInput): KanbanObservation {
  let properties: KanbanDataProperties;
  try {
    properties = snapshotKanbanDataProperties(input);
    validateKanbanDataKeys(properties, OBSERVATION_KEYS);
  } catch {
    properties = Object.freeze({});
  }
  const message = safeMessage(properties.message);
  const counts = safeCounts(properties.counts);
  const operationId = safeIdentity(properties.operationId);
  const kind = safeRequestKind(properties.kind);
  const state = safeOperationState(properties.state);
  const duration = safeDuration(properties.duration);
  const cardKey = safeCardKey(properties.cardKey);
  const columnId = safeIdentity(properties.columnId);
  const swimlaneId = safeIdentity(properties.swimlaneId);
  return Object.freeze({
    code: safeCode(properties.code),
    scope: isObservationScope(properties.scope) ? properties.scope : 'board',
    ...(operationId === undefined ? {} : { operationId }),
    ...(kind === undefined ? {} : { kind }),
    ...(state === undefined ? {} : { state }),
    ...(duration === undefined ? {} : { duration }),
    ...(cardKey === undefined ? {} : { cardKey }),
    ...(columnId === undefined ? {} : { columnId }),
    ...(swimlaneId === undefined ? {} : { swimlaneId }),
    ...(counts === undefined ? {} : { counts }),
    ...(message === undefined ? {} : { message }),
  });
}

/** Fixed-capacity FIFO buffer for already-redacted runtime observations. */
export class KanbanObservationBuffer {
  readonly #capacity: number;
  readonly #observations: KanbanObservation[] = [];

  /** Creates a buffer whose capacity must be a finite non-negative safe integer. */
  constructor(capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 0 || capacity > KANBAN_LIMITS.retainedObservations.absolute) {
      throw new KanbanInvalidLimitError();
    }
    this.#capacity = capacity;
  }

  /** Adds a detached safe observation and evicts the oldest entry when full. */
  push(observation: KanbanObservation): void {
    if (this.#capacity === 0) return;
    this.#observations.push(createKanbanObservation(observation));
    while (this.#observations.length > this.#capacity) this.#observations.shift();
  }

  /** Returns a frozen snapshot ordered from oldest to newest. */
  values(): readonly KanbanObservation[] {
    return Object.freeze([...this.#observations]);
  }

  /** Removes every retained observation without changing capacity. */
  clear(): void {
    this.#observations.length = 0;
  }
}
