import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanExtensionId, createKanbanOperationId } from '../contract/identity.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import type { KanbanRequestProposal } from '../contract/request.js';
import type {
  KanbanHistoryAvailability,
  KanbanHistoryAuthority,
  KanbanHistoryBinding,
  KanbanHistoryDirection,
  KanbanHistoryProvider,
} from './types.js';

/** Stable identity for lifecycle-free unavailable history invocation. */
const HISTORY_UNAVAILABLE_ID = createKanbanOperationId('kanban-history-unavailable');
/** Maximum availability observers retained by one binding. */
const MAX_HISTORY_SUBSCRIBERS = 256;
/** Exact members accepted for one availability snapshot. */
const AVAILABILITY_KEYS = new Set(['revision', 'undo', 'redo']);
/** Exact members accepted for one available history action. */
const ACTION_KEYS = new Set(['labelMessageId']);
/** Same-realm Promise intrinsic used without reading an application object's `then` property. */
const NATIVE_PROMISE_THEN = Promise.prototype.then;

/** Construction options for application-owned history integration. */
export interface KanbanHistoryBindingOptions {
  /** Existing board request authority used for every fresh proposal. */
  readonly authority: KanbanHistoryAuthority;
  /** Application-owned availability and proposal builder. */
  readonly provider: KanbanHistoryProvider;
}

/** Copies one record-free availability snapshot. */
function snapshotAvailability(value: KanbanHistoryAvailability): KanbanHistoryAvailability {
  const properties = snapshotKanbanDataProperties(value, AVAILABILITY_KEYS.size);
  validateKanbanDataKeys(properties, AVAILABILITY_KEYS);
  const revision = snapshotKanbanRevision(properties.revision);
  const action = (entry: unknown) => {
    if (entry === undefined) return undefined;
    const actionProperties = snapshotKanbanDataProperties(entry, ACTION_KEYS.size);
    validateKanbanDataKeys(actionProperties, ACTION_KEYS);
    if (typeof actionProperties.labelMessageId !== 'string') throw new KanbanInvalidSemanticValueError();
    return Object.freeze({ labelMessageId: createKanbanExtensionId(actionProperties.labelMessageId) });
  };
  const undo = action(properties.undo);
  const redo = action(properties.redo);
  return Object.freeze({
    revision,
    ...(undo === undefined ? {} : { undo }),
    ...(redo === undefined ? {} : { redo }),
  });
}

/** Return true only for an unmodified same-realm native Promise. */
function isExactNativePromise(
  value: KanbanRequestProposal | Promise<KanbanRequestProposal>,
): value is Promise<KanbanRequestProposal> {
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

/**
 * Settle one exact native Promise or cancellation, whichever occurs first.
 *
 * This avoids assimilating arbitrary thenables and guarantees that disposal releases callers even
 * when an application builder ignores its cancellation signal.
 */
function settleBuild(
  value: Promise<KanbanRequestProposal>,
  signal: AbortSignal,
): Promise<Readonly<{ readonly kind: 'value'; readonly value: KanbanRequestProposal } | { readonly kind: 'invalid' }>> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (
      result: Readonly<
        { readonly kind: 'value'; readonly value: KanbanRequestProposal } | { readonly kind: 'invalid' }
      >,
    ) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', aborted);
      resolve(result);
    };
    const aborted = () => finish(Object.freeze({ kind: 'invalid' as const }));
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) {
      aborted();
      return;
    }
    try {
      NATIVE_PROMISE_THEN.call(
        value,
        (proposal) => finish(Object.freeze({ kind: 'value' as const, value: proposal })),
        () => finish(Object.freeze({ kind: 'invalid' as const })),
      );
    } catch {
      finish(Object.freeze({ kind: 'invalid' as const }));
    }
  });
}

/** Returns whether one direction is present in current availability. */
function available(snapshot: KanbanHistoryAvailability, direction: KanbanHistoryDirection): boolean {
  return direction === 'undo' ? snapshot.undo !== undefined : snapshot.redo !== undefined;
}

/** Creates one stable payload-free rejected history result. */
function rejected(code: string) {
  return Object.freeze({ kind: 'rejected' as const, operationId: HISTORY_UNAVAILABLE_ID, code });
}

/**
 * Creates a reactive application-owned history binding over existing board authority.
 *
 * @example
 * ```ts
 * const history = createKanbanHistoryBinding({ authority, provider });
 * if (history.snapshot().undo) await history.invoke('undo');
 * ```
 */
export function createKanbanHistoryBinding(options: KanbanHistoryBindingOptions): KanbanHistoryBinding {
  let snapshot = snapshotAvailability(options.provider.availability());
  const subscribers = new Set<(value: KanbanHistoryAvailability) => void>();
  const controllers = new Set<AbortController>();
  let isDisposed = false;
  const releaseProvider = options.provider.subscribe(() => {
    if (isDisposed) return;
    try {
      const next = snapshotAvailability(options.provider.availability());
      if (next.revision !== snapshot.revision) {
        for (const controller of controllers) controller.abort();
      }
      snapshot = next;
      for (const subscriber of [...subscribers]) {
        try {
          subscriber(next);
        } catch {
          // Availability presentation observers cannot alter application history state.
        }
      }
    } catch {
      // Malformed application availability cannot replace the last valid snapshot.
    }
  });
  if (typeof releaseProvider !== 'function') throw new KanbanInvalidSemanticValueError();

  const binding: KanbanHistoryBinding = {
    snapshot: () => snapshot,
    subscribe: (subscriber) => {
      if (isDisposed || typeof subscriber !== 'function' || subscribers.size >= MAX_HISTORY_SUBSCRIBERS) {
        throw new KanbanInvalidSemanticValueError();
      }
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    invoke: async (direction) => {
      if (isDisposed || !available(snapshot, direction)) return rejected('history-unavailable');
      const admitted = snapshot;
      const controller = new AbortController();
      controllers.add(controller);
      try {
        const candidate = options.provider.build(
          direction,
          Object.freeze({ revision: admitted.revision, signal: controller.signal }),
        );
        const settled = isExactNativePromise(candidate)
          ? await settleBuild(candidate, controller.signal)
          : Object.freeze({ kind: 'value' as const, value: candidate });
        if (
          isDisposed ||
          controller.signal.aborted ||
          snapshot.revision !== admitted.revision ||
          !available(snapshot, direction)
        ) {
          return rejected('history-unavailable');
        }
        if (settled.kind === 'invalid') return rejected('history-failed');
        return await options.authority.request(settled.value);
      } catch {
        return rejected('history-failed');
      } finally {
        controllers.delete(controller);
      }
    },
    dispose: () => {
      if (isDisposed) return;
      isDisposed = true;
      try {
        releaseProvider();
      } catch {
        // Provider cleanup failure cannot retain package resources.
      }
      for (const controller of controllers) controller.abort();
      controllers.clear();
      subscribers.clear();
    },
    disposed: () => isDisposed,
  };
  return Object.freeze(binding);
}
