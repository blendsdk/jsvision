import { KanbanInvalidSemanticValueError } from './error.js';

/** Object meta-properties that must never cross descriptor-snapshot boundaries. */
const UNSAFE_DATA_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Detached data-property map returned after descriptor-only boundary inspection. */
export type KanbanDataProperties = Readonly<Record<string, unknown>>;

/**
 * Copies enumerable own data properties without invoking accessors.
 *
 * Arrays, symbols, custom prototypes, non-enumerable members, accessors, and failing proxy traps are
 * normalized to a sanitized contract error.
 */
export function snapshotKanbanDataProperties(value: unknown, maximumProperties = 64): KanbanDataProperties {
  try {
    if (!Number.isSafeInteger(maximumProperties) || maximumProperties < 0) {
      throw new KanbanInvalidSemanticValueError();
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new KanbanInvalidSemanticValueError();
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new KanbanInvalidSemanticValueError();
    const keys = Reflect.ownKeys(value);
    if (keys.length > maximumProperties) throw new KanbanInvalidSemanticValueError();
    if (keys.some((key) => typeof key !== 'string')) throw new KanbanInvalidSemanticValueError();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      if (typeof key !== 'string') throw new KanbanInvalidSemanticValueError();
      if (UNSAFE_DATA_KEYS.has(key)) throw new KanbanInvalidSemanticValueError();
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined
      ) {
        throw new KanbanInvalidSemanticValueError();
      }
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    throw new KanbanInvalidSemanticValueError();
  }
}

/** Rejects members outside an explicit envelope allowlist. */
export function validateKanbanDataKeys(properties: KanbanDataProperties, allowed: ReadonlySet<string>): void {
  if (Object.keys(properties).some((key) => !allowed.has(key))) throw new KanbanInvalidSemanticValueError();
}

/** Copies a bounded dense ordinary array without invoking element accessors. */
export function snapshotKanbanDataArray(value: unknown, maximumEntries: number): readonly unknown[] {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      throw new KanbanInvalidSemanticValueError();
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      lengthDescriptor === undefined ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximumEntries
    ) {
      throw new KanbanInvalidSemanticValueError();
    }
    const length = lengthDescriptor.value;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1 || keys.some((key) => typeof key !== 'string')) {
      throw new KanbanInvalidSemanticValueError();
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined
      ) {
        throw new KanbanInvalidSemanticValueError();
      }
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    throw new KanbanInvalidSemanticValueError();
  }
}
