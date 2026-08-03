import type { CardKey, KanbanColumnId, KanbanSwimlaneId } from './identity.js';
import { sanitizeContractText } from './text-safety.js';

/** Runtime scope in which an isolated application or package failure occurred. */
export type KanbanObservationScope = 'board' | 'query' | 'source' | 'cell' | 'card' | 'renderer' | 'request';

/** Bounded numeric counters that provide payload-free diagnostic context. */
export type KanbanObservationCounts = Readonly<Record<string, number>>;

/** Safe diagnostic metadata that never contains application records, queries, tokens, or raw errors. */
export interface KanbanObservation {
  /** Stable sanitized reason code. */
  readonly code: string;
  /** Small semantic scope used to route diagnostics. */
  readonly scope: KanbanObservationScope;
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
/** Allowlisted runtime scopes, captured independently from caller objects. */
const SAFE_SCOPES = new Set<KanbanObservationScope>([
  'board',
  'query',
  'source',
  'cell',
  'card',
  'renderer',
  'request',
]);

/** Sanitizes and bounds a display label without reading a caught error. */
function safeMessage(message: string | undefined): string | undefined {
  if (message === undefined) return undefined;
  const cleaned = sanitizeContractText(message)
    .replace(/[\t\n]+/gu, ' ')
    .trim();
  if (cleaned.length === 0) return undefined;
  return Array.from(cleaned).slice(0, MAX_MESSAGE_CHARACTERS).join('');
}

/** Returns a safe bounded reason code, degrading invalid values to a package-owned fallback. */
function safeCode(code: string): string {
  return typeof code === 'string' && code.length <= MAX_CODE_CHARACTERS && SAFE_CODE.test(code)
    ? code
    : 'invalid-observation';
}

/** Retains one safe card identity while preserving the number/string distinction. */
function safeCardKey(key: CardKey | undefined): CardKey | undefined {
  if (typeof key === 'number') return Number.isFinite(key) ? key : undefined;
  return safeIdentity(key);
}

/** Retains a bounded control-free structural identity or omits it. */
function safeIdentity(value: string | undefined): string | undefined {
  if (
    value === undefined ||
    value.length === 0 ||
    CONTROL_CHARACTERS.test(value) ||
    OBSERVATION_ENCODER.encode(value).byteLength > MAX_ID_BYTES
  ) {
    return undefined;
  }
  return value;
}

/** Copies finite numeric counters without invoking accessors or retaining caller objects. */
function safeCounts(counts: KanbanObservationCounts | undefined): KanbanObservationCounts | undefined {
  if (counts === undefined) return undefined;
  try {
    if (typeof counts !== 'object' || counts === null || Array.isArray(counts)) return undefined;
    const descriptors = Object.getOwnPropertyDescriptors(counts);
    const entries = Object.keys(descriptors).sort();
    if (entries.length > MAX_COUNT_ENTRIES) return undefined;
    const result: Record<string, number> = {};
    for (const key of entries) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !SAFE_CODE.test(key) ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        typeof descriptor.value !== 'number' ||
        !Number.isFinite(descriptor.value)
      ) {
        return undefined;
      }
      result[key] = descriptor.value;
    }
    return Object.freeze(result);
  } catch {
    return undefined;
  }
}

/** Creates one detached, frozen, redacted observation. */
export function createKanbanObservation(input: KanbanObservationInput): KanbanObservation {
  const message = safeMessage(input.message);
  const counts = safeCounts(input.counts);
  const cardKey = safeCardKey(input.cardKey);
  const columnId = safeIdentity(input.columnId);
  const swimlaneId = safeIdentity(input.swimlaneId);
  return Object.freeze({
    code: safeCode(input.code),
    scope: SAFE_SCOPES.has(input.scope) ? input.scope : 'board',
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
    if (!Number.isSafeInteger(capacity) || capacity < 0) {
      throw new RangeError('Kanban observation capacity must be a non-negative safe integer.');
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
