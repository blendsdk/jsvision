import { MESSAGE_KEY_PATTERN, PARAMETER_PATTERN } from './grammar.js';
import { copyDenseArray, inspectArray, inspectOwnDataProperty, inspectOwnKeys, isObjectLike } from './input.js';
import { MAX_CATALOG_MESSAGES, MAX_IDENTIFIER_SCALARS } from './limits.js';
import { isSafeText } from './messages.js';
import type { AcceleratorScope, CatalogIssue, CatalogValidationMode, CatalogValidationOptions } from './types.js';

const VALIDATION_OPTION_FIELDS = new Set<PropertyKey>([
  'mode',
  'referenceCatalog',
  'referenceKeys',
  'placeholderManifest',
  'acceleratorManifest',
  'official',
  'source',
]);
const ACCELERATOR_MANIFEST_FIELDS = new Set<PropertyKey>(['scopes']);
const ACCELERATOR_SCOPE_FIELDS = new Set<PropertyKey>(['name', 'keys', 'requiredKeys']);
const INVALID_PATH_SEGMENT = '<invalid>';

/** Copied validation policy plus structural option issues. */
export interface ValidationOptionResolution {
  /** Safe policy object that retains no caller-owned containers. */
  readonly options: CatalogValidationOptions;
  /** Blocking issues found while copying the policy. */
  readonly issues: readonly CatalogIssue[];
}

/** Keep issue locations safe and bounded even when an option key itself is malformed. */
function safePathSegment(value: string): string {
  return isSafeText(value) && [...value].length <= MAX_IDENTIFIER_SCALARS ? value : INVALID_PATH_SEGMENT;
}

/** Validate a public message key with the shared grammar, scalar bound, and text policy. */
function isValidMessageKey(value: string): boolean {
  return MESSAGE_KEY_PATTERN.test(value) && [...value].length <= MAX_IDENTIFIER_SCALARS && isSafeText(value);
}

/**
 * Copy a safe source identifier or omit an unsafe/unbounded one.
 *
 * @param value Untrusted source metadata.
 * @returns Safe source text, or `undefined`.
 */
export function safeSource(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 256 && isSafeText(value) ? value : undefined;
}

/** Add one value-free validation-policy issue. */
function addOptionIssue(issues: CatalogIssue[], path: readonly string[]): void {
  issues.push(
    Object.freeze({
      code: 'INVALID_CATALOG',
      severity: 'error',
      path: Object.freeze(['options', ...path]),
    }),
  );
}

/** Copy a dense string array through descriptors and validate every member. */
function copyStringArray(
  input: unknown,
  issues: CatalogIssue[],
  path: readonly string[],
  validate: (value: string) => boolean,
): readonly string[] | undefined {
  const values = copyDenseArray(input, MAX_CATALOG_MESSAGES);
  if (values === undefined) {
    addOptionIssue(issues, path);
    return undefined;
  }
  const copied: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (typeof value !== 'string' || !validate(value)) {
      addOptionIssue(issues, [...path, String(index)]);
      continue;
    }
    copied.push(value);
  }
  return Object.freeze(copied);
}

/** Copy the placeholder manifest without retaining arrays or invoking accessors. */
function copyPlaceholderManifest(
  input: unknown,
  issues: CatalogIssue[],
): CatalogValidationOptions['placeholderManifest'] {
  if (!isObjectLike(input) || inspectArray(input) !== false) {
    addOptionIssue(issues, ['placeholderManifest']);
    return undefined;
  }
  const keys = inspectOwnKeys(input);
  if (keys === undefined || keys.length > MAX_CATALOG_MESSAGES) {
    addOptionIssue(issues, ['placeholderManifest']);
    return undefined;
  }

  const copied: Record<string, readonly string[]> = {};
  for (const key of keys) {
    if (typeof key !== 'string' || !isValidMessageKey(key)) {
      addOptionIssue(issues, [
        'placeholderManifest',
        typeof key === 'string' ? safePathSegment(key) : INVALID_PATH_SEGMENT,
      ]);
      continue;
    }
    const property = inspectOwnDataProperty(input, key);
    if (!property.accessible || !property.present) {
      addOptionIssue(issues, ['placeholderManifest', key]);
      continue;
    }
    const names = copyStringArray(property.value, issues, ['placeholderManifest', key], (name) =>
      PARAMETER_PATTERN.test(name),
    );
    if (names !== undefined) {
      Object.defineProperty(copied, key, {
        configurable: false,
        enumerable: true,
        value: names,
        writable: false,
      });
    }
  }
  return Object.freeze(copied);
}

/** Copy one accelerator scope through exact own data fields. */
function copyAcceleratorScope(input: unknown, issues: CatalogIssue[], index: number): AcceleratorScope | undefined {
  const path = ['acceleratorManifest', 'scopes', String(index)];
  if (!isObjectLike(input) || inspectArray(input) !== false) {
    addOptionIssue(issues, path);
    return undefined;
  }
  const fields = inspectOwnKeys(input);
  if (
    fields === undefined ||
    fields.some((field) => !ACCELERATOR_SCOPE_FIELDS.has(field)) ||
    !fields.includes('name') ||
    !fields.includes('keys')
  ) {
    addOptionIssue(issues, path);
    return undefined;
  }

  const nameProperty = inspectOwnDataProperty(input, 'name');
  const keysProperty = inspectOwnDataProperty(input, 'keys');
  const requiredProperty = inspectOwnDataProperty(input, 'requiredKeys');
  if (
    !nameProperty.accessible ||
    !nameProperty.present ||
    typeof nameProperty.value !== 'string' ||
    nameProperty.value.length === 0 ||
    nameProperty.value.length > 256 ||
    !isSafeText(nameProperty.value)
  ) {
    addOptionIssue(issues, [...path, 'name']);
    return undefined;
  }
  if (!keysProperty.accessible || !keysProperty.present) {
    addOptionIssue(issues, [...path, 'keys']);
    return undefined;
  }
  if (!requiredProperty.accessible) {
    addOptionIssue(issues, [...path, 'requiredKeys']);
    return undefined;
  }

  const keys = copyStringArray(keysProperty.value, issues, [...path, 'keys'], isValidMessageKey);
  const requiredKeys = requiredProperty.present
    ? copyStringArray(requiredProperty.value, issues, [...path, 'requiredKeys'], isValidMessageKey)
    : undefined;
  if (keys === undefined || (requiredProperty.present && requiredKeys === undefined)) return undefined;

  const keySet = new Set(keys);
  if (requiredKeys?.some((key) => !keySet.has(key))) {
    addOptionIssue(issues, [...path, 'requiredKeys']);
    return undefined;
  }
  return Object.freeze({
    name: nameProperty.value,
    keys,
    ...(requiredKeys === undefined ? {} : { requiredKeys }),
  });
}

/** Copy the accelerator manifest without executing caller iteration or accessors. */
function copyAcceleratorManifest(
  input: unknown,
  issues: CatalogIssue[],
): CatalogValidationOptions['acceleratorManifest'] {
  if (!isObjectLike(input) || inspectArray(input) !== false) {
    addOptionIssue(issues, ['acceleratorManifest']);
    return undefined;
  }
  const fields = inspectOwnKeys(input);
  if (
    fields === undefined ||
    fields.length !== ACCELERATOR_MANIFEST_FIELDS.size ||
    fields.some((field) => !ACCELERATOR_MANIFEST_FIELDS.has(field))
  ) {
    addOptionIssue(issues, ['acceleratorManifest']);
    return undefined;
  }
  const scopesProperty = inspectOwnDataProperty(input, 'scopes');
  if (!scopesProperty.accessible || !scopesProperty.present) {
    addOptionIssue(issues, ['acceleratorManifest', 'scopes']);
    return undefined;
  }
  const scopes = copyDenseArray(scopesProperty.value, MAX_CATALOG_MESSAGES);
  if (scopes === undefined) {
    addOptionIssue(issues, ['acceleratorManifest', 'scopes']);
    return undefined;
  }

  const copied = scopes
    .map((scope, index) => copyAcceleratorScope(scope, issues, index))
    .filter((scope) => scope !== undefined);
  return Object.freeze({ scopes: Object.freeze(copied) });
}

/**
 * Validate and deep-copy every public catalog-validation option.
 *
 * @param input Untrusted policy object.
 * @returns Safe copied options and value-free blocking issues.
 */
export function resolveValidationOptions(input: unknown): ValidationOptionResolution {
  const issues: CatalogIssue[] = [];
  if (!isObjectLike(input) || inspectArray(input) !== false) {
    addOptionIssue(issues, []);
    return { options: {}, issues };
  }
  const fields = inspectOwnKeys(input);
  if (fields === undefined) {
    addOptionIssue(issues, []);
    return { options: {}, issues };
  }

  const values = new Map<PropertyKey, unknown>();
  for (const field of fields) {
    const property = inspectOwnDataProperty(input, field);
    if (!VALIDATION_OPTION_FIELDS.has(field) || !property.accessible || !property.present) {
      addOptionIssue(issues, [typeof field === 'string' ? safePathSegment(field) : INVALID_PATH_SEGMENT]);
      continue;
    }
    values.set(field, property.value);
  }

  const mode = values.get('mode');
  if (mode !== undefined && mode !== 'partial' && mode !== 'strict') addOptionIssue(issues, ['mode']);
  const official = values.get('official');
  if (official !== undefined && typeof official !== 'boolean') addOptionIssue(issues, ['official']);
  const source = values.get('source');
  if (source !== undefined && safeSource(source) === undefined) addOptionIssue(issues, ['source']);

  const referenceKeysValue = values.get('referenceKeys');
  const referenceKeys =
    referenceKeysValue === undefined
      ? undefined
      : copyStringArray(referenceKeysValue, issues, ['referenceKeys'], isValidMessageKey);
  const placeholderValue = values.get('placeholderManifest');
  const placeholderManifest =
    placeholderValue === undefined ? undefined : copyPlaceholderManifest(placeholderValue, issues);
  const acceleratorValue = values.get('acceleratorManifest');
  const acceleratorManifest =
    acceleratorValue === undefined ? undefined : copyAcceleratorManifest(acceleratorValue, issues);
  const copiedMode: CatalogValidationMode | undefined = mode === 'partial' || mode === 'strict' ? mode : undefined;

  return Object.freeze({
    options: Object.freeze({
      ...(copiedMode === undefined ? {} : { mode: copiedMode }),
      ...(values.has('referenceCatalog') ? { referenceCatalog: values.get('referenceCatalog') } : {}),
      ...(referenceKeys === undefined ? {} : { referenceKeys }),
      ...(placeholderManifest === undefined ? {} : { placeholderManifest }),
      ...(acceleratorManifest === undefined ? {} : { acceleratorManifest }),
      ...(typeof official === 'boolean' ? { official } : {}),
      ...(typeof source === 'string' && safeSource(source) !== undefined ? { source } : {}),
    }),
    issues: Object.freeze(issues),
  });
}
