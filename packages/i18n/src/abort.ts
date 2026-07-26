import { I18nError } from './errors.js';
import { inspectArray, inspectOwnDataProperty, isObjectLike } from './input.js';

const ABORTED_GETTER = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')?.get;
const ADD_EVENT_LISTENER = EventTarget.prototype.addEventListener;
const REMOVE_EVENT_LISTENER = EventTarget.prototype.removeEventListener;
const NODE_IS_PROXY =
  typeof process !== 'undefined' && typeof process.getBuiltinModule === 'function'
    ? process.getBuiltinModule('node:util').types.isProxy
    : undefined;

/** Create a value-free error for a cancellation object that cannot be inspected safely. */
function invalidSignal(): I18nError {
  return new I18nError('SOURCE_FAILED', 'Catalog source signal must be a genuine AbortSignal.');
}

/**
 * Validate an untrusted cancellation value through the platform's intrinsic state getter.
 *
 * `instanceof` alone accepts proxy wrappers, while reading `signal.aborted` can invoke an own
 * override. Applying the captured getter both proves the internal AbortSignal slot and avoids
 * caller-defined properties.
 *
 * @param value Candidate cancellation value.
 * @returns The genuine platform signal.
 * @throws {@link I18nError} when the value is not safely inspectable as an AbortSignal.
 */
export function validateAbortSignal(value: unknown): AbortSignal {
  try {
    if (NODE_IS_PROXY?.(value) === true) throw invalidSignal();
    if (!(value instanceof AbortSignal) || ABORTED_GETTER === undefined) throw invalidSignal();
    const aborted: unknown = Reflect.apply(ABORTED_GETTER, value, []);
    if (typeof aborted !== 'boolean') throw invalidSignal();
    return value;
  } catch {
    throw invalidSignal();
  }
}

/**
 * Read cancellation state without invoking caller-overridden properties.
 *
 * @param signal Previously validated platform signal.
 * @returns Whether cancellation has been requested.
 * @throws {@link I18nError} if the platform signal can no longer be inspected safely.
 */
export function isSignalAborted(signal: AbortSignal): boolean {
  try {
    if (ABORTED_GETTER === undefined) throw invalidSignal();
    const aborted: unknown = Reflect.apply(ABORTED_GETTER, signal, []);
    if (typeof aborted !== 'boolean') throw invalidSignal();
    return aborted;
  } catch {
    throw invalidSignal();
  }
}

/**
 * Register one abort listener through captured EventTarget intrinsics.
 *
 * @param signal Genuine platform signal.
 * @param listener Value-free cancellation callback.
 * @returns Cleanup callback that removes the listener without consulting instance overrides.
 */
export function addAbortListener(signal: AbortSignal, listener: () => void): () => void {
  try {
    Reflect.apply(ADD_EVENT_LISTENER, signal, ['abort', listener, { once: true }]);
  } catch {
    throw invalidSignal();
  }
  return () => {
    try {
      Reflect.apply(REMOVE_EVENT_LISTENER, signal, ['abort', listener]);
    } catch {
      // A validated platform signal should remain removable. Cleanup is deliberately best-effort
      // so it cannot replace the load result with an ambient platform failure.
    }
  };
}

/**
 * Extract a genuine signal from a directly invoked catalog-source context.
 *
 * @param context Untrusted source context supplied to a public `CatalogSource.load` method.
 * @returns Validated platform signal.
 * @throws {@link I18nError} for proxies, accessors, missing state, or non-signals.
 */
export function sourceContextSignal(context: unknown): AbortSignal {
  if (!isObjectLike(context) || inspectArray(context) !== false) throw invalidSignal();
  const property = inspectOwnDataProperty(context, 'signal');
  if (!property.accessible || !property.present) throw invalidSignal();
  return validateAbortSignal(property.value);
}
