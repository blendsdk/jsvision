import { KanbanInvalidSemanticValueError } from './error.js';
import { KANBAN_LIMITS } from './limits.js';

/** Recursive immutable value domain used by queries and application extension payloads. */
export type KanbanSemanticValue =
  null | boolean | number | string | readonly KanbanSemanticValue[] | { readonly [key: string]: KanbanSemanticValue };

/** Package-owned snapshot paired with its deterministic canonical representation. */
interface SemanticSnapshot {
  readonly value: KanbanSemanticValue;
  readonly canonical: string;
}

/** Shared remaining canonical-byte budget for one complete semantic traversal. */
interface SemanticBudget {
  remainingBytes: number;
}

/** Unsafe object member names rejected before copying into ordinary records. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
/** Decimal array-index grammar used to reject extra array properties. */
const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/u;
/** UTF-8 encoder used for all semantic byte limits. */
const ENCODER = new TextEncoder();

/** Returns encoded UTF-8 size for a string or canonical fragment. */
function encodedBytes(value: string): number {
  return ENCODER.encode(value).byteLength;
}

/** Quotes a semantic string using JSON's deterministic escaping rules. */
function quote(value: string): string {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new KanbanInvalidSemanticValueError();
  return encoded;
}

/** Consumes canonical bytes before the corresponding snapshot fragment is retained. */
function consumeCanonical(budget: SemanticBudget, fragment: string): void {
  const bytes = encodedBytes(fragment);
  if (bytes > budget.remainingBytes) throw new KanbanInvalidSemanticValueError();
  budget.remainingBytes -= bytes;
}

/** Reads descriptors and prototype while normalizing hostile proxy failures to a typed error. */
function inspectObject(value: object): {
  readonly prototype: object | null;
  readonly keys: readonly PropertyKey[];
  readonly descriptors: Readonly<Record<PropertyKey, PropertyDescriptor>>;
} {
  try {
    return {
      prototype: Object.getPrototypeOf(value),
      keys: Reflect.ownKeys(value),
      descriptors: Object.getOwnPropertyDescriptors(value),
    };
  } catch {
    throw new KanbanInvalidSemanticValueError();
  }
}

/** Narrows arrays while normalizing revoked-proxy failures to the public typed error. */
function isSemanticArray(value: object): value is readonly unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    throw new KanbanInvalidSemanticValueError();
  }
}

/** Validates and copies one semantic node while deriving its canonical fragment. */
function walkSemantic(
  value: unknown,
  depth: number,
  active: WeakSet<object>,
  budget: SemanticBudget,
): SemanticSnapshot {
  if (depth > KANBAN_LIMITS.semanticDepth.safe) throw new KanbanInvalidSemanticValueError();

  if (value === null) {
    consumeCanonical(budget, 'null');
    return { value: null, canonical: 'null' };
  }
  if (typeof value === 'boolean') {
    const canonical = value ? 'true' : 'false';
    consumeCanonical(budget, canonical);
    return { value, canonical };
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new KanbanInvalidSemanticValueError();
    const normalized = Object.is(value, -0) ? 0 : value;
    const canonical = String(normalized);
    consumeCanonical(budget, canonical);
    return { value: normalized, canonical };
  }
  if (typeof value === 'string') {
    if (
      value.length > KANBAN_LIMITS.semanticStringBytes.safe ||
      encodedBytes(value) > KANBAN_LIMITS.semanticStringBytes.safe
    ) {
      throw new KanbanInvalidSemanticValueError();
    }
    const canonical = quote(value);
    consumeCanonical(budget, canonical);
    return { value, canonical };
  }
  if (typeof value !== 'object') throw new KanbanInvalidSemanticValueError();
  if (active.has(value)) throw new KanbanInvalidSemanticValueError();

  active.add(value);
  try {
    if (isSemanticArray(value)) return walkArray(value, depth, active, budget);
    return walkRecord(value, depth, active, budget);
  } finally {
    active.delete(value);
  }
}

/** Validates a dense array with no custom members, then copies and freezes it. */
function walkArray(
  value: readonly unknown[],
  depth: number,
  active: WeakSet<object>,
  budget: SemanticBudget,
): SemanticSnapshot {
  const inspected = inspectObject(value);
  if (inspected.prototype !== Array.prototype) throw new KanbanInvalidSemanticValueError();
  const lengthDescriptor = inspected.descriptors.length;
  if (
    lengthDescriptor === undefined ||
    typeof lengthDescriptor.value !== 'number' ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    lengthDescriptor.value > KANBAN_LIMITS.semanticArrayEntries.safe
  ) {
    throw new KanbanInvalidSemanticValueError();
  }
  const length = lengthDescriptor.value;
  if (inspected.keys.length !== length + 1) throw new KanbanInvalidSemanticValueError();

  for (const key of inspected.keys) {
    if (typeof key !== 'string') throw new KanbanInvalidSemanticValueError();
    if (key !== 'length' && !ARRAY_INDEX.test(key)) throw new KanbanInvalidSemanticValueError();
    if (key !== 'length' && Number(key) >= length) throw new KanbanInvalidSemanticValueError();
  }

  consumeCanonical(budget, '[');
  const snapshotValues: KanbanSemanticValue[] = [];
  const canonicalParts = ['['];
  for (let index = 0; index < length; index += 1) {
    const descriptor = inspected.descriptors[String(index)];
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      throw new KanbanInvalidSemanticValueError();
    }
    if (index > 0) {
      consumeCanonical(budget, ',');
      canonicalParts.push(',');
    }
    const child = walkSemantic(descriptor.value, depth + 1, active, budget);
    snapshotValues.push(child.value);
    canonicalParts.push(child.canonical);
  }

  consumeCanonical(budget, ']');
  canonicalParts.push(']');
  return {
    value: Object.freeze(snapshotValues),
    canonical: canonicalParts.join(''),
  };
}

/** Validates a plain data record, sorts its keys, then copies and freezes it. */
function walkRecord(value: object, depth: number, active: WeakSet<object>, budget: SemanticBudget): SemanticSnapshot {
  const inspected = inspectObject(value);
  if (inspected.prototype !== Object.prototype && inspected.prototype !== null) {
    throw new KanbanInvalidSemanticValueError();
  }
  if (inspected.keys.some((key) => typeof key === 'symbol')) throw new KanbanInvalidSemanticValueError();

  const keys = inspected.keys.filter((key): key is string => typeof key === 'string').sort();
  if (keys.length > KANBAN_LIMITS.semanticObjectKeys.safe) throw new KanbanInvalidSemanticValueError();

  consumeCanonical(budget, '{');
  const snapshot: Record<string, KanbanSemanticValue> = {};
  const canonicalParts = ['{'];
  for (const [index, key] of keys.entries()) {
    const descriptor = inspected.descriptors[key];
    if (
      UNSAFE_KEYS.has(key) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      throw new KanbanInvalidSemanticValueError();
    }
    if (
      key.length > KANBAN_LIMITS.semanticStringBytes.safe ||
      encodedBytes(key) > KANBAN_LIMITS.semanticStringBytes.safe
    ) {
      throw new KanbanInvalidSemanticValueError();
    }
    if (index > 0) {
      consumeCanonical(budget, ',');
      canonicalParts.push(',');
    }
    const canonicalKey = quote(key);
    consumeCanonical(budget, canonicalKey);
    consumeCanonical(budget, ':');
    canonicalParts.push(canonicalKey, ':');
    const child = walkSemantic(descriptor.value, depth + 1, active, budget);
    snapshot[key] = child.value;
    canonicalParts.push(child.canonical);
  }

  consumeCanonical(budget, '}');
  canonicalParts.push('}');
  return { value: Object.freeze(snapshot), canonical: canonicalParts.join('') };
}

/** Runs one semantic traversal with a global encoded-byte budget. */
function createSemanticSnapshot(value: unknown): SemanticSnapshot {
  return walkSemantic(value, 0, new WeakSet(), {
    remainingBytes: KANBAN_LIMITS.semanticEncodedBytes.safe,
  });
}

/**
 * Validates, detaches, sorts, normalizes, and deeply freezes one semantic value.
 *
 * The caller object is never retained and accessors are rejected without invocation.
 */
export function snapshotKanbanSemanticValue<T extends KanbanSemanticValue>(value: T): T;
/** Validates untyped boundary input and returns its detached semantic representation. */
export function snapshotKanbanSemanticValue(value: unknown): KanbanSemanticValue;
export function snapshotKanbanSemanticValue(value: unknown): KanbanSemanticValue {
  return createSemanticSnapshot(value).value;
}

/**
 * Derives a stable browser-safe 64-bit fingerprint from the canonical semantic snapshot.
 *
 * Fingerprints accelerate cache lookup but do not replace semantic equality checks.
 */
export function fingerprintKanbanSemanticValue(value: unknown): string {
  const bytes = ENCODER.encode(createSemanticSnapshot(value).canonical);
  let hash = 14_695_981_039_346_656_037n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 1_099_511_628_211n);
  }
  return hash.toString(16).padStart(16, '0');
}
