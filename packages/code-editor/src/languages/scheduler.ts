import { documentRevision } from '../document/types.js';
import type { DocumentIdentity } from '../document/types.js';
import { syntaxCategories } from './contracts.js';
import type {
  BracketPair,
  FoldRange,
  LanguageAdapter,
  LanguageCapability,
  LocalLanguageResult,
  SyntaxSpan,
} from './contracts.js';

export interface LanguageSchedulerOptions {
  readonly maxResults?: number;
  readonly schedule?: (work: () => void) => void;
}

export interface LanguageAnalysisOptions {
  readonly signal?: AbortSignal;
}

interface RetainedState {
  readonly text: string;
  readonly syntax?: object;
  readonly folds?: object;
  readonly brackets?: object;
}

/**
 * Runs independently optional language capabilities and rejects stale generations.
 * @example `new LanguageScheduler().analyze(adapter, text, identity)`
 */
export class LanguageScheduler {
  #generation = 0;
  readonly #maxResults: number;
  readonly #schedule: (work: () => void) => void;
  readonly #retained = new WeakMap<LocalLanguageResult, RetainedState>();

  public constructor(options: LanguageSchedulerOptions = {}) {
    const limit = options.maxResults ?? 100_000;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000_000) {
      throw new RangeError('Result limit is invalid.');
    }
    this.#maxResults = limit;
    this.#schedule = options.schedule ?? ((work) => queueMicrotask(work));
  }

  public async analyze(
    adapterInput: unknown,
    text: string,
    identity: { readonly lineage: string; readonly revision: number },
    previous?: LocalLanguageResult,
    options: LanguageAnalysisOptions = {},
  ): Promise<LocalLanguageResult> {
    const generation = ++this.#generation;
    const trustedIdentity: DocumentIdentity = {
      lineage: identity.lineage,
      revision: documentRevision(identity.revision),
    };
    const adapter = readAdapter(adapterInput);
    if (adapter === undefined) return this.#degraded('unknown', generation, trustedIdentity);

    try {
      this.#assertCurrent(generation, options.signal);
      const retained = previous === undefined ? undefined : this.#retained.get(previous);
      let remaining = this.#maxResults;
      const syntax = await this.#runCapability(
        adapter.syntax,
        text,
        retained?.syntax,
        retained?.text,
        remaining,
        generation,
        options.signal,
      );
      remaining -= syntax.items.length;
      const folds = await this.#runCapability(
        adapter.folds,
        text,
        retained?.folds,
        retained?.text,
        remaining,
        generation,
        options.signal,
      );
      remaining -= folds.items.length;
      const brackets = await this.#runCapability(
        adapter.brackets,
        text,
        retained?.brackets,
        retained?.text,
        remaining,
        generation,
        options.signal,
      );
      this.#assertCurrent(generation, options.signal);

      if (
        !isValidSyntax(syntax.items, text.length) ||
        !isValidFolds(folds.items, text.length) ||
        !isValidBrackets(brackets.items, text.length)
      ) {
        throw new Error('Language adapter returned invalid output.');
      }
      const result: LocalLanguageResult = Object.freeze({
        syntax: syntax.items,
        folds: folds.items,
        brackets: brackets.items,
        identity: trustedIdentity,
        adapterId: adapter.id,
        generation,
        state: 'ready',
      });
      this.#retained.set(result, {
        text,
        ...(syntax.state === undefined ? {} : { syntax: syntax.state }),
        ...(folds.state === undefined ? {} : { folds: folds.state }),
        ...(brackets.state === undefined ? {} : { brackets: brackets.state }),
      });
      return result;
    } catch {
      return this.#degraded(adapter.id, generation, trustedIdentity);
    }
  }

  async #runCapability<T>(
    capability: LanguageCapability<T> | undefined,
    text: string,
    previousState: object | undefined,
    previousText: string | undefined,
    maxResults: number,
    generation: number,
    signal: AbortSignal | undefined,
  ): Promise<{ readonly items: readonly T[]; readonly state?: object }> {
    if (capability === undefined || maxResults === 0) return { items: [] };
    await this.#yield(generation, signal);
    const result = await capability(text, {
      maxResults,
      previousState,
      previousText,
      signal,
      yieldControl: () => this.#yield(generation, signal),
    });
    this.#assertCurrent(generation, signal);
    if (!Array.isArray(result.items) || result.items.length > maxResults) {
      throw new Error('Language capability exceeded its result budget.');
    }
    return result;
  }

  #yield(generation: number, signal: AbortSignal | undefined): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#schedule(() => {
        try {
          this.#assertCurrent(generation, signal);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  #assertCurrent(generation: number, signal: AbortSignal | undefined): void {
    if (signal?.aborted === true || generation !== this.#generation) {
      throw new Error('Language analysis was cancelled or superseded.');
    }
  }

  #degraded(adapterId: string, generation: number, identity: DocumentIdentity): LocalLanguageResult {
    return Object.freeze({
      syntax: [],
      folds: [],
      brackets: [],
      identity,
      adapterId,
      generation,
      state: 'degraded',
      failure: 'Language analysis failed.',
    });
  }
}

function readAdapter(value: unknown): LanguageAdapter | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  try {
    if (Object.getOwnPropertyDescriptor(value, 'analyze') !== undefined) return undefined;
    const version = ownValue(value, 'contractVersion');
    const id = ownValue(value, 'id');
    const extensions = ownValue(value, 'extensions');
    if (version !== 1 || typeof id !== 'string' || !Array.isArray(extensions) || !extensions.every(isString))
      return undefined;
    for (const name of ['syntax', 'folds', 'brackets'] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (descriptor !== undefined && !('value' in descriptor)) return undefined;
      const capability = descriptor?.value;
      if (capability !== undefined && typeof capability !== 'function') return undefined;
    }
    return isLanguageAdapter(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function ownValue(value: object, name: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isLanguageAdapter(value: object): value is LanguageAdapter {
  return (
    ownValue(value, 'contractVersion') === 1 &&
    typeof ownValue(value, 'id') === 'string' &&
    Array.isArray(ownValue(value, 'extensions'))
  );
}

function isValidSyntax(values: readonly SyntaxSpan[], length: number): boolean {
  return (
    isOrdered(
      values,
      (value) => value.from,
      (value) => value.to,
    ) &&
    values.every(
      (span) =>
        Number.isSafeInteger(span.from) &&
        Number.isSafeInteger(span.to) &&
        span.from >= 0 &&
        span.from < span.to &&
        span.to <= length &&
        syntaxCategories.includes(span.category),
    )
  );
}

function isValidFolds(values: readonly FoldRange[], length: number): boolean {
  return (
    isOrdered(
      values,
      (value) => value.from,
      (value) => value.to,
    ) &&
    values.every(
      (fold) =>
        Number.isSafeInteger(fold.from) &&
        Number.isSafeInteger(fold.to) &&
        fold.from >= 0 &&
        fold.from < fold.to &&
        fold.to <= length,
    )
  );
}

function isValidBrackets(values: readonly BracketPair[], length: number): boolean {
  return (
    isOrdered(
      values,
      (value) => value.open,
      (value) => value.close,
    ) &&
    values.every(
      (pair) =>
        Number.isSafeInteger(pair.open) &&
        Number.isSafeInteger(pair.close) &&
        pair.open >= 0 &&
        pair.open < pair.close &&
        pair.close < length,
    )
  );
}

function isOrdered<T>(values: readonly T[], start: (value: T) => number, end: (value: T) => number): boolean {
  let previousStart = -1;
  let previousEnd = -1;
  for (const value of values) {
    const currentStart = start(value);
    const currentEnd = end(value);
    if (currentStart < previousStart || (currentStart === previousStart && currentEnd < previousEnd)) return false;
    previousStart = currentStart;
    previousEnd = currentEnd;
  }
  return true;
}

/**
 * Creates an isolated local-language scheduler.
 * @example `const scheduler = createLanguageScheduler({ maxResults: 10_000 })`
 */
export function createLanguageScheduler(options?: LanguageSchedulerOptions): LanguageScheduler {
  return new LanguageScheduler(options);
}
