import { I18nError } from './errors.js';
import { copyDenseArray, inspectArray, inspectOwnDataProperty, inspectOwnKeys, isObjectLike } from './input.js';
import { createPluralRules } from './intl.js';
import {
  MAX_CATALOG_CASE_NAME_BYTES,
  MAX_CATALOG_MESSAGES,
  MAX_CATALOG_MESSAGE_BYTES,
  MAX_CATALOG_STRUCTURED_CASES,
  MAX_IDENTIFIER_SCALARS,
  MAX_MESSAGE_BYTES,
  MAX_STRUCTURED_CASES,
} from './limits.js';
import { canonicalizeCatalogLocale } from './locale.js';
import { compileMessage, compileTemplate, isSafeText } from './messages.js';
import { MESSAGE_KEY_PATTERN, PARAMETER_PATTERN } from './grammar.js';
import { resolveValidationOptions, safeSource } from './validation-options.js';
import {
  CATALOG_SCHEMA_VERSION,
  type Catalog,
  type CatalogInput,
  type CatalogIssue,
  type CatalogValidationOptions,
  type I18nCode,
  type I18nSeverity,
  type Message,
  type MessageCases,
} from './types.js';

const CATALOG_FIELDS = new Set<PropertyKey>(['schema', 'locale', 'messages']);
const STRUCTURED_MESSAGE_FIELDS = new Set<PropertyKey>(['kind', 'parameter', 'cases']);
const ASCII_LETTER_PATTERN = /^[A-Za-z]$/u;
const INVALID_PATH_SEGMENT = '<invalid>';
const UTF8_ENCODER = new TextEncoder();

/** Mutable state used only while validating one catalog. */
interface ValidationContext {
  /** Canonical locale when it can be established safely. */
  locale?: string;
  /** Value-free caller source included in issues when safe. */
  readonly source?: string;
  /** Issues collected before stable sorting and freezing. */
  readonly issues: CatalogIssue[];
  /** Aggregate message bytes observed while copying this catalog. */
  messageBytes: number;
  /** Stops further message processing after the aggregate text ceiling is crossed. */
  messageLimitExceeded: boolean;
  /** Aggregate number of structured cases observed across this catalog. */
  structuredCases: number;
  /** Aggregate UTF-8 bytes used by structured case names. */
  caseNameBytes: number;
  /** Locale cardinal categories resolved lazily at most once per catalog. */
  pluralCategories?: ReadonlySet<string>;
}

/** A base validation result with a copied catalog only when structural validation succeeded. */
interface CatalogValidationResult {
  /** Immutable copied catalog, absent when a blocking issue exists. */
  readonly catalog?: Catalog;
  /** Mutable issue list retained for completeness checks. */
  readonly issues: CatalogIssue[];
}

/** Result of parsing accelerator markup in one label. */
type AcceleratorResult =
  | { readonly state: 'present'; readonly accelerator: string }
  | { readonly state: 'absent' }
  | { readonly state: 'malformed' };

/** Read one descriptor while containing failures from hostile proxy traps. */
function ownDescriptor(value: object, key: PropertyKey): PropertyDescriptor | undefined {
  const property = inspectOwnDataProperty(value, key);
  return property.accessible && property.present ? { value: property.value } : undefined;
}

/** Read one own data property without invoking an accessor or walking a prototype. */
function readDataProperty(value: object, key: PropertyKey): unknown {
  const property = inspectOwnDataProperty(value, key);
  return property.accessible && property.present ? property.value : undefined;
}

/** Safely enumerate own keys, converting proxy failures into an invalid shape. */
function ownKeys(value: object): readonly PropertyKey[] | undefined {
  return inspectOwnKeys(value);
}

/** Keep issue locations safe and bounded even when the input key itself is malformed. */
function safePathSegment(value: string): string {
  return isSafeText(value) && [...value].length <= MAX_IDENTIFIER_SCALARS ? value : INVALID_PATH_SEGMENT;
}

/** Add one frozen, value-free issue to the current validation result. */
function addIssue(
  context: ValidationContext,
  code: I18nCode,
  path: readonly string[],
  severity: I18nSeverity = 'error',
  key?: string,
): void {
  const safeKey = key === undefined ? undefined : safePathSegment(key);
  context.issues.push(
    Object.freeze({
      code,
      severity,
      path: Object.freeze([...path]),
      ...(context.locale === undefined ? {} : { locale: context.locale }),
      ...(safeKey === undefined ? {} : { key: safeKey }),
      ...(context.source === undefined ? {} : { source: context.source }),
    }),
  );
}

/** Check that an object exposes exactly the expected own string data properties. */
function hasExactDataFields(
  value: object,
  expected: ReadonlySet<PropertyKey>,
  context: ValidationContext,
  path: readonly string[],
  code: 'INVALID_CATALOG' | 'INVALID_MESSAGE',
): boolean {
  const keys = ownKeys(value);
  if (keys === undefined) {
    addIssue(context, code, path);
    return false;
  }

  let valid = keys.length === expected.size;
  for (const key of keys) {
    const descriptor = ownDescriptor(value, key);
    if (!expected.has(key) || descriptor === undefined || !('value' in descriptor)) {
      valid = false;
      addIssue(context, code, [...path, typeof key === 'string' ? safePathSegment(key) : INVALID_PATH_SEGMENT]);
    }
  }
  for (const key of expected) {
    if (ownDescriptor(value, key) === undefined) {
      valid = false;
      addIssue(context, code, [...path, String(key)]);
    }
  }
  return valid;
}

/** Validate terminal safety, placeholders, and the per-string byte limit. */
function validateMessageText(value: string, context: ValidationContext, path: readonly string[], key: string): boolean {
  if (context.messageLimitExceeded) return false;

  let valid = true;
  if (!isSafeText(value)) {
    addIssue(context, 'UNSAFE_TEXT', path, 'error', key);
    valid = false;
  }
  const messageBytes = UTF8_ENCODER.encode(value).byteLength;
  if (messageBytes > MAX_MESSAGE_BYTES) {
    addIssue(context, 'CATALOG_LIMIT_EXCEEDED', path, 'error', key);
    valid = false;
  }
  const previousBytes = context.messageBytes;
  context.messageBytes += messageBytes;
  if (previousBytes <= MAX_CATALOG_MESSAGE_BYTES && context.messageBytes > MAX_CATALOG_MESSAGE_BYTES) {
    context.messageLimitExceeded = true;
    addIssue(context, 'CATALOG_LIMIT_EXCEEDED', ['messages'], 'error', key);
    return false;
  }
  if (valid) {
    try {
      compileTemplate(value);
    } catch (error) {
      addIssue(context, error instanceof I18nError ? error.code : 'INVALID_MESSAGE', path, 'error', key);
      valid = false;
    }
  }
  return valid;
}

/** Validate and copy a structured message's case object without invoking accessors. */
function validateCases(
  input: unknown,
  kind: 'plural' | 'select',
  locale: string,
  context: ValidationContext,
  path: readonly string[],
  key: string,
): MessageCases | undefined {
  if (!isObjectLike(input) || inspectArray(input) !== false) {
    addIssue(context, 'INVALID_MESSAGE', path, 'error', key);
    return undefined;
  }

  const keys = ownKeys(input);
  if (keys === undefined) {
    addIssue(context, 'INVALID_MESSAGE', path, 'error', key);
    return undefined;
  }
  if (keys.length > MAX_STRUCTURED_CASES) {
    addIssue(context, 'CATALOG_LIMIT_EXCEEDED', path, 'error', key);
    return undefined;
  }
  context.structuredCases += keys.length;
  if (context.structuredCases > MAX_CATALOG_STRUCTURED_CASES) {
    addIssue(context, 'CATALOG_LIMIT_EXCEEDED', path, 'error', key);
    return undefined;
  }

  const pluralCategories: ReadonlySet<string> | undefined =
    kind === 'plural'
      ? (context.pluralCategories ??= new Set<string>(createPluralRules(locale).resolvedOptions().pluralCategories))
      : undefined;
  const copied: Record<string, string> = {};
  let valid = true;

  for (const caseKey of keys) {
    if (typeof caseKey !== 'string' || [...caseKey].length > MAX_IDENTIFIER_SCALARS || !isSafeText(caseKey)) {
      addIssue(context, 'INVALID_MESSAGE', [...path, INVALID_PATH_SEGMENT], 'error', key);
      valid = false;
      continue;
    }
    context.caseNameBytes += UTF8_ENCODER.encode(caseKey).byteLength;
    if (context.caseNameBytes > MAX_CATALOG_CASE_NAME_BYTES) {
      addIssue(context, 'CATALOG_LIMIT_EXCEEDED', path, 'error', key);
      return undefined;
    }
    const casePath = [...path, safePathSegment(caseKey)];
    const descriptor = ownDescriptor(input, caseKey);
    if (descriptor === undefined || !('value' in descriptor) || typeof descriptor.value !== 'string') {
      addIssue(context, 'INVALID_MESSAGE', casePath, 'error', key);
      valid = false;
      continue;
    }
    if (kind === 'plural' && !pluralCategories?.has(caseKey)) {
      addIssue(context, 'INVALID_MESSAGE', casePath, 'error', key);
      valid = false;
    }
    if (!validateMessageText(descriptor.value, context, casePath, key)) {
      valid = false;
      if (context.messageLimitExceeded) return undefined;
      continue;
    }
    Object.defineProperty(copied, caseKey, {
      configurable: false,
      enumerable: true,
      value: descriptor.value,
      writable: false,
    });
  }

  const other = readDataProperty(input, 'other');
  if (ownDescriptor(input, 'other') === undefined || typeof other !== 'string') {
    addIssue(context, 'INVALID_MESSAGE', [...path, 'other'], 'error', key);
    valid = false;
  }
  return valid && typeof other === 'string' ? Object.freeze({ ...copied, other }) : undefined;
}

/** Validate and copy one message into its schema representation. */
function validateMessage(
  input: unknown,
  locale: string,
  context: ValidationContext,
  path: readonly string[],
  key: string,
): Message | undefined {
  if (typeof input === 'string') {
    return validateMessageText(input, context, path, key) ? input : undefined;
  }
  if (!isObjectLike(input) || inspectArray(input) !== false) {
    addIssue(context, 'INVALID_MESSAGE', path, 'error', key);
    return undefined;
  }

  const exact = hasExactDataFields(input, STRUCTURED_MESSAGE_FIELDS, context, path, 'INVALID_MESSAGE');
  const kind = readDataProperty(input, 'kind');
  const parameter = readDataProperty(input, 'parameter');
  const rawCases = readDataProperty(input, 'cases');
  let valid = exact;

  if (kind !== 'plural' && kind !== 'select') {
    addIssue(context, 'INVALID_MESSAGE', [...path, 'kind'], 'error', key);
    valid = false;
  }
  if (typeof parameter !== 'string' || !PARAMETER_PATTERN.test(parameter)) {
    addIssue(context, 'INVALID_PARAMETER', [...path, 'parameter'], 'error', key);
    valid = false;
  }
  if (kind !== 'plural' && kind !== 'select') return undefined;

  const cases = validateCases(rawCases, kind, locale, context, [...path, 'cases'], key);
  if (cases === undefined) valid = false;
  if (!valid || typeof parameter !== 'string' || cases === undefined) return undefined;

  return kind === 'plural'
    ? Object.freeze({ kind: 'plural', parameter, cases })
    : Object.freeze({ kind: 'select', parameter, cases });
}

/** Validate one catalog's schema and create an immutable deep copy. */
function validateCatalogBase(input: CatalogInput, options: CatalogValidationOptions): CatalogValidationResult {
  const context: ValidationContext = {
    caseNameBytes: 0,
    issues: [],
    messageBytes: 0,
    messageLimitExceeded: false,
    source: safeSource(options.source),
    structuredCases: 0,
  };
  if (!isObjectLike(input) || inspectArray(input) !== false) {
    addIssue(context, 'INVALID_CATALOG', []);
    return { issues: context.issues };
  }

  const exact = hasExactDataFields(input, CATALOG_FIELDS, context, [], 'INVALID_CATALOG');
  const schema = readDataProperty(input, 'schema');
  if (schema !== CATALOG_SCHEMA_VERSION) {
    addIssue(context, 'UNSUPPORTED_SCHEMA', ['schema']);
  }

  const localeValue = readDataProperty(input, 'locale');
  if (typeof localeValue === 'string') {
    try {
      context.locale = canonicalizeCatalogLocale(localeValue);
    } catch {
      addIssue(context, 'INVALID_LOCALE', ['locale']);
    }
  } else {
    addIssue(context, 'INVALID_LOCALE', ['locale']);
  }

  const rawMessages = readDataProperty(input, 'messages');
  if (!isObjectLike(rawMessages) || inspectArray(rawMessages) !== false) {
    addIssue(context, 'INVALID_CATALOG', ['messages']);
    return { issues: context.issues };
  }
  const messageKeys = ownKeys(rawMessages);
  if (messageKeys === undefined) {
    addIssue(context, 'INVALID_CATALOG', ['messages']);
    return { issues: context.issues };
  }
  if (messageKeys.length > MAX_CATALOG_MESSAGES) {
    addIssue(context, 'CATALOG_LIMIT_EXCEEDED', ['messages']);
  }

  const copiedMessages: Record<string, Message> = {};
  let messagesValid = messageKeys.length <= MAX_CATALOG_MESSAGES;
  for (const messageKey of messageKeys.slice(0, MAX_CATALOG_MESSAGES + 1)) {
    if (typeof messageKey !== 'string') {
      addIssue(context, 'INVALID_KEY', ['messages', INVALID_PATH_SEGMENT]);
      messagesValid = false;
      continue;
    }
    const safeKey = safePathSegment(messageKey);
    const keyPath = ['messages', safeKey];
    const descriptor = ownDescriptor(rawMessages, messageKey);
    if (
      !MESSAGE_KEY_PATTERN.test(messageKey) ||
      [...messageKey].length > MAX_IDENTIFIER_SCALARS ||
      !isSafeText(messageKey)
    ) {
      addIssue(context, 'INVALID_KEY', keyPath, 'error', messageKey);
      messagesValid = false;
      continue;
    }
    if (descriptor === undefined || !('value' in descriptor)) {
      addIssue(context, 'INVALID_MESSAGE', keyPath, 'error', messageKey);
      messagesValid = false;
      continue;
    }
    if (context.locale === undefined) {
      messagesValid = false;
      continue;
    }
    const message = validateMessage(descriptor.value, context.locale, context, keyPath, messageKey);
    if (message === undefined) {
      messagesValid = false;
      if (context.messageLimitExceeded) break;
      continue;
    }
    Object.defineProperty(copiedMessages, messageKey, {
      configurable: false,
      enumerable: true,
      value: message,
      writable: false,
    });
  }

  const hasErrors = context.issues.some((issue) => issue.severity === 'error');
  if (!exact || schema !== CATALOG_SCHEMA_VERSION || context.locale === undefined || !messagesValid || hasErrors) {
    return { issues: context.issues };
  }
  return {
    catalog: Object.freeze({
      schema: CATALOG_SCHEMA_VERSION,
      locale: context.locale,
      messages: Object.freeze(copiedMessages),
    }),
    issues: context.issues,
  };
}

/** Return the public message kind used by strict parity checks. */
function messageKind(message: Message): 'text' | 'plural' | 'select' {
  return typeof message === 'string' ? 'text' : message.kind;
}

/** Extract every substitution placeholder from a validated message. */
function messagePlaceholders(message: Message): ReadonlySet<string> {
  const compiled = compileMessage(message);
  const templates = compiled.kind === 'text' ? [compiled.template] : Array.from(compiled.cases.values());
  const names = new Set<string>();
  for (const template of templates) {
    for (const token of template.tokens) {
      if (token.kind === 'parameter') names.add(token.name);
    }
  }
  return names;
}

/** Compare two sets without depending on insertion order. */
function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

/** Read a manifest entry as a copied set of valid parameter names. */
function manifestPlaceholders(
  manifest: CatalogValidationOptions['placeholderManifest'],
  key: string,
): ReadonlySet<string> | undefined {
  if (manifest === undefined || !isObjectLike(manifest)) return undefined;
  const value = readDataProperty(manifest, key);
  const names = copyDenseArray(value, MAX_CATALOG_MESSAGES);
  if (names === undefined || names.some((name) => typeof name !== 'string' || !PARAMETER_PATTERN.test(name))) {
    return undefined;
  }
  return new Set(names.filter((name): name is string => typeof name === 'string'));
}

/** Parse one required `~X~` accelerator while accepting `~~` as a literal tilde. */
function parseAccelerator(label: string): AcceleratorResult {
  let accelerator: string | undefined;
  for (let index = 0; index < label.length; index += 1) {
    if (label[index] !== '~') continue;
    if (label[index + 1] === '~') {
      index += 1;
      continue;
    }
    const marked = label[index + 1];
    if (
      marked === undefined ||
      label[index + 2] !== '~' ||
      !ASCII_LETTER_PATTERN.test(marked) ||
      accelerator !== undefined
    ) {
      return { state: 'malformed' };
    }
    accelerator = marked.toLowerCase();
    index += 2;
  }
  return accelerator === undefined ? { state: 'absent' } : { state: 'present', accelerator };
}

/** Add strict key, kind, and placeholder parity issues. */
function validateCompleteness(catalog: Catalog, options: CatalogValidationOptions, context: ValidationContext): void {
  if (options.mode !== 'strict') return;

  let reference: Catalog | undefined;
  if (options.referenceCatalog !== undefined) {
    const referenceResult = validateCatalogBase(options.referenceCatalog, {});
    reference = referenceResult.catalog;
    for (const issue of referenceResult.issues) {
      addIssue(context, issue.code, ['referenceCatalog', ...issue.path], 'error', issue.key);
    }
  }
  const expectedKeys = new Set<string>();
  if (reference !== undefined) {
    for (const key of Object.keys(reference.messages)) expectedKeys.add(key);
  }
  for (const key of options.referenceKeys ?? []) {
    if (typeof key === 'string' && MESSAGE_KEY_PATTERN.test(key)) expectedKeys.add(key);
  }

  for (const key of expectedKeys) {
    const actual = catalog.messages[key];
    if (actual === undefined) {
      addIssue(context, 'INVALID_CATALOG', ['messages', key], 'error', key);
      continue;
    }
    const referenceMessage = reference?.messages[key];
    if (referenceMessage !== undefined && messageKind(referenceMessage) !== messageKind(actual)) {
      addIssue(context, 'INVALID_MESSAGE', ['messages', key, 'kind'], 'error', key);
    }
    const expectedPlaceholders =
      manifestPlaceholders(options.placeholderManifest, key) ??
      (referenceMessage === undefined ? undefined : messagePlaceholders(referenceMessage));
    if (expectedPlaceholders !== undefined && !sameSet(expectedPlaceholders, messagePlaceholders(actual))) {
      addIssue(context, 'INVALID_PARAMETER', ['messages', key, 'placeholders'], 'error', key);
    }
  }

  if (expectedKeys.size > 0) {
    for (const key of Object.keys(catalog.messages)) {
      if (!expectedKeys.has(key)) {
        addIssue(context, 'INVALID_CATALOG', ['messages', key], 'error', key);
      }
    }
  }
}

/** Add malformed and colliding accelerator issues for declared co-visibility scopes. */
function validateAccelerators(catalog: Catalog, options: CatalogValidationOptions, context: ValidationContext): void {
  const manifest = options.acceleratorManifest;
  if (manifest === undefined || !isObjectLike(manifest)) return;
  const scopes = readDataProperty(manifest, 'scopes');
  const scopeValues = copyDenseArray(scopes, MAX_CATALOG_MESSAGES);
  if (scopeValues === undefined) return;
  const severity: I18nSeverity = options.official === true || options.mode === 'strict' ? 'error' : 'warning';

  for (const scope of scopeValues) {
    if (
      !isObjectLike(scope) ||
      typeof readDataProperty(scope, 'name') !== 'string' ||
      inspectArray(readDataProperty(scope, 'keys')) !== true
    ) {
      addIssue(context, 'INVALID_CATALOG', ['acceleratorManifest']);
      continue;
    }
    const scopeName = readDataProperty(scope, 'name');
    const keys = readDataProperty(scope, 'keys');
    const requiredKeysValue = readDataProperty(scope, 'requiredKeys');
    if (typeof scopeName !== 'string') continue;
    const keyValues = copyDenseArray(keys, MAX_CATALOG_MESSAGES);
    if (keyValues === undefined) continue;
    const requiredValues =
      requiredKeysValue === undefined ? keyValues : copyDenseArray(requiredKeysValue, MAX_CATALOG_MESSAGES);
    if (requiredValues === undefined) continue;
    const requiredKeys = new Set(requiredValues.filter((key): key is string => typeof key === 'string'));

    const claimed = new Map<string, string>();
    for (const key of keyValues) {
      if (typeof key !== 'string') {
        addIssue(context, 'INVALID_CATALOG', ['acceleratorManifest', safePathSegment(scopeName)]);
        continue;
      }
      const message = catalog.messages[key];
      const parsed = typeof message === 'string' ? parseAccelerator(message) : { state: 'malformed' as const };
      if (parsed.state === 'malformed' || (parsed.state === 'absent' && requiredKeys.has(key))) {
        addIssue(context, 'INVALID_MESSAGE', ['messages', safePathSegment(key), 'accelerator'], severity, key);
        continue;
      }
      if (parsed.state === 'absent') continue;
      if (claimed.has(parsed.accelerator)) {
        addIssue(context, 'INVALID_MESSAGE', ['messages', safePathSegment(key), 'accelerator'], severity, key);
      } else {
        claimed.set(parsed.accelerator, key);
      }
    }
  }
}

/** Sort and freeze issues so repeated validation has byte-stable output. */
function publishIssues(issues: readonly CatalogIssue[]): readonly CatalogIssue[] {
  const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
  return Object.freeze(
    [...issues].sort((left, right) => {
      const pathOrder = compare(left.path.join('\u0000'), right.path.join('\u0000'));
      if (pathOrder !== 0) return pathOrder;
      const codeOrder = compare(left.code, right.code);
      if (codeOrder !== 0) return codeOrder;
      return compare(left.severity, right.severity);
    }),
  );
}

/**
 * Validate one untrusted catalog without throwing.
 *
 * @param input Candidate schema-1 catalog.
 * @param options Completeness, accelerator, and value-free source metadata.
 * @returns Immutable, stably sorted structural issues.
 *
 * @example
 * ```ts
 * const issues = validateCatalog({ schema: 1, locale: 'en', messages: {} });
 * ```
 */
export function validateCatalog(input: CatalogInput, options: CatalogValidationOptions = {}): readonly CatalogIssue[] {
  const resolved = resolveValidationOptions(options);
  if (resolved.issues.length > 0) return publishIssues(resolved.issues);
  const result = validateCatalogBase(input, resolved.options);
  if (result.catalog !== undefined) {
    const context: ValidationContext = {
      caseNameBytes: 0,
      issues: result.issues,
      locale: result.catalog.locale,
      messageBytes: 0,
      messageLimitExceeded: false,
      source: safeSource(resolved.options.source),
      structuredCases: 0,
    };
    validateCompleteness(result.catalog, resolved.options, context);
    validateAccelerators(result.catalog, resolved.options, context);
  }
  return publishIssues(result.issues);
}

/**
 * Validate an ordered catalog collection with one shared policy.
 *
 * @param inputs Candidate schema-1 catalogs.
 * @param options Completeness, accelerator, and value-free source metadata.
 * @returns Immutable, stably sorted issues from every catalog.
 *
 * @example
 * ```ts
 * validateCatalogs([{ schema: 1, locale: 'en', messages: {} }]);
 * ```
 */
export function validateCatalogs(
  inputs: readonly CatalogInput[],
  options: CatalogValidationOptions = {},
): readonly CatalogIssue[] {
  const resolved = resolveValidationOptions(options);
  if (resolved.issues.length > 0) return publishIssues(resolved.issues);
  const copiedInputs = copyDenseArray(inputs, MAX_CATALOG_MESSAGES);
  if (copiedInputs === undefined) {
    return publishIssues([
      Object.freeze({
        code: 'INVALID_CATALOG',
        severity: 'error',
        path: Object.freeze([]),
        ...(safeSource(resolved.options.source) === undefined ? {} : { source: safeSource(resolved.options.source) }),
      }),
    ]);
  }
  return publishIssues(copiedInputs.flatMap((input) => validateCatalog(input, resolved.options)));
}

/**
 * Validate and deep-copy one catalog for safe publication.
 *
 * @param input Candidate schema-1 catalog.
 * @param options Completeness and accelerator validation policy.
 * @returns Frozen catalog with a canonical locale and copied messages.
 * @throws {@link I18nError} when any blocking issue exists.
 *
 * @example
 * ```ts
 * const catalog = defineCatalog({ schema: 1, locale: 'nl-nl', messages: {} });
 * ```
 */
export function defineCatalog(input: CatalogInput, options: CatalogValidationOptions = {}): Catalog {
  const resolved = resolveValidationOptions(options);
  if (resolved.issues.length > 0) {
    throw new I18nError('INVALID_CATALOG', 'Catalog validation options are invalid.', {
      issues: publishIssues(resolved.issues),
    });
  }
  const result = validateCatalogBase(input, resolved.options);
  if (result.catalog !== undefined) {
    const context: ValidationContext = {
      caseNameBytes: 0,
      issues: result.issues,
      locale: result.catalog.locale,
      messageBytes: 0,
      messageLimitExceeded: false,
      source: safeSource(resolved.options.source),
      structuredCases: 0,
    };
    validateCompleteness(result.catalog, resolved.options, context);
    validateAccelerators(result.catalog, resolved.options, context);
  }
  const issues = publishIssues(result.issues);
  const firstError = issues.find((issue) => issue.severity === 'error');
  if (result.catalog === undefined || firstError !== undefined) {
    throw new I18nError(firstError?.code ?? 'INVALID_CATALOG', 'Catalog validation failed.', { issues });
  }
  return result.catalog;
}
