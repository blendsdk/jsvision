import { I18nError } from './errors.js';
import { copyDenseArray } from './input.js';
import { MAX_CATALOG_MESSAGES } from './limits.js';
import { compileMessage, isSafeText, type CompiledMessage } from './messages.js';
import { readonlyMap } from './readonly-map.js';
import type { Catalog, CatalogInput, Message } from './types.js';
import { defineCatalog } from './validation.js';

/** One validated catalog plus optional value-free provenance. */
export interface CatalogLayerInput {
  /** Untrusted or previously validated catalog. */
  readonly catalog: CatalogInput;
  /** Optional source identifier copied into runtime diagnostics. */
  readonly source?: string;
}

/** One immutable, compiled catalog layer. */
export interface CatalogLayer {
  /** Whether this layer is fixed configuration or the replaceable runtime overlay. */
  readonly kind: 'base' | 'runtime';
  /** Canonical locale owned by this layer. */
  readonly locale: string;
  /** Optional value-free source identifier. */
  readonly source?: string;
  /** Precompiled messages keyed by public message name. */
  readonly messages: ReadonlyMap<string, CompiledMessage>;
}

/** Immutable lookup graph captured once by every translation call. */
export interface CatalogSnapshot {
  /** Ordered catalog layers grouped by canonical locale. */
  readonly locales: ReadonlyMap<string, readonly CatalogLayer[]>;
  /** Sorted canonical locales exposed through service introspection. */
  readonly availableLocales: readonly string[];
}

/** Copy an optional bounded source identifier without retaining caller objects. */
function copySource(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 256 && isSafeText(value) ? value : undefined;
}

/** Compile one validated catalog into a lookup layer. */
function compileCatalogLayer(catalog: Catalog, source?: string, kind: CatalogLayer['kind'] = 'base'): CatalogLayer {
  const messages = new Map<string, CompiledMessage>();
  for (const [key, message] of Object.entries(catalog.messages)) {
    messages.set(key, compileMessage(message));
  }
  const copiedSource = copySource(source);
  return Object.freeze({
    kind,
    locale: catalog.locale,
    ...(copiedSource === undefined ? {} : { source: copiedSource }),
    messages: readonlyMap(messages),
  });
}

/**
 * Build an immutable locale-first lookup snapshot from ordered catalog layers.
 *
 * Later layers remain later in each locale's array so the service can search them in reverse
 * without flattening away provenance.
 *
 * @param inputs Ordered catalogs with optional source identifiers.
 * @returns Compiled snapshot and sorted available-locale list.
 * @throws An `I18nError` when any catalog is invalid.
 *
 * @example
 * ```ts
 * createCatalogSnapshot([
 *   { catalog: { schema: 1, locale: 'en', messages: { 'app.ok': 'OK' } } },
 * ]);
 * ```
 */
export function createCatalogSnapshot(inputs: readonly CatalogLayerInput[]): CatalogSnapshot {
  const locales = new Map<string, CatalogLayer[]>();
  for (const input of inputs) {
    const catalog = defineCatalog(input.catalog, { source: copySource(input.source) });
    const layer = compileCatalogLayer(catalog, input.source);
    const existing = locales.get(catalog.locale);
    if (existing === undefined) {
      locales.set(catalog.locale, [layer]);
    } else {
      existing.push(layer);
    }
  }

  const published = new Map<string, readonly CatalogLayer[]>();
  for (const [locale, layers] of locales) {
    published.set(locale, Object.freeze([...layers]));
  }
  return Object.freeze({
    locales: readonlyMap(published),
    availableLocales: Object.freeze([...published.keys()].sort()),
  });
}

/**
 * Replace one locale's highest-priority runtime layer through copy-on-write publication.
 *
 * Existing base layers remain shared because they are immutable. The returned snapshot is complete;
 * callers swap one reference only after validation and compilation have succeeded.
 *
 * @param snapshot Active immutable snapshot.
 * @param catalog Untrusted replacement catalog.
 * @param source Optional value-free source identifier.
 * @returns New complete snapshot containing the replacement overlay.
 * @throws An `I18nError` when the replacement is invalid.
 *
 * @example
 * ```ts
 * const initial = createCatalogSnapshot([]);
 * replaceCatalogOverlay(initial, { schema: 1, locale: 'en', messages: {} });
 * ```
 */
export function replaceCatalogOverlay(
  snapshot: CatalogSnapshot,
  catalog: CatalogInput,
  source?: string,
): CatalogSnapshot {
  const validated = defineCatalog(catalog, { source: copySource(source) });
  const overlay = compileCatalogLayer(validated, source, 'runtime');
  const locales = new Map(snapshot.locales);
  const existing = locales.get(validated.locale) ?? [];
  const baseLayers = existing.filter((layer) => layer.kind === 'base');
  locales.set(validated.locale, Object.freeze([...baseLayers, overlay]));
  return Object.freeze({
    locales: readonlyMap(locales),
    availableLocales: Object.freeze([...locales.keys()].sort()),
  });
}

/** Copy one message from an already validated catalog into a merged result. */
function copyMessage(message: Message): Message {
  if (typeof message === 'string') return message;
  return Object.freeze({
    kind: message.kind,
    parameter: message.parameter,
    cases: Object.freeze({ ...message.cases }),
  });
}

/**
 * Merge ordered locale-scoped catalogs into one validated catalog per locale.
 *
 * Locale order follows first appearance. For the same locale and key, a later input replaces the
 * earlier message. Every returned catalog and message is an independent frozen copy.
 *
 * @param inputs Ordered schema-1 catalogs, lowest priority first.
 * @returns Frozen catalogs grouped by locale in first-appearance order.
 * @throws An `I18nError` when any input catalog is invalid.
 *
 * @example
 * ```ts
 * mergeCatalogs([
 *   { schema: 1, locale: 'en', messages: { 'app.ok': 'OK' } },
 *   { schema: 1, locale: 'en', messages: { 'app.ok': 'Confirm' } },
 * ]);
 * ```
 */
export function mergeCatalogs(inputs: readonly CatalogInput[]): readonly Catalog[] {
  const copiedInputs = copyDenseArray(inputs, MAX_CATALOG_MESSAGES);
  if (copiedInputs === undefined) {
    throw new I18nError('INVALID_CATALOG', 'Catalog collection must be a dense Array.');
  }
  const merged = new Map<string, Record<string, Message>>();
  for (const input of copiedInputs) {
    const catalog = defineCatalog(input);
    let messages = merged.get(catalog.locale);
    if (messages === undefined) {
      messages = {};
      merged.set(catalog.locale, messages);
    }
    for (const [key, message] of Object.entries(catalog.messages)) {
      Object.defineProperty(messages, key, {
        configurable: true,
        enumerable: true,
        value: copyMessage(message),
        writable: true,
      });
    }
  }

  return Object.freeze(
    [...merged].map(([locale, messages]) =>
      Object.freeze({
        schema: 1,
        locale,
        messages: Object.freeze(messages),
      }),
    ),
  );
}
