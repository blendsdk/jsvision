import { I18nError } from './errors.js';
import { copyDenseArray, inspectArray, inspectOwnDataProperty, inspectOwnKeys, isObjectLike } from './input.js';
import { MAX_CATALOG_MESSAGES } from './limits.js';
import { isSafeText } from './messages.js';
import { createI18nWithDiagnostics, type InitialI18nDiagnostic } from './service.js';
import type {
  Catalog,
  CatalogSource,
  CatalogSourceContext,
  CreateI18nOptions,
  DiagnosticSink,
  I18n,
  LoadI18nOptions,
} from './types.js';
import { defineCatalog } from './validation.js';

const LOAD_OPTION_FIELDS = new Set<PropertyKey>([
  'locale',
  'fallbackLocales',
  'catalogs',
  'diagnosticSink',
  'sources',
  'signal',
]);
const SOURCE_FIELDS = new Set<PropertyKey>(['name', 'required', 'load']);

/** Safely copied source configuration used for one load. */
interface ResolvedSource {
  /** Safe value-free source identifier. */
  readonly name: string;
  /** Whether failure prevents service publication. */
  readonly required: boolean;
  /** Caller-owned load function invoked without coercing its owner. */
  readonly load: CatalogSource['load'];
}

/** Settled caller source before its returned catalogs cross validation. */
type SourceSettlement =
  | { readonly source: ResolvedSource; readonly status: 'fulfilled'; readonly value: unknown }
  | { readonly source: ResolvedSource; readonly status: 'rejected' };

/** Return one public-boundary error without retaining or exposing caller values. */
function sourceError(message: string): I18nError {
  return new I18nError('SOURCE_FAILED', message);
}

/** Read one own data property, rejecting accessors and hostile proxy traps. */
function dataProperty(input: object, key: PropertyKey): unknown {
  const property = inspectOwnDataProperty(input, key);
  if (!property.accessible) {
    throw sourceError('Catalog source configuration must use accessible data properties.');
  }
  return property.present ? property.value : undefined;
}

/** Confirm that an object contains only the declared own data fields. */
function validateFields(input: object, allowed: ReadonlySet<PropertyKey>, message: string): void {
  const keys = inspectOwnKeys(input);
  if (keys === undefined) throw sourceError(message);
  for (const key of keys) {
    const property = inspectOwnDataProperty(input, key);
    if (!allowed.has(key) || !property.accessible) throw sourceError(message);
  }
}

/** Validate one caller-owned source without retaining its object. */
function resolveSource(input: unknown): ResolvedSource {
  if (!isObjectLike(input) || inspectArray(input) !== false) {
    throw sourceError('Catalog source must be an object.');
  }
  validateFields(input, SOURCE_FIELDS, 'Catalog source contains an unsupported member.');
  const name = dataProperty(input, 'name');
  const required = dataProperty(input, 'required');
  const load = dataProperty(input, 'load');
  if (typeof name !== 'string' || name.length === 0 || name.length > 256 || name.includes('\n') || !isSafeText(name)) {
    throw sourceError('Catalog source name must be safe bounded text.');
  }
  if (required !== undefined && typeof required !== 'boolean') {
    throw sourceError('Catalog source required flag must be boolean.');
  }
  if (typeof load !== 'function') {
    throw sourceError('Catalog source load member must be a function.');
  }
  const safeLoad: CatalogSource['load'] = (context) => Reflect.apply(load, undefined, [context]);
  return Object.freeze({
    load: safeLoad,
    name,
    required: required ?? true,
  });
}

/** Check a supplied cancellation signal without allowing proxy failures to escape. */
function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

/** Copy load options and separate synchronous service construction from source configuration. */
function resolveLoadOptions(input: LoadI18nOptions): {
  readonly createOptions: Omit<CreateI18nOptions, 'catalogs'>;
  readonly baseCatalogs: readonly unknown[];
  readonly signal: AbortSignal;
  readonly sources: readonly ResolvedSource[];
} {
  if (!isObjectLike(input) || inspectArray(input) !== false) {
    throw sourceError('Internationalization load options must be an object.');
  }
  validateFields(input, LOAD_OPTION_FIELDS, 'Internationalization load options contain an unsupported member.');

  const rawSources = dataProperty(input, 'sources');
  const sourceValues = copyDenseArray(rawSources, MAX_CATALOG_MESSAGES);
  if (sourceValues === undefined) throw sourceError('Catalog sources must be a dense bounded Array.');
  const rawCatalogs = dataProperty(input, 'catalogs');
  const baseCatalogs =
    rawCatalogs === undefined ? Object.freeze([]) : copyDenseArray(rawCatalogs, MAX_CATALOG_MESSAGES);
  if (baseCatalogs === undefined) throw new I18nError('INVALID_CATALOG', 'Catalogs must be a dense bounded Array.');

  const rawSignal = dataProperty(input, 'signal');
  if (rawSignal !== undefined && !isAbortSignal(rawSignal)) {
    throw sourceError('Catalog source signal must be an AbortSignal.');
  }
  const signal = rawSignal ?? new AbortController().signal;
  const locale = dataProperty(input, 'locale');
  if (locale !== undefined && typeof locale !== 'string') {
    throw new I18nError('INVALID_LOCALE', 'Requested locale must be a string.');
  }
  const rawFallbackLocales = dataProperty(input, 'fallbackLocales');
  const fallbackValues =
    rawFallbackLocales === undefined ? undefined : copyDenseArray(rawFallbackLocales, MAX_CATALOG_MESSAGES);
  if (
    rawFallbackLocales !== undefined &&
    (fallbackValues === undefined || fallbackValues.some((value) => typeof value !== 'string'))
  ) {
    throw new I18nError('INVALID_LOCALE', 'Fallback locales must be a dense string Array.');
  }
  const fallbackLocales: string[] = [];
  for (const value of fallbackValues ?? []) {
    if (typeof value === 'string') fallbackLocales.push(value);
  }
  const rawDiagnosticSink = dataProperty(input, 'diagnosticSink');
  if (rawDiagnosticSink !== undefined && typeof rawDiagnosticSink !== 'function') {
    throw new I18nError('INVALID_CATALOG', 'Diagnostic sink must be a function.');
  }
  const diagnosticSink =
    typeof rawDiagnosticSink === 'function'
      ? (diagnostic: Parameters<DiagnosticSink>[0]) => {
          Reflect.apply(rawDiagnosticSink, undefined, [diagnostic]);
        }
      : undefined;
  return Object.freeze({
    baseCatalogs,
    createOptions: Object.freeze({
      ...(locale === undefined ? {} : { locale }),
      ...(rawFallbackLocales === undefined ? {} : { fallbackLocales: Object.freeze(fallbackLocales) }),
      ...(diagnosticSink === undefined ? {} : { diagnosticSink }),
    }),
    signal,
    sources: Object.freeze(sourceValues.map(resolveSource)),
  });
}

/** Create a value-free cancellation error that never includes an abort reason. */
function abortedError(): I18nError {
  return new I18nError('ABORTED', 'Internationalization loading was aborted.');
}

/** Await all initiated sources while allowing cancellation to reject promptly. */
async function awaitWithAbort(
  settlements: Promise<readonly SourceSettlement[]>,
  signal: AbortSignal,
): Promise<readonly SourceSettlement[]> {
  if (signal.aborted) throw abortedError();
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(abortedError());
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  try {
    return await Promise.race([settlements, aborted]);
  } finally {
    if (onAbort !== undefined) signal.removeEventListener('abort', onAbort);
  }
}

/** Invoke every source in declaration order and contain synchronous or asynchronous failures. */
function startSources(sources: readonly ResolvedSource[], context: CatalogSourceContext): Promise<SourceSettlement[]> {
  const loads = sources.map((source): Promise<SourceSettlement> => {
    try {
      const output = Reflect.apply(source.load, undefined, [context]);
      return Promise.resolve(output).then(
        (value): SourceSettlement => ({ source, status: 'fulfilled', value }),
        (): SourceSettlement => ({ source, status: 'rejected' }),
      );
    } catch {
      return Promise.resolve({ source, status: 'rejected' });
    }
  });
  return Promise.all(loads);
}

/** Validate one source result as a single catalog or dense ordered catalog list. */
function validateSourceCatalogs(value: unknown, source: ResolvedSource): readonly Catalog[] {
  const arrayState = inspectArray(value);
  if (arrayState === undefined) throw sourceError('Catalog source result could not be inspected safely.');
  const inputs = arrayState ? copyDenseArray(value, MAX_CATALOG_MESSAGES) : Object.freeze([value]);
  if (inputs === undefined) throw sourceError('Catalog source returned an invalid catalog list.');
  return Object.freeze(inputs.map((input) => defineCatalog(input, { source: source.name })));
}

/**
 * Load caller-owned asynchronous catalog sources and publish one complete service.
 *
 * Every source receives the same concrete signal and is invoked in declaration order. Source
 * results retain declaration order even when promises settle out of order. Optional failures
 * become value-free diagnostics; required failures and cancellation reject without publishing a
 * service. Network, authentication, retry, cache, and timeout policy remain caller-owned.
 *
 * @param options Synchronous service options plus ordered asynchronous sources and cancellation.
 * @returns A service published only after every successful source catalog validates.
 * @throws {@link I18nError} with `SOURCE_FAILED`, `ABORTED`, or a catalog validation code.
 *
 * @example
 * ```ts
 * const i18n = await loadI18n({
 *   sources: [{
 *     name: 'application',
 *     async load({ signal }) {
 *       const response = await fetch('/locales/en.json', { signal });
 *       return response.json();
 *     },
 *   }],
 * });
 * ```
 */
export async function loadI18n(options: LoadI18nOptions): Promise<I18n> {
  const resolved = resolveLoadOptions(options);
  const context = Object.freeze({ signal: resolved.signal });
  const settlementPromise = startSources(resolved.sources, context);
  const settlements = await awaitWithAbort(settlementPromise, resolved.signal);
  if (resolved.signal.aborted) throw abortedError();

  const sourceCatalogs: Catalog[] = [];
  const diagnostics: InitialI18nDiagnostic[] = [];
  for (const settlement of settlements) {
    if (settlement.status === 'rejected') {
      if (settlement.source.required) {
        throw sourceError(`Required catalog source "${settlement.source.name}" failed.`);
      }
      diagnostics.push({
        code: 'SOURCE_FAILED',
        key: '',
        source: settlement.source.name,
      });
      continue;
    }
    try {
      sourceCatalogs.push(...validateSourceCatalogs(settlement.value, settlement.source));
    } catch {
      if (settlement.source.required) {
        throw sourceError(`Required catalog source "${settlement.source.name}" returned an invalid catalog.`);
      }
      diagnostics.push({
        code: 'SOURCE_FAILED',
        key: '',
        source: settlement.source.name,
      });
    }
  }

  return createI18nWithDiagnostics(
    {
      ...resolved.createOptions,
      catalogs: Object.freeze([...resolved.baseCatalogs, ...sourceCatalogs]),
    },
    diagnostics,
  );
}
