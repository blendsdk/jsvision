import type { CatalogInput, CatalogSource } from '../../src/index.js';

/** Lowest-priority catalog used to prove source declaration order. */
export const frameworkSourceCatalog = {
  schema: 1 as const,
  locale: 'en',
  messages: {
    'source.priority': 'framework',
  },
};

/** Middle-priority catalog used to prove source declaration order. */
export const packageSourceCatalog = {
  schema: 1 as const,
  locale: 'en',
  messages: {
    'source.priority': 'package',
  },
};

/** Highest-priority catalog used to prove source declaration order. */
export const applicationSourceCatalog = {
  schema: 1 as const,
  locale: 'en',
  messages: {
    'source.priority': 'application',
  },
};

/** Independent successful catalog used beside failing sources. */
export const successfulSourceCatalog = {
  schema: 1 as const,
  locale: 'en',
  messages: {
    'source.loaded': 'loaded',
  },
};

/** A promise whose settlement is controlled explicitly by a source-orchestration test. */
export interface Deferred<Value> {
  readonly promise: Promise<Value>;
  resolve(value: Value): void;
  reject(reason: unknown): void;
}

/** Create a deferred promise without timers or transport behavior. */
export function deferred<Value>(): Deferred<Value> {
  let resolvePromise: (value: Value) => void = () => undefined;
  let rejectPromise: (reason: unknown) => void = () => undefined;
  const promise = new Promise<Value>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

/** A catalog source with externally controlled completion and captured signal identity. */
export interface ControlledCatalogSource {
  readonly source: CatalogSource;
  readonly signals: AbortSignal[];
  resolve(value: CatalogInput | readonly CatalogInput[]): void;
  reject(reason: unknown): void;
}

/**
 * Create a source that records invocation order and waits for explicit test-controlled settlement.
 */
export function controlledCatalogSource(name: string, starts: string[], required?: boolean): ControlledCatalogSource {
  const gate = deferred<CatalogInput | readonly CatalogInput[]>();
  const signals: AbortSignal[] = [];
  const source: CatalogSource = {
    name,
    ...(required === undefined ? {} : { required }),
    load({ signal }) {
      starts.push(name);
      signals.push(signal);
      return gate.promise;
    },
  };

  return {
    source,
    signals,
    resolve: gate.resolve,
    reject: gate.reject,
  };
}
