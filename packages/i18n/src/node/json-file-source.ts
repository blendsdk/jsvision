import { TextDecoder } from 'node:util';
import { I18nError } from '../errors.js';
import { copyDenseArray, inspectArray, inspectOwnDataProperty, inspectOwnKeys, isObjectLike } from '../input.js';
import { MAX_CATALOG_MESSAGES, MAX_IDENTIFIER_SCALARS, MAX_MESSAGE_BYTES } from '../limits.js';
import type { Catalog, CatalogSource, CatalogSourceContext } from '../types.js';
import { defineCatalog } from '../validation.js';
import { openCheckedCatalogFile, resolveCatalogPaths } from './paths.js';
import { parseStrictJson } from './strict-json.js';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const JSON_SOURCE_FIELDS = new Set<PropertyKey>(['root', 'paths', 'required', 'limits']);
const LIMIT_FIELDS = new Set<PropertyKey>(['maxFileBytes', 'maxMessages', 'maxKeyScalars', 'maxMessageBytes']);
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/** Caller-lowerable resource limits for one rooted JSON source. */
export interface JsonFileSourceLimits {
  /** Maximum bytes read from one file; hard maximum is 2 MiB. */
  readonly maxFileBytes?: number;
  /** Maximum messages accepted in one catalog; hard maximum is 10,000. */
  readonly maxMessages?: number;
  /** Maximum Unicode scalars accepted in one message key; hard maximum is 512. */
  readonly maxKeyScalars?: number;
  /** Maximum UTF-8 bytes accepted in one message string; hard maximum is 65,536. */
  readonly maxMessageBytes?: number;
}

/** Options for a rooted Node-only JSON catalog source. */
export interface JsonFileSourceOptions {
  /** Mandatory filesystem boundary; every candidate must canonicalize below it. */
  readonly root: string;
  /** Ordered portable relative literals and immediate `*.json` globs. */
  readonly paths: readonly string[];
  /** Whether a source failure aborts {@link import('../source.js').loadI18n}; defaults to `true`. */
  readonly required?: boolean;
  /** Optional resource limits that may only lower the hard maxima. */
  readonly limits?: JsonFileSourceLimits;
}

/** Fully resolved immutable JSON source configuration. */
interface ResolvedJsonFileSourceOptions {
  /** Copied mandatory filesystem root. */
  readonly root: string;
  /** Copied path declarations. */
  readonly paths: readonly string[];
  /** Required-source classification. */
  readonly required: boolean;
  /** Effective file byte ceiling. */
  readonly maxFileBytes: number;
  /** Effective message-count ceiling. */
  readonly maxMessages: number;
  /** Effective message-key scalar ceiling. */
  readonly maxKeyScalars: number;
  /** Effective message-string byte ceiling. */
  readonly maxMessageBytes: number;
}

/** Create one value-free source configuration failure. */
function sourceFailure(message: string): I18nError {
  return new I18nError('SOURCE_FAILED', message);
}

/** Read an accessible own data property without invoking caller code. */
function dataProperty(input: object, key: PropertyKey): unknown {
  const property = inspectOwnDataProperty(input, key);
  if (!property.accessible) throw sourceFailure('JSON source options must use data properties.');
  return property.present ? property.value : undefined;
}

/** Enforce exact own data fields on one caller-owned option object. */
function validateFields(input: object, allowed: ReadonlySet<PropertyKey>): void {
  const fields = inspectOwnKeys(input);
  if (fields === undefined) throw sourceFailure('JSON source options could not be inspected safely.');
  for (const field of fields) {
    const property = inspectOwnDataProperty(input, field);
    if (!allowed.has(field) || !property.accessible) {
      throw sourceFailure('JSON source options contain an unsupported member.');
    }
  }
}

/** Resolve one non-negative safe integer that cannot exceed its hard maximum. */
function boundedLimit(value: unknown, hardMaximum: number): number {
  if (value === undefined) return hardMaximum;
  if (!Number.isSafeInteger(value) || typeof value !== 'number' || value < 0 || value > hardMaximum) {
    throw new I18nError('CATALOG_LIMIT_EXCEEDED', 'JSON source limit is outside its hard maximum.');
  }
  return value;
}

/** Copy and resolve caller-lowerable limit fields. */
function resolveLimits(
  input: unknown,
): Pick<ResolvedJsonFileSourceOptions, 'maxFileBytes' | 'maxMessages' | 'maxKeyScalars' | 'maxMessageBytes'> {
  if (input === undefined) {
    return Object.freeze({
      maxFileBytes: MAX_FILE_BYTES,
      maxKeyScalars: MAX_IDENTIFIER_SCALARS,
      maxMessageBytes: MAX_MESSAGE_BYTES,
      maxMessages: MAX_CATALOG_MESSAGES,
    });
  }
  if (!isObjectLike(input) || inspectArray(input) !== false) {
    throw sourceFailure('JSON source limits must be an object.');
  }
  validateFields(input, LIMIT_FIELDS);
  return Object.freeze({
    maxFileBytes: boundedLimit(dataProperty(input, 'maxFileBytes'), MAX_FILE_BYTES),
    maxKeyScalars: boundedLimit(dataProperty(input, 'maxKeyScalars'), MAX_IDENTIFIER_SCALARS),
    maxMessageBytes: boundedLimit(dataProperty(input, 'maxMessageBytes'), MAX_MESSAGE_BYTES),
    maxMessages: boundedLimit(dataProperty(input, 'maxMessages'), MAX_CATALOG_MESSAGES),
  });
}

/** Validate and copy the public source factory options. */
function resolveOptions(input: JsonFileSourceOptions): ResolvedJsonFileSourceOptions {
  if (!isObjectLike(input) || inspectArray(input) !== false) {
    throw sourceFailure('JSON source options must be an object.');
  }
  validateFields(input, JSON_SOURCE_FIELDS);
  const root = dataProperty(input, 'root');
  const rawPaths = dataProperty(input, 'paths');
  const pathValues = copyDenseArray(rawPaths, MAX_CATALOG_MESSAGES);
  const required = dataProperty(input, 'required');
  if (typeof root !== 'string' || root.length === 0) throw sourceFailure('JSON source root must be a string.');
  if (pathValues === undefined || pathValues.some((value) => typeof value !== 'string')) {
    throw sourceFailure('JSON source paths must be a dense string Array.');
  }
  if (required !== undefined && typeof required !== 'boolean') {
    throw sourceFailure('JSON source required flag must be boolean.');
  }
  const paths: string[] = [];
  for (const path of pathValues) {
    if (typeof path === 'string') paths.push(path);
  }
  return Object.freeze({
    ...resolveLimits(dataProperty(input, 'limits')),
    paths: Object.freeze(paths),
    required: required ?? true,
    root,
  });
}

/** Throw a value-free cancellation failure without retaining an abort reason. */
function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new I18nError('ABORTED', 'JSON catalog loading was aborted.');
  }
}

/** Read one checked handle into a bounded buffer and reject size changes. */
async function readBounded(
  handle: Awaited<ReturnType<typeof openCheckedCatalogFile>>['handle'],
  expectedSize: number,
  maximumBytes: number,
): Promise<Uint8Array> {
  if (expectedSize > maximumBytes) {
    throw new I18nError('CATALOG_LIMIT_EXCEEDED', 'Catalog file exceeds its byte limit.');
  }
  const buffer = Buffer.allocUnsafe(maximumBytes + 1);
  let total = 0;
  while (total < buffer.length) {
    const result = await handle.read(buffer, total, buffer.length - total, null);
    if (result.bytesRead === 0) break;
    total += result.bytesRead;
  }
  if (total > maximumBytes) {
    throw new I18nError('CATALOG_LIMIT_EXCEEDED', 'Catalog file exceeds its byte limit.');
  }
  if (total !== expectedSize) {
    throw new I18nError('INVALID_PATH', 'Catalog file changed while it was being read.');
  }
  return buffer.subarray(0, total);
}

/** Decode fatal UTF-8 while rejecting a leading byte-order mark. */
function decodeUtf8(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new I18nError('INVALID_UTF8', 'Catalog file must not contain a UTF-8 byte-order mark.');
  }
  try {
    return UTF8_DECODER.decode(bytes);
  } catch {
    throw new I18nError('INVALID_UTF8', 'Catalog file is not valid UTF-8.');
  }
}

/** Enforce caller-lowered catalog limits before the shared hard validation boundary. */
function enforceCatalogLimits(input: unknown, limits: ResolvedJsonFileSourceOptions): void {
  if (!isObjectLike(input) || inspectArray(input) !== false) return;
  const messagesProperty = inspectOwnDataProperty(input, 'messages');
  if (!messagesProperty.accessible || !messagesProperty.present || !isObjectLike(messagesProperty.value)) return;
  const keys = inspectOwnKeys(messagesProperty.value);
  if (keys === undefined) return;
  if (keys.length > limits.maxMessages) {
    throw new I18nError('CATALOG_LIMIT_EXCEEDED', 'Catalog exceeds the configured message limit.');
  }
  for (const key of keys) {
    if (typeof key === 'string' && [...key].length > limits.maxKeyScalars) {
      throw new I18nError('CATALOG_LIMIT_EXCEEDED', 'Catalog key exceeds the configured scalar limit.');
    }
    const messageProperty = inspectOwnDataProperty(messagesProperty.value, key);
    if (!messageProperty.accessible || !messageProperty.present) continue;
    enforceMessageLimit(messageProperty.value, limits.maxMessageBytes);
  }
}

/** Enforce a caller-lowered byte limit on a plain or structured message's strings. */
function enforceMessageLimit(input: unknown, maximumBytes: number): void {
  if (typeof input === 'string') {
    if (UTF8_ENCODER.encode(input).byteLength > maximumBytes) {
      throw new I18nError('CATALOG_LIMIT_EXCEEDED', 'Catalog message exceeds the configured byte limit.');
    }
    return;
  }
  if (!isObjectLike(input) || inspectArray(input) !== false) return;
  const casesProperty = inspectOwnDataProperty(input, 'cases');
  if (!casesProperty.accessible || !casesProperty.present || !isObjectLike(casesProperty.value)) return;
  const caseKeys = inspectOwnKeys(casesProperty.value);
  if (caseKeys === undefined) return;
  for (const caseKey of caseKeys) {
    const caseProperty = inspectOwnDataProperty(casesProperty.value, caseKey);
    if (caseProperty.accessible && caseProperty.present && typeof caseProperty.value === 'string') {
      enforceMessageLimit(caseProperty.value, maximumBytes);
    }
  }
}

/** Load, decode, parse, bound, and validate every resolved file in order. */
async function loadCatalogs(
  options: ResolvedJsonFileSourceOptions,
  context: CatalogSourceContext,
): Promise<readonly Catalog[]> {
  assertNotAborted(context.signal);
  const paths = await resolveCatalogPaths(options.root, options.paths);
  const catalogs: Catalog[] = [];
  for (const path of paths) {
    assertNotAborted(context.signal);
    const checked = await openCheckedCatalogFile(path);
    try {
      const bytes = await readBounded(checked.handle, checked.size, options.maxFileBytes);
      assertNotAborted(context.signal);
      const parsed = parseStrictJson(decodeUtf8(bytes));
      enforceCatalogLimits(parsed, options);
      catalogs.push(defineCatalog(parsed, { source: path.relativePath }));
    } finally {
      await checked.handle.close().catch(() => undefined);
    }
  }
  return Object.freeze(catalogs);
}

/**
 * Create a Node-only source for rooted schema-1 JSON catalog files.
 *
 * Paths use a portable relative grammar. Literal files retain declaration order and an immediate
 * `*.json` glob expands lexically in place. Every file is canonicalized below the mandatory root,
 * opened as a checked regular handle, read within its byte limit, decoded as fatal UTF-8, parsed
 * with duplicate detection, and validated before the source returns any catalog.
 *
 * @param input Root, paths, required classification, and optional lower resource limits.
 * @returns Caller-independent catalog source suitable for `loadI18n`.
 * @throws {@link I18nError} when factory options or attempted limit increases are invalid.
 *
 * @example
 * ```ts
 * const source = jsonFileSource({
 *   root: new URL('./locales', import.meta.url).pathname,
 *   paths: ['en.json', 'packages/*.json'],
 * });
 * ```
 */
export function jsonFileSource(input: JsonFileSourceOptions): CatalogSource {
  const options = resolveOptions(input);
  return Object.freeze({
    name: 'json-file',
    required: options.required,
    load(context: CatalogSourceContext) {
      return loadCatalogs(options, context);
    },
  });
}
