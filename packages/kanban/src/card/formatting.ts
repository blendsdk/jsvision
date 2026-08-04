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
