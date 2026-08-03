import { createHash } from 'node:crypto';

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

/** Rejects a canonical fragment as soon as it exceeds the active encoded-byte budget. */
function enforceEncodedLimit(canonical: string): void {
  if (encodedBytes(canonical) > KANBAN_LIMITS.semanticEncodedBytes.safe) {
    throw new KanbanInvalidSemanticValueError();
  }
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
function walkSemantic(value: unknown, depth: number, active: WeakSet<object>): SemanticSnapshot {
  if (depth > KANBAN_LIMITS.semanticDepth.safe) throw new KanbanInvalidSemanticValueError();

  if (value === null) return { value: null, canonical: 'null' };
  if (typeof value === 'boolean') return { value, canonical: value ? 'true' : 'false' };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new KanbanInvalidSemanticValueError();
    const normalized = Object.is(value, -0) ? 0 : value;
    const canonical = String(normalized);
    return { value: normalized, canonical };
  }
  if (typeof value === 'string') {
    if (encodedBytes(value) > KANBAN_LIMITS.semanticStringBytes.safe) {
      throw new KanbanInvalidSemanticValueError();
    }
    const canonical = quote(value);
    enforceEncodedLimit(canonical);
    return { value, canonical };
  }
  if (typeof value !== 'object') throw new KanbanInvalidSemanticValueError();
  if (active.has(value)) throw new KanbanInvalidSemanticValueError();

  active.add(value);
  try {
    if (isSemanticArray(value)) return walkArray(value, depth, active);
    return walkRecord(value, depth, active);
  } finally {
    active.delete(value);
  }
}

/** Validates a dense array with no custom members, then copies and freezes it. */
function walkArray(value: readonly unknown[], depth: number, active: WeakSet<object>): SemanticSnapshot {
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

  for (const key of inspected.keys) {
    if (typeof key !== 'string') throw new KanbanInvalidSemanticValueError();
    if (key !== 'length' && !ARRAY_INDEX.test(key)) throw new KanbanInvalidSemanticValueError();
  }

  const snapshots: SemanticSnapshot[] = [];
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
    snapshots.push(walkSemantic(descriptor.value, depth + 1, active));
  }

  const canonical = `[${snapshots.map(({ canonical: item }) => item).join(',')}]`;
  enforceEncodedLimit(canonical);
  return {
    value: Object.freeze(snapshots.map(({ value: item }) => item)),
    canonical,
  };
}

/** Validates a plain data record, sorts its keys, then copies and freezes it. */
function walkRecord(value: object, depth: number, active: WeakSet<object>): SemanticSnapshot {
  const inspected = inspectObject(value);
  if (inspected.prototype !== Object.prototype && inspected.prototype !== null) {
    throw new KanbanInvalidSemanticValueError();
  }
  if (inspected.keys.some((key) => typeof key === 'symbol')) throw new KanbanInvalidSemanticValueError();

  const keys = inspected.keys.filter((key): key is string => typeof key === 'string').sort();
  if (keys.length > KANBAN_LIMITS.semanticObjectKeys.safe) throw new KanbanInvalidSemanticValueError();

  const snapshot: Record<string, KanbanSemanticValue> = {};
  const canonicalEntries: string[] = [];
  for (const key of keys) {
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
    if (encodedBytes(key) > KANBAN_LIMITS.semanticStringBytes.safe) {
      throw new KanbanInvalidSemanticValueError();
    }
    const child = walkSemantic(descriptor.value, depth + 1, active);
    snapshot[key] = child.value;
    canonicalEntries.push(`${quote(key)}:${child.canonical}`);
  }

  const canonical = `{${canonicalEntries.join(',')}}`;
  enforceEncodedLimit(canonical);
  return { value: Object.freeze(snapshot), canonical };
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
  return walkSemantic(value, 0, new WeakSet()).value;
}

/**
 * Derives a stable SHA-256 fingerprint from the same canonical semantic snapshot rules.
 *
 * Fingerprints accelerate cache lookup but do not replace semantic equality checks.
 */
export function fingerprintKanbanSemanticValue(value: unknown): string {
  const { canonical } = walkSemantic(value, 0, new WeakSet());
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
