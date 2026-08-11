import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type {
  KanbanInverseRequestBuilder,
  KanbanInverseRequestContext,
  KanbanUndoDescriptor,
  KanbanUndoToken,
} from './types.js';

/** Exact members accepted for an opaque-token undo descriptor. */
const TOKEN_DESCRIPTOR_KEYS = new Set(['kind', 'token']);
/** Exact members accepted for an inverse-builder undo descriptor. */
const BUILDER_DESCRIPTOR_KEYS = new Set(['kind', 'build']);
/** Terminal control characters forbidden in opaque undo tokens. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
/** Same-realm Promise intrinsic used without reading an application object's `then` property. */
const NATIVE_PROMISE_THEN = Promise.prototype.then;

/** Safe result of settling an application-owned inverse proposal builder. */
export type KanbanInverseRequestSettlement =
  { readonly kind: 'proposal'; readonly proposal: unknown } | { readonly kind: 'invalid' };

/** Return the encoded size of one token without relying on UTF-16 string length. */
function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/** Return true only for an unmodified same-realm native Promise. */
function isExactNativePromise(value: unknown): value is Promise<unknown> {
  try {
    return (
      value instanceof Promise &&
      Object.getPrototypeOf(value) === Promise.prototype &&
      Reflect.ownKeys(value).length === 0
    );
  } catch {
    return false;
  }
}

/** Settle through the Promise intrinsic without assimilating the returned proposal again. */
function settleNativeProposal(value: Promise<unknown>): Promise<Readonly<{ value?: unknown }>> {
  return new Promise((resolve) => {
    try {
      NATIVE_PROMISE_THEN.call(
        value,
        (proposal) => resolve(Object.freeze({ value: proposal })),
        () => resolve(Object.freeze({})),
      );
    } catch {
      resolve(Object.freeze({}));
    }
  });
}

/** Narrow a direct function reference to the documented inverse-builder callback contract. */
function isKanbanInverseRequestBuilder(value: unknown): value is KanbanInverseRequestBuilder {
  return typeof value === 'function';
}

/**
 * Create a bounded opaque application token for a future fresh undo operation.
 *
 * Tokens are never interpreted, rendered, observed, or logged by the package.
 *
 * @example
 * ```ts
 * const undo = { kind: 'token', token: createKanbanUndoToken('history-entry-42') } as const;
 * ```
 */
export function createKanbanUndoToken(value: string): KanbanUndoToken {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > KANBAN_LIMITS.tokenBytes.absolute ||
    CONTROL_CHARACTERS.test(value) ||
    utf8Bytes(value) > KANBAN_LIMITS.tokenBytes.absolute
  ) {
    throw new KanbanInvalidSemanticValueError();
  }
  return value as KanbanUndoToken;
}

/**
 * Validate and freeze one exact mutually exclusive undo descriptor.
 *
 * Builder descriptors retain the direct function reference without invoking it. Token descriptors
 * retain only a bounded control-free opaque string.
 */
export function snapshotKanbanUndoDescriptor(value: unknown): KanbanUndoDescriptor {
  const properties = snapshotKanbanDataProperties(value, BUILDER_DESCRIPTOR_KEYS.size);
  if (properties.kind === 'token') {
    validateKanbanDataKeys(properties, TOKEN_DESCRIPTOR_KEYS);
    if (Object.keys(properties).length !== TOKEN_DESCRIPTOR_KEYS.size || typeof properties.token !== 'string') {
      throw new KanbanInvalidSemanticValueError();
    }
    return Object.freeze({ kind: 'token', token: createKanbanUndoToken(properties.token) });
  }
  if (properties.kind === 'inverse-builder') {
    validateKanbanDataKeys(properties, BUILDER_DESCRIPTOR_KEYS);
    if (
      Object.keys(properties).length !== BUILDER_DESCRIPTOR_KEYS.size ||
      !isKanbanInverseRequestBuilder(properties.build)
    ) {
      throw new KanbanInvalidSemanticValueError();
    }
    return Object.freeze({ kind: 'inverse-builder', build: properties.build });
  }
  throw new KanbanInvalidSemanticValueError();
}

/**
 * Invoke one inverse builder through an exception-contained direct/native-Promise boundary.
 *
 * Arbitrary thenables, Promise subclasses, modified or cross-realm Promises, throws, and rejections
 * become `invalid`. The returned proposal is intentionally not trusted here; the coordinator sends
 * it through the complete fresh-proposal snapshot, eligibility, confirmation, and dispatch path.
 */
export async function settleKanbanInverseRequest(
  builder: KanbanInverseRequestBuilder,
  context: KanbanInverseRequestContext,
): Promise<KanbanInverseRequestSettlement> {
  let candidate: unknown;
  try {
    candidate = Reflect.apply(builder, undefined, [context]);
  } catch {
    return Object.freeze({ kind: 'invalid' });
  }
  if (isExactNativePromise(candidate)) {
    const settled = await settleNativeProposal(candidate);
    if (!Object.prototype.hasOwnProperty.call(settled, 'value')) return Object.freeze({ kind: 'invalid' });
    candidate = settled.value;
  }
  return Object.freeze({ kind: 'proposal', proposal: candidate });
}
