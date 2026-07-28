/**
 * Safe primitives for inspecting untrusted JavaScript objects.
 *
 * Proxy traps can throw from operations that normally appear harmless, including `Array.isArray`,
 * property-descriptor reads, and key enumeration. Public boundaries use these helpers so those
 * failures become ordinary invalid input instead of leaking caller-controlled exceptions.
 */

/** Result of inspecting one own property without invoking an accessor. */
export type OwnDataProperty =
  | { readonly accessible: false; readonly present: false }
  | { readonly accessible: true; readonly present: false }
  | { readonly accessible: true; readonly present: true; readonly value: unknown };

/** Report whether a value is a non-null object or function without coercing it. */
export function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

/**
 * Inspect one own data property while containing hostile proxy traps.
 *
 * Accessors are reported as inaccessible because reading them would execute caller code.
 *
 * @param value Object to inspect.
 * @param key Own property name.
 * @returns Accessibility, presence, and the data value when safely available.
 */
export function inspectOwnDataProperty(value: object, key: PropertyKey): OwnDataProperty {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return { accessible: true, present: false };
    if (!('value' in descriptor)) return { accessible: false, present: false };
    return { accessible: true, present: true, value: descriptor.value };
  } catch {
    return { accessible: false, present: false };
  }
}

/**
 * Enumerate own keys without allowing proxy failures to escape.
 *
 * @param value Object to inspect.
 * @returns Own keys, or `undefined` when inspection failed.
 */
export function inspectOwnKeys(value: object): readonly PropertyKey[] | undefined {
  try {
    return Reflect.ownKeys(value);
  } catch {
    return undefined;
  }
}

/**
 * Determine whether a value is an Array while containing revoked-proxy failures.
 *
 * @param value Value to inspect.
 * @returns `true`, `false`, or `undefined` when inspection failed.
 */
export function inspectArray(value: unknown): boolean | undefined {
  try {
    return Array.isArray(value);
  } catch {
    return undefined;
  }
}

/**
 * Copy a dense Array through own data descriptors without invoking iteration or accessors.
 *
 * Sparse arrays, overridden length access, and proxy failures are rejected. The returned array is
 * frozen and never retains the caller's container.
 *
 * @param input Candidate Array.
 * @param maximumLength Optional hard member limit.
 * @returns Frozen copied values, or `undefined` for invalid input.
 */
export function copyDenseArray(
  input: unknown,
  maximumLength = Number.MAX_SAFE_INTEGER,
): readonly unknown[] | undefined {
  if (inspectArray(input) !== true || !isObjectLike(input)) return undefined;
  const length = inspectOwnDataProperty(input, 'length');
  if (
    !length.accessible ||
    !length.present ||
    typeof length.value !== 'number' ||
    !Number.isSafeInteger(length.value) ||
    length.value < 0 ||
    length.value > maximumLength
  ) {
    return undefined;
  }

  const copied: unknown[] = [];
  for (let index = 0; index < length.value; index += 1) {
    const member = inspectOwnDataProperty(input, String(index));
    if (!member.accessible || !member.present) return undefined;
    copied.push(member.value);
  }
  return Object.freeze(copied);
}
