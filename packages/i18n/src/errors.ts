import type { CatalogIssue, I18nCode } from './types.js';

/** Immutable options accepted when constructing an {@link I18nError}. */
export interface I18nErrorOptions {
  /** Structured validation issues related to the failure. */
  readonly issues?: readonly CatalogIssue[];
  /** Lower-level error retained without exposing it in the public message. */
  readonly cause?: unknown;
}

/**
 * Typed configuration, validation, formatter, and loading error.
 *
 * Runtime translation misses use bounded diagnostics instead of throwing this error.
 *
 * @example
 * ```ts
 * import { I18nError, createI18n } from '@jsvision/i18n';
 *
 * try {
 *   createI18n({ locale: 'not_a_locale' });
 * } catch (error) {
 *   if (error instanceof I18nError) console.error(error.code);
 * }
 * ```
 */
export class I18nError extends Error {
  /** Machine-stable error category. */
  readonly code: I18nCode;

  /** Copied structural issues that contributed to the failure. */
  readonly issues: readonly CatalogIssue[];

  /**
   * Creates a typed i18n failure.
   *
   * @param code Machine-stable error category.
   * @param message Value-free developer explanation.
   * @param options Optional copied issues and retained cause.
   */
  constructor(code: I18nCode, message: string, options: I18nErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'I18nError';
    this.code = code;
    this.issues = Object.freeze([...(options.issues ?? [])]);
  }
}

/**
 * Narrows an unknown caught value to {@link I18nError}.
 *
 * @param value Caught value to inspect.
 * @returns `true` only for errors created by this package.
 *
 * @example
 * ```ts
 * import { isI18nError } from '@jsvision/i18n';
 *
 * declare const error: unknown;
 * if (isI18nError(error)) console.error(error.code);
 * ```
 */
export function isI18nError(value: unknown): value is I18nError {
  return value instanceof I18nError;
}
