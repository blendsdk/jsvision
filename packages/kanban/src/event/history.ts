import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanExtensionId, createKanbanOperationId } from '../contract/identity.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanBoardAuthority } from '../board/board-authority.js';
import type {
  KanbanHistoryAvailability,
  KanbanHistoryBinding,
  KanbanHistoryDirection,
  KanbanHistoryProvider,
} from './types.js';

/** Stable identity for lifecycle-free unavailable history invocation. */
const HISTORY_UNAVAILABLE_ID = createKanbanOperationId('kanban-history-unavailable');
/** Maximum availability observers retained by one binding. */
const MAX_HISTORY_SUBSCRIBERS = 256;

/** Construction options for application-owned history integration. */
export interface KanbanHistoryBindingOptions {
  /** Existing board request authority used for every fresh proposal. */
  readonly authority: KanbanBoardAuthority;
  /** Application-owned availability and proposal builder. */
  readonly provider: KanbanHistoryProvider;
}

/** Copies one record-free availability snapshot. */
function snapshotAvailability(value: KanbanHistoryAvailability): KanbanHistoryAvailability {
  const revision = snapshotKanbanRevision(value.revision);
  const action = (entry: KanbanHistoryAvailability['undo']) =>
    entry === undefined ? undefined : Object.freeze({ labelMessageId: createKanbanExtensionId(entry.labelMessageId) });
  const undo = action(value.undo);
  const redo = action(value.redo);
  return Object.freeze({
    revision,
    ...(undo === undefined ? {} : { undo }),
    ...(redo === undefined ? {} : { redo }),
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
        const proposal = await options.provider.build(
          direction,
          Object.freeze({ revision: admitted.revision, signal: controller.signal }),
        );
        if (isDisposed || controller.signal.aborted) return rejected('history-unavailable');
        return await options.authority.request(proposal);
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
