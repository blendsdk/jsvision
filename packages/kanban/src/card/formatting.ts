import { KanbanInvalidDescriptorError } from '../contract/error.js';
import { snapshotPresentationProperties } from './presentation-value.js';

/**
 * Bounded application formatting functions available to a card renderer.
 *
 * The package never performs implicit timezone conversion or locale loading. Applications decide how
 * opaque date values are interpreted and may return `undefined` when a value has no safe presentation.
 *
 * @example
 * ```ts
 * const formatting: KanbanCardFormattingContext = {
 *   locale: 'en',
 *   formatNumber: (value) => new Intl.NumberFormat('en').format(value),
 *   formatDate: (value) => value instanceof Date ? value.toISOString().slice(0, 10) : undefined,
 * };
 * ```
 */
export interface KanbanCardFormattingContext {
  /** Canonical application-selected locale used by the supplied formatters. */
  readonly locale: string;
  /** Formats one finite number or bigint without changing its value. */
  readonly formatNumber: (value: number | bigint) => string;
  /** Formats one opaque application date value, or declines it with `undefined`. */
  readonly formatDate: (value: unknown) => string | undefined;
}

/** Structural keys required from one formatting context. */
const FORMATTING_KEYS = new Set(['locale', 'formatNumber', 'formatDate']);

/** Validates a formatting boundary without wrapping callbacks or changing their arguments. */
export function validateKanbanCardFormattingContext(value: unknown): asserts value is KanbanCardFormattingContext {
  const source = snapshotPresentationProperties(value, FORMATTING_KEYS);
  if (
    Object.keys(source).length !== FORMATTING_KEYS.size ||
    typeof source.locale !== 'string' ||
    source.locale.length === 0 ||
    typeof source.formatNumber !== 'function' ||
    typeof source.formatDate !== 'function'
  ) {
    throw new KanbanInvalidDescriptorError();
  }
}

/** Formats a finite number or bigint through an optional field formatter. */
export function formatKanbanCardNumber(
  value: unknown,
  context: KanbanCardFormattingContext,
  format?: (value: unknown, context: KanbanCardFormattingContext) => unknown,
): unknown {
  if ((typeof value !== 'number' || !Number.isFinite(value)) && typeof value !== 'bigint') {
    throw new KanbanInvalidDescriptorError();
  }
  return format === undefined ? context.formatNumber(value) : format(value, context);
}

/**
 * Formats one opaque date without parsing, cloning, coercing, or changing its identity.
 *
 * The supplied field formatter takes precedence over the context fallback. Both receive the exact
 * application value once, so timezone and calendar meaning remain application-owned.
 */
export function formatKanbanCardDate(
  value: unknown,
  context: KanbanCardFormattingContext,
  format?: (value: unknown, context: KanbanCardFormattingContext) => unknown,
): unknown {
  return format === undefined ? context.formatDate(value) : format(value, context);
}
