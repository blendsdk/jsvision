import type { KanbanOperationId } from '../contract/identity.js';
import { snapshotKanbanOperationSnapshot } from '../operation/types.js';
import type { KanbanOperationSnapshot, KanbanOperationSubscriber, KanbanOperationState } from '../operation/types.js';
import type { KanbanViewport } from './kanban-viewport.js';

/** Board-owned operation methods installed without widening public viewport construction options. */
export interface KanbanViewportOperationAdapter {
  /** Returns current active payload-free coordinator snapshots. */
  readonly snapshot: () => readonly KanbanOperationSnapshot[];
  /** Subscribes to all active and terminal lifecycle transitions. */
  readonly subscribe: (subscriber: KanbanOperationSubscriber) => () => void;
  /** Cancels one current operation at the owning coordinator. */
  readonly cancel: (operationId: KanbanOperationId) => boolean;
}

/** Private mount state retained only for an owning board viewport. */
interface KanbanViewportOperationState {
  readonly adapter: KanbanViewportOperationAdapter;
  unsubscribe?: () => void;
  terminal?: KanbanOperationSnapshot;
  failed: boolean;
}

/** Closed bounded read result consumed at the paint boundary. */
export type KanbanViewportOperationRead =
  { readonly kind: 'ready'; readonly snapshots: readonly KanbanOperationSnapshot[] } | { readonly kind: 'failed' };

/** Private association avoids exposing board authority through `KanbanViewportOptions`. */
const OPERATION_STATES = new WeakMap<object, KanbanViewportOperationState>();
const TERMINAL_STATES = new Set<KanbanOperationState>(['rejected', 'cancelled', 'superseded']);

/** Installs one board-owned adapter before the viewport mounts. */
export function prepareKanbanViewportOperations<TCard>(
  viewport: KanbanViewport<TCard>,
  adapter: KanbanViewportOperationAdapter,
): void {
  if (viewport.mounted || OPERATION_STATES.has(viewport)) throw new Error('Kanban operation bridge is already active.');
  OPERATION_STATES.set(viewport, { adapter, failed: false });
}

/** Subscribes the prepared adapter for exactly the mounted viewport lifetime. */
export function mountKanbanViewportOperations<TCard>(viewport: KanbanViewport<TCard>, invalidate: () => void): void {
  const state = OPERATION_STATES.get(viewport);
  if (state === undefined || state.unsubscribe !== undefined) return;
  try {
    const unsubscribe = state.adapter.subscribe((value) => {
      try {
        const snapshot = snapshotKanbanOperationSnapshot(value);
        state.failed = false;
        if (TERMINAL_STATES.has(snapshot.state)) state.terminal = snapshot;
        else if (snapshot.state === 'proposed' || snapshot.state === 'pending') state.terminal = undefined;
      } catch {
        state.failed = true;
      }
      invalidate();
    });
    if (typeof unsubscribe !== 'function') throw new Error('Invalid Kanban operation unsubscriber.');
    state.unsubscribe = unsubscribe;
  } catch {
    state.failed = true;
    throw new Error('Invalid Kanban operation bridge.');
  }
}

/** Reads, validates, detaches, and aggregate-bounds current operation projection data. */
export function readKanbanViewportOperations<TCard>(
  viewport: KanbanViewport<TCard>,
  maximumOperations: number,
  maximumSubjects: number,
): KanbanViewportOperationRead {
  const state = OPERATION_STATES.get(viewport);
  if (state === undefined) return Object.freeze({ kind: 'ready', snapshots: Object.freeze([]) });
  if (state.failed) return Object.freeze({ kind: 'failed' });
  try {
    const values = state.adapter.snapshot();
    if (!Array.isArray(values) || values.length > maximumOperations) return Object.freeze({ kind: 'failed' });
    const snapshots: KanbanOperationSnapshot[] = [];
    let subjects = 0;
    for (const value of values) {
      const snapshot = snapshotKanbanOperationSnapshot(value);
      subjects += snapshot.affected.length + (snapshot.projection?.cardKeys.length ?? 0);
      if (subjects > maximumSubjects) return Object.freeze({ kind: 'failed' });
      snapshots.push(snapshot);
    }
    if (
      state.terminal !== undefined &&
      !snapshots.some(({ operationId }) => operationId === state.terminal?.operationId)
    ) {
      snapshots.push(state.terminal);
    }
    return Object.freeze({ kind: 'ready', snapshots: Object.freeze(snapshots) });
  } catch {
    state.failed = true;
    return Object.freeze({ kind: 'failed' });
  }
}

/** Cancels every active operation after an overlay boundary failure. */
export function cancelKanbanViewportOperations<TCard>(viewport: KanbanViewport<TCard>): void {
  const state = OPERATION_STATES.get(viewport);
  if (state === undefined) return;
  try {
    const values = state.adapter.snapshot();
    if (!Array.isArray(values)) return;
    for (const value of values.slice(0, 32)) {
      const snapshot = snapshotKanbanOperationSnapshot(value);
      if (snapshot.state === 'proposed' || snapshot.state === 'pending' || snapshot.state === 'accepted') {
        state.adapter.cancel(snapshot.operationId);
      }
    }
  } catch {
    state.failed = true;
    return;
  }
  state.failed = false;
}

/** Releases the private subscription and association idempotently. */
export function disposeKanbanViewportOperations<TCard>(viewport: KanbanViewport<TCard>): void {
  const state = OPERATION_STATES.get(viewport);
  if (state === undefined) return;
  OPERATION_STATES.delete(viewport);
  try {
    state.unsubscribe?.();
  } catch {
    // Other viewport resources still require deterministic release.
  }
  state.unsubscribe = undefined;
  state.terminal = undefined;
}
