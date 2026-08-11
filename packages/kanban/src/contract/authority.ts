import { snapshotKanbanDataArray, snapshotKanbanDataProperties, validateKanbanDataKeys } from './data-snapshot.js';
import type { KanbanDataProperties } from './data-snapshot.js';
import { KanbanInvalidSemanticValueError } from './error.js';
import { createKanbanOperationId } from './identity.js';
import { KANBAN_LIMITS } from './limits.js';
import type {
  KanbanPublicationExpectation,
  KanbanPublicationNotice,
  KanbanPublicationReconciliation,
  KanbanRequest,
  KanbanRequestResult,
} from './request.js';
import {
  createKanbanRejectedResult,
  snapshotKanbanPublicationExpectation,
  snapshotKanbanPublicationSubjects,
  snapshotKanbanRequest,
  snapshotKanbanRequestContext,
  snapshotKanbanRequestResult,
} from './request-validation.js';
import type { KanbanRequestContext } from './capability.js';

/** Maximum simultaneously pending application operations. */
const MAX_PENDING_OPERATIONS = KANBAN_LIMITS.pendingOperations.safe;
/** Same-realm Promise intrinsic used without reading an application object's `then` property. */
const NATIVE_PROMISE_THEN = Promise.prototype.then;
/** Exact publication notice members. */
const NOTICE_KEYS = new Set(['kind', 'operationId', 'subjects']);

/** Read one required string data member without coercion. */
function requiredString(properties: KanbanDataProperties, key: string): string {
  const value = properties[key];
  if (typeof value !== 'string') throw new KanbanInvalidSemanticValueError();
  return value;
}

/** Accept only unmodified, same-realm native Promise instances. */
function isExactNativePromise(value: unknown): value is Promise<KanbanRequestResult> {
  try {
    return (
      value instanceof Promise &&
      Object.getPrototypeOf(value) === Promise.prototype &&
      Object.getOwnPropertyDescriptor(value, 'then') === undefined
    );
  } catch {
    return false;
  }
}

/** Outcome captured from the native Promise intrinsic without thenable assimilation. */
type NativePromiseSettlement =
  { readonly kind: 'fulfilled'; readonly value: KanbanRequestResult } | { readonly kind: 'rejected' };

/**
 * Settle a branded native Promise without looking up its public `then` member.
 *
 * Calling the intrinsic rejects transparent proxies because they do not carry Promise internal
 * slots. The wrapper resolves with a plain box so an application result is never assimilated as a
 * thenable by this boundary.
 */
function settleExactNativePromise(value: Promise<KanbanRequestResult>): Promise<NativePromiseSettlement> {
  return new Promise((resolve, reject) => {
    try {
      NATIVE_PROMISE_THEN.call(
        value,
        (result) => resolve({ kind: 'fulfilled', value: result }),
        () => resolve({ kind: 'rejected' }),
      );
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Validate and dispatch one raw request without consulting UX capabilities or mutating records.
 *
 * Application throws and rejected exact same-realm native promises become sanitized rejections.
 * Promise subclasses, modified Promise instances, cross-realm promises, and arbitrary thenables are
 * rejected as malformed results without invoking their `then` members.
 */
export async function dispatchKanbanRequest(
  request: KanbanRequest,
  dispatcher: (request: KanbanRequest, context: KanbanRequestContext) => unknown,
  context: KanbanRequestContext,
): Promise<KanbanRequestResult> {
  const snapshot = snapshotKanbanRequest(request);
  const capturedContext = snapshotKanbanRequestContext(context);
  let dispatched: unknown;
  try {
    dispatched = dispatcher(snapshot, capturedContext);
  } catch {
    return createKanbanRejectedResult(snapshot.operationId, 'dispatcher-failed');
  }

  if (isExactNativePromise(dispatched)) {
    try {
      const settlement = await settleExactNativePromise(dispatched);
      if (settlement.kind === 'rejected') {
        return createKanbanRejectedResult(snapshot.operationId, 'dispatcher-failed');
      }
      dispatched = settlement.value;
    } catch {
      return createKanbanRejectedResult(snapshot.operationId, 'invalid-dispatch-result');
    }
  }
  try {
    return snapshotKanbanRequestResult(dispatched, snapshot.operationId);
  } catch {
    return createKanbanRejectedResult(snapshot.operationId, 'invalid-dispatch-result');
  }
}

/**
 * Clear publication metadata after matching or contradictory authoritative data arrives.
 *
 * The helper is pure: it receives no application records and never mutates the pending collection.
 */
export function reconcileKanbanPublication(
  pending: readonly KanbanPublicationExpectation[],
  notice: KanbanPublicationNotice,
): KanbanPublicationReconciliation {
  const expectations = snapshotKanbanDataArray(pending, MAX_PENDING_OPERATIONS).map(
    snapshotKanbanPublicationExpectation,
  );
  const operationIds = expectations.map(({ operationId }) => operationId);
  if (new Set(operationIds).size !== operationIds.length) throw new KanbanInvalidSemanticValueError();

  const properties = snapshotKanbanDataProperties(notice);
  validateKanbanDataKeys(properties, NOTICE_KEYS);
  const kind = properties.kind;
  if (kind !== 'matching' && kind !== 'contradictory') throw new KanbanInvalidSemanticValueError();
  const operationId = createKanbanOperationId(requiredString(properties, 'operationId'));
  const subjects = snapshotKanbanPublicationSubjects(properties.subjects);
  const cleared = Object.freeze({ kind, operationId, subjects });
  const remaining = expectations.filter((expectation) => expectation.operationId !== operationId);
  const matched = remaining.length !== expectations.length;
  return Object.freeze({
    pending: Object.freeze(remaining),
    ...(matched ? { cleared } : {}),
  });
}
