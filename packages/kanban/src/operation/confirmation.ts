import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanOperationId } from '../contract/identity.js';
import { snapshotKanbanCapabilities } from '../contract/capability.js';
import type { KanbanCapabilities } from '../contract/capability.js';
import type { KanbanRequestExpectedRevisions } from '../contract/request.js';
import {
  snapshotKanbanRequestExpectedRevisions,
  snapshotKanbanRequestProposal,
  snapshotKanbanRequestSignal,
} from '../contract/request-validation.js';
import { snapshotKanbanEligibility } from './eligibility.js';
import { snapshotKanbanOperationSnapshot, snapshotKanbanOperationSubjects } from './types.js';
import type {
  KanbanConfirmationContext,
  KanbanConfirmer,
  KanbanInverseRequestContext,
  KanbanOperationSnapshot,
  KanbanUndoDescriptor,
} from './types.js';

/** Exact confirmation-context members. */
const CONTEXT_KEYS = new Set(['operationId', 'proposal', 'affected', 'expected', 'eligibility', 'signal']);
/** Exact destructive-classification members. */
const DESTRUCTIVE_KEYS = new Set(['kind']);
/** Same-realm Promise intrinsic used without reading an application object's `then` property. */
const NATIVE_PROMISE_THEN = Promise.prototype.then;

/** Safe confirmation outcome consumed by coordinator state transitions. */
export type KanbanConfirmationSettlement = 'approved' | 'declined' | 'invalid';

/** Return true only for an unmodified same-realm native Promise. */
function isExactNativePromise(value: unknown): value is Promise<boolean> {
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

/** Settle a native Promise through its intrinsic without assimilating hostile thenables. */
function settleNativeBoolean(value: Promise<boolean>): Promise<boolean | undefined> {
  return new Promise((resolve) => {
    try {
      NATIVE_PROMISE_THEN.call(
        value,
        (result) => resolve(typeof result === 'boolean' ? result : undefined),
        () => resolve(undefined),
      );
    } catch {
      resolve(undefined);
    }
  });
}

/**
 * Validate, detach, and freeze one confirmation context while preserving its live AbortSignal.
 *
 * @example
 * ```ts
 * const context = snapshotKanbanConfirmationContext(candidate);
 * if (!context.signal.aborted) showConfirmation(context.eligibility);
 * ```
 */
export function snapshotKanbanConfirmationContext(value: unknown): KanbanConfirmationContext {
  const properties = snapshotKanbanDataProperties(value, CONTEXT_KEYS.size);
  validateKanbanDataKeys(properties, CONTEXT_KEYS);
  const eligibilityProperties = snapshotKanbanDataProperties(properties.eligibility);
  let eligibility: KanbanConfirmationContext['eligibility'];
  if (eligibilityProperties.kind === 'destructive') {
    validateKanbanDataKeys(eligibilityProperties, DESTRUCTIVE_KEYS);
    eligibility = Object.freeze({ kind: 'destructive' });
  } else {
    const candidate = snapshotKanbanEligibility(properties.eligibility);
    if (candidate.kind !== 'warning') throw new KanbanInvalidSemanticValueError();
    eligibility = candidate;
  }
  if (typeof properties.operationId !== 'string') throw new KanbanInvalidSemanticValueError();
  return Object.freeze({
    operationId: createKanbanOperationId(properties.operationId),
    proposal: snapshotKanbanRequestProposal(properties.proposal),
    affected: snapshotKanbanOperationSubjects(properties.affected),
    expected: snapshotKanbanRequestExpectedRevisions(properties.expected),
    eligibility,
    signal: snapshotKanbanRequestSignal(properties.signal),
  });
}

/**
 * Invoke one confirmer with exact boolean/native-Promise handling and safe failure normalization.
 *
 * Arbitrary thenables, Promise subclasses, modified/cross-realm Promises, throws, rejections, and
 * non-boolean settlements become `invalid` without reading a hostile `then` member.
 */
export async function settleKanbanConfirmation(
  confirmer: KanbanConfirmer | undefined,
  value: KanbanConfirmationContext,
): Promise<KanbanConfirmationSettlement> {
  if (confirmer === undefined) return 'declined';
  const context = snapshotKanbanConfirmationContext(value);
  let candidate: unknown;
  try {
    candidate = Reflect.apply(confirmer, undefined, [context]);
  } catch {
    return 'invalid';
  }
  if (typeof candidate === 'boolean') return candidate ? 'approved' : 'declined';
  if (!isExactNativePromise(candidate)) return 'invalid';
  const settled = await settleNativeBoolean(candidate);
  return settled === undefined ? 'invalid' : settled ? 'approved' : 'declined';
}

/**
 * Build one exact frozen inverse-request context from a previously validated undo descriptor.
 *
 * The descriptor remains opaque and is never invoked or copied here. Its exact token/builder
 * validation occurs before committed retention, while all current authority is freshly detached.
 */
export function createKanbanInverseRequestContext(
  prior: KanbanOperationSnapshot,
  undo: KanbanUndoDescriptor,
  expected: KanbanRequestExpectedRevisions,
  capabilities: KanbanCapabilities,
  signal: AbortSignal,
): KanbanInverseRequestContext {
  return Object.freeze({
    prior: snapshotKanbanOperationSnapshot(prior),
    undo,
    expected: snapshotKanbanRequestExpectedRevisions(expected),
    capabilities: snapshotKanbanCapabilities(capabilities),
    signal: snapshotKanbanRequestSignal(signal),
  });
}
