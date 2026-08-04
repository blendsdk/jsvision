import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { KanbanInvalidSourcePublicationError } from '../contract/error.js';
import { sanitizeContractText } from '../contract/text-safety.js';

/** Reactive lifecycle state published by a query session. */
export type KanbanSourceState =
  | { readonly kind: 'loading' | 'ready' | 'refreshing' | 'partial' | 'empty' }
  | { readonly kind: 'error'; readonly code: string; readonly label?: string };

/** Reactive lifecycle state published by one sparse cell cursor. */
export type KanbanCellState =
  | { readonly kind: 'loading' | 'ready' | 'refreshing' | 'partial' | 'empty' }
  | {
      readonly kind: 'error';
      readonly code: string;
      readonly label?: string;
      readonly retry: 'available' | 'unavailable';
    };

/** Logical length knowledge exposed without fabricating completeness. */
export type KanbanKnownLength =
  | { readonly kind: 'exact'; readonly value: number }
  | { readonly kind: 'at-least'; readonly value: number }
  | { readonly kind: 'unknown' };

/** Safe machine-readable source reason-code grammar. */
const REASON_CODE = /^[a-z][a-z0-9-]*$/u;
/** Maximum characters retained from a source-provided display label. */
const MAX_LABEL_CHARACTERS = 512;
/** Accepted members for a source state. */
const SOURCE_STATE_KEYS = new Set(['kind', 'code', 'label']);
/** Accepted members for a cell state. */
const CELL_STATE_KEYS = new Set(['kind', 'code', 'label', 'retry']);
/** Accepted members for a known-length value. */
const LENGTH_KEYS = new Set(['kind', 'value']);

/** Converts an unsafe boundary value to the public source-publication error. */
function invalidPublication(): never {
  throw new KanbanInvalidSourcePublicationError();
}

/** Returns true for an ordinary non-error lifecycle state kind. */
function isOrdinaryStateKind(value: unknown): value is 'loading' | 'ready' | 'refreshing' | 'partial' | 'empty' {
  return value === 'loading' || value === 'ready' || value === 'refreshing' || value === 'partial' || value === 'empty';
}

/** Validates one safe source reason code. */
function snapshotReasonCode(value: unknown): string {
  if (typeof value !== 'string' || value.length > 128 || !REASON_CODE.test(value)) return invalidPublication();
  return value;
}

/** Sanitizes a bounded optional display label and omits an empty result. */
function snapshotOptionalLabel(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return invalidPublication();
  const label = sanitizeContractText(value, MAX_LABEL_CHARACTERS)
    .replace(/[\t\n]+/gu, ' ')
    .trim();
  return label.length === 0 ? undefined : label;
}

/** Validates, detaches, and freezes one query-session lifecycle state. */
export function snapshotKanbanSourceState(value: unknown): KanbanSourceState {
  try {
    const properties = snapshotKanbanDataProperties(value, SOURCE_STATE_KEYS.size);
    validateKanbanDataKeys(properties, SOURCE_STATE_KEYS);
    if (isOrdinaryStateKind(properties.kind)) {
      if (Object.keys(properties).length !== 1) return invalidPublication();
      return Object.freeze({ kind: properties.kind });
    }
    if (properties.kind !== 'error') return invalidPublication();
    if (Object.keys(properties).length < 2) return invalidPublication();
    const code = snapshotReasonCode(properties.code);
    const label = snapshotOptionalLabel(properties.label);
    return Object.freeze({ kind: 'error', code, ...(label === undefined ? {} : { label }) });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Validates, detaches, and freezes one sparse-cursor lifecycle state. */
export function snapshotKanbanCellState(value: unknown): KanbanCellState {
  try {
    const properties = snapshotKanbanDataProperties(value, CELL_STATE_KEYS.size);
    validateKanbanDataKeys(properties, CELL_STATE_KEYS);
    if (isOrdinaryStateKind(properties.kind)) {
      if (Object.keys(properties).length !== 1) return invalidPublication();
      return Object.freeze({ kind: properties.kind });
    }
    if (
      properties.kind !== 'error' ||
      (properties.retry !== 'available' && properties.retry !== 'unavailable') ||
      Object.keys(properties).length < 3
    ) {
      return invalidPublication();
    }
    const code = snapshotReasonCode(properties.code);
    const label = snapshotOptionalLabel(properties.label);
    return Object.freeze({
      kind: 'error',
      code,
      ...(label === undefined ? {} : { label }),
      retry: properties.retry,
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Validates and freezes explicit exact, lower-bound, or unknown cursor length knowledge. */
export function snapshotKanbanKnownLength(value: unknown): KanbanKnownLength {
  try {
    const properties = snapshotKanbanDataProperties(value, LENGTH_KEYS.size);
    validateKanbanDataKeys(properties, LENGTH_KEYS);
    if (properties.kind === 'unknown') {
      if (Object.keys(properties).length !== 1) return invalidPublication();
      return Object.freeze({ kind: 'unknown' });
    }
    if (
      (properties.kind !== 'exact' && properties.kind !== 'at-least') ||
      Object.keys(properties).length !== 2 ||
      typeof properties.value !== 'number' ||
      !Number.isSafeInteger(properties.value) ||
      properties.value < 0
    ) {
      return invalidPublication();
    }
    return Object.freeze({ kind: properties.kind, value: properties.value });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}
