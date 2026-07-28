import type { DiagnosticSink, I18nDiagnostic } from './types.js';

const MAX_DIAGNOSTICS = 100;

/** Create a collision-free identity for one value-free diagnostic. */
function diagnosticIdentity(diagnostic: I18nDiagnostic): string {
  return JSON.stringify([
    diagnostic.code,
    diagnostic.severity,
    diagnostic.key,
    diagnostic.locale,
    diagnostic.source ?? null,
  ]);
}

/** Copy and freeze a diagnostic before retaining or publishing it. */
function copyDiagnostic(diagnostic: I18nDiagnostic): I18nDiagnostic {
  return Object.freeze({
    code: diagnostic.code,
    severity: 'warning',
    key: diagnostic.key,
    locale: diagnostic.locale,
    ...(diagnostic.source === undefined ? {} : { source: diagnostic.source }),
  });
}

/**
 * Deduplicated insertion-ordered diagnostic storage with an isolated observer.
 *
 * The oldest retained identity is evicted after 100 distinct records. Sink failures are swallowed,
 * and a sink-triggered nested diagnostic is retained without recursively notifying the same sink.
 *
 * @example
 * ```ts
 * const store = new DiagnosticStore();
 * store.record({
 *   code: 'MISSING_TRANSLATION',
 *   severity: 'warning',
 *   key: 'app.title',
 *   locale: 'nl',
 * });
 * ```
 */
export class DiagnosticStore {
  /** Records keyed by their complete public identity. */
  protected readonly entries = new Map<string, I18nDiagnostic>();

  /** Immutable view rebuilt only when retained state changes. */
  protected published: readonly I18nDiagnostic[] = Object.freeze([]);

  /** Prevents one observer from recursively invoking itself. */
  protected notifying = false;

  /**
   * Creates a bounded diagnostic store.
   *
   * @param sink Optional observer called after each new identity is retained.
   */
  constructor(protected readonly sink?: DiagnosticSink) {}

  /** Immutable insertion-ordered retained diagnostics. */
  get records(): readonly I18nDiagnostic[] {
    return this.published;
  }

  /**
   * Retain and optionally publish one new diagnostic identity.
   *
   * @param diagnostic Value-free recoverable fault.
   * @returns `true` when a new identity was inserted, otherwise `false`.
   *
   * @example
   * ```ts
   * store.record({
   *   code: 'MISSING_PARAMETER',
   *   severity: 'warning',
   *   key: 'app.greeting',
   *   locale: 'en',
   * });
   * ```
   */
  record(diagnostic: I18nDiagnostic): boolean {
    const copied = copyDiagnostic(diagnostic);
    const identity = diagnosticIdentity(copied);
    if (this.entries.has(identity)) return false;

    this.entries.set(identity, copied);
    if (this.entries.size > MAX_DIAGNOSTICS) {
      const oldest = this.entries.keys().next().value;
      if (typeof oldest === 'string') this.entries.delete(oldest);
    }
    this.published = Object.freeze([...this.entries.values()]);

    if (this.sink !== undefined && !this.notifying) {
      this.notifying = true;
      try {
        this.sink(copied);
      } catch {
        // Diagnostics are observational; an application observer cannot break translation.
      } finally {
        this.notifying = false;
      }
    }
    return true;
  }
}
