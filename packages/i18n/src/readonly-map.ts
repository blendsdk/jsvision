/**
 * A runtime-readonly Map facade.
 *
 * TypeScript's `ReadonlyMap` removes mutators only from the type surface, while `Object.freeze(new
 * Map())` still leaves `set`, `delete`, and `clear` operational. This facade keeps its mutable Map
 * in an ECMAScript private field and exposes only the standard read/iteration operations.
 */
class RuntimeReadonlyMap<Key, Value> implements ReadonlyMap<Key, Value> {
  readonly #values: Map<Key, Value>;

  /**
   * Copy values into an isolated map.
   *
   * @param entries Entries to retain.
   */
  constructor(entries: Iterable<readonly [Key, Value]>) {
    this.#values = new Map(entries);
    Object.freeze(this);
  }

  /** Number of retained entries. */
  get size(): number {
    return this.#values.size;
  }

  /** Return one value by key. */
  get(key: Key): Value | undefined {
    return this.#values.get(key);
  }

  /** Report whether a key is present. */
  has(key: Key): boolean {
    return this.#values.has(key);
  }

  /** Invoke a callback for every entry in insertion order. */
  forEach(callbackfn: (value: Value, key: Key, map: ReadonlyMap<Key, Value>) => void, thisArg?: unknown): void {
    for (const [key, value] of this.#values) {
      Reflect.apply(callbackfn, thisArg, [value, key, this]);
    }
  }

  /** Iterate key/value pairs in insertion order. */
  entries(): MapIterator<[Key, Value]> {
    return this.#values.entries();
  }

  /** Iterate keys in insertion order. */
  keys(): MapIterator<Key> {
    return this.#values.keys();
  }

  /** Iterate values in insertion order. */
  values(): MapIterator<Value> {
    return this.#values.values();
  }

  /** Iterate key/value pairs in insertion order. */
  [Symbol.iterator](): MapIterator<[Key, Value]> {
    return this.#values[Symbol.iterator]();
  }

  /** Standard object tag used by diagnostics and developer tools. */
  get [Symbol.toStringTag](): string {
    return 'ReadonlyMap';
  }
}

/**
 * Copy entries into a runtime-readonly Map facade.
 *
 * @param entries Entries to retain.
 * @returns Readonly Map interface without runtime mutators.
 */
export function readonlyMap<Key, Value>(entries: Iterable<readonly [Key, Value]>): ReadonlyMap<Key, Value> {
  return new RuntimeReadonlyMap(entries);
}
