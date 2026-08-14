import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { createKanbanColumnId, createKanbanOperationId, createKanbanSwimlaneId } from '../contract/identity.js';
import type { KanbanRequestProposal, KanbanRequestResult } from '../contract/request.js';
import { snapshotKanbanRequestProposal, snapshotKanbanRequestResult } from '../contract/request-validation.js';
import {
  buildKanbanColumnAddProposal,
  buildKanbanColumnDeleteProposal,
  buildKanbanColumnReorderProposal,
  buildKanbanColumnUpdateProposal,
  buildKanbanSwimlaneAddProposal,
  buildKanbanSwimlaneDeleteProposal,
  buildKanbanSwimlaneReorderProposal,
  buildKanbanSwimlaneUpdateProposal,
} from './builders.js';
import type {
  KanbanColumnConfigurationOperation,
  KanbanConfigurationAuthority,
  KanbanConfigurationSession,
  KanbanConfigurationSessionApplyResult,
  KanbanConfigurationSessionSnapshot,
  KanbanConfigurationSnapshot,
  KanbanConfigurationSource,
  KanbanSwimlaneConfigurationOperation,
} from './types.js';
import {
  createKanbanConfigurationSnapshot,
  normalizeKanbanConfigurationName,
  snapshotKanbanConfigurationOccupancy,
} from './validation.js';

/** Maximum retained state listeners for one short-lived configuration dialog. */
const MAXIMUM_LISTENERS = 64;
/** Exact keys accepted by a configuration-session constructor. */
const SESSION_KEYS = new Set(['source', 'operation', 'authority']);
/** Exact keys accepted by the source seam. */
const SOURCE_KEYS = new Set(['resolve', 'subscribe']);
/** Exact keys accepted by the optional authority seam. */
const AUTHORITY_KEYS = new Set(['request']);
/** Exact union of members accepted by one selected configuration operation. */
const OPERATION_KEYS = new Set(['kind', 'columnId', 'swimlaneId', 'position', 'occupancy', 'policy']);

/** Options for one isolated configuration draft session. */
export interface KanbanConfigurationSessionOptions {
  /** Application-owned authoritative structure source. */
  readonly source: KanbanConfigurationSource;
  /** Column or explicit-swimlane operation being configured. */
  readonly operation: KanbanColumnConfigurationOperation | KanbanSwimlaneConfigurationOperation;
  /** Optional application request authority; omission selects result-only behavior. */
  readonly authority?: KanbanConfigurationAuthority;
}

/** Mutable state retained behind immutable session snapshots. */
interface SessionState {
  record: KanbanConfigurationSessionSnapshot['record'];
  label: string;
  baselineLabel: string;
  dirty: boolean;
  submission: KanbanConfigurationSessionSnapshot['submission'];
  code?: string;
}

/** Raises a fixed session-construction failure without retaining application input. */
function invalidSession(): never {
  throw new Error('Invalid Kanban configuration session.');
}

/** Narrows a function with no arguments and unknown output without invoking it. */
function isResolver(value: unknown): value is () => Promise<KanbanConfigurationSnapshot> {
  return typeof value === 'function';
}

/** Narrows the configuration subscription seam without invoking it. */
function isSubscriber(
  value: unknown,
): value is (listener: (snapshot: KanbanConfigurationSnapshot) => void) => () => void {
  return typeof value === 'function';
}

/** Narrows the application request seam without invoking it. */
function isRequester(
  value: unknown,
): value is (proposal: KanbanRequestProposal) => KanbanRequestResult | Promise<KanbanRequestResult> {
  return typeof value === 'function';
}

/** Returns one string member without coercing application values. */
function requiredString(value: unknown): string {
  if (typeof value !== 'string') return invalidSession();
  return value;
}

/** Validates and detaches one selected column or swimlane operation. */
function configurationOperation(
  value: unknown,
): KanbanColumnConfigurationOperation | KanbanSwimlaneConfigurationOperation {
  const properties = snapshotKanbanDataProperties(value, OPERATION_KEYS.size);
  validateKanbanDataKeys(properties, OPERATION_KEYS);
  if (properties.columnId !== undefined && properties.swimlaneId === undefined) {
    const columnId = createKanbanColumnId(requiredString(properties.columnId));
    switch (properties.kind) {
      case 'add':
        if (Object.keys(properties).length !== 3) return invalidSession();
        return Object.freeze({
          kind: 'add',
          columnId,
          position: snapshotKanbanRequestProposal({
            kind: 'column-reorder',
            columnId,
            position: properties.position,
          }).position,
        });
      case 'update':
        if (Object.keys(properties).length !== 2) return invalidSession();
        return Object.freeze({ kind: 'update', columnId });
      case 'reorder':
        if (Object.keys(properties).length !== 2) return invalidSession();
        return Object.freeze({ kind: 'reorder', columnId });
      case 'delete':
        if (Object.keys(properties).length !== (properties.policy === undefined ? 3 : 4)) return invalidSession();
        return Object.freeze({
          kind: 'delete',
          columnId,
          occupancy: snapshotKanbanConfigurationOccupancy(properties.occupancy),
          ...(properties.policy === undefined ? {} : { policy: properties.policy }),
        });
      default:
        return invalidSession();
    }
  }
  if (properties.swimlaneId !== undefined && properties.columnId === undefined) {
    const swimlaneId = createKanbanSwimlaneId(requiredString(properties.swimlaneId));
    switch (properties.kind) {
      case 'add':
        if (Object.keys(properties).length !== 3) return invalidSession();
        return Object.freeze({
          kind: 'add',
          swimlaneId,
          position: snapshotKanbanRequestProposal({
            kind: 'swimlane-reorder',
            swimlaneId,
            position: properties.position,
          }).position,
        });
      case 'update':
        if (Object.keys(properties).length !== 2) return invalidSession();
        return Object.freeze({ kind: 'update', swimlaneId });
      case 'reorder':
        if (Object.keys(properties).length !== 2) return invalidSession();
        return Object.freeze({ kind: 'reorder', swimlaneId });
      case 'delete':
        if (Object.keys(properties).length !== (properties.policy === undefined ? 3 : 4)) return invalidSession();
        return Object.freeze({
          kind: 'delete',
          swimlaneId,
          occupancy: snapshotKanbanConfigurationOccupancy(properties.occupancy),
          ...(properties.policy === undefined ? {} : { policy: properties.policy }),
        });
      default:
        return invalidSession();
    }
  }
  return invalidSession();
}

/** Validates function-valued application seams without invoking accessors. */
function sessionOptions(value: unknown): KanbanConfigurationSessionOptions {
  const properties = snapshotKanbanDataProperties(value, SESSION_KEYS.size);
  validateKanbanDataKeys(properties, SESSION_KEYS);
  const sourceProperties = snapshotKanbanDataProperties(properties.source, SOURCE_KEYS.size);
  validateKanbanDataKeys(sourceProperties, SOURCE_KEYS);
  if (!isResolver(sourceProperties.resolve) || !isSubscriber(sourceProperties.subscribe)) return invalidSession();
  let authority: KanbanConfigurationAuthority | undefined;
  if (properties.authority !== undefined) {
    const authorityProperties = snapshotKanbanDataProperties(properties.authority, AUTHORITY_KEYS.size);
    validateKanbanDataKeys(authorityProperties, AUTHORITY_KEYS);
    if (!isRequester(authorityProperties.request)) return invalidSession();
    authority = Object.freeze({ request: authorityProperties.request });
  }
  return Object.freeze({
    source: Object.freeze({ resolve: sourceProperties.resolve, subscribe: sourceProperties.subscribe }),
    operation: configurationOperation(properties.operation),
    ...(authority === undefined ? {} : { authority }),
  });
}

/** Returns the label represented by an operation in one authoritative snapshot. */
function operationLabel(
  operation: KanbanConfigurationSessionOptions['operation'],
  snapshot: KanbanConfigurationSnapshot,
): string {
  if (operation.kind === 'add' || operation.kind === 'reorder' || operation.kind === 'delete') return '';
  if ('columnId' in operation) {
    return snapshot.columns.find((column) => column.columnId === operation.columnId)?.label ?? '';
  }
  return snapshot.swimlanes.find((swimlane) => swimlane.swimlaneId === operation.swimlaneId)?.label ?? '';
}

/** Builds the exact proposal represented by current session state. */
function proposalFor(
  operation: KanbanConfigurationSessionOptions['operation'],
  snapshot: KanbanConfigurationSnapshot,
  label: string,
  position: unknown,
): KanbanRequestProposal {
  if ('columnId' in operation) {
    switch (operation.kind) {
      case 'add':
        return buildKanbanColumnAddProposal({
          snapshot,
          draft: { columnId: operation.columnId, label },
          position: operation.position,
        });
      case 'update':
        return buildKanbanColumnUpdateProposal({ snapshot, columnId: operation.columnId, changes: { label } });
      case 'reorder':
        return buildKanbanColumnReorderProposal({ snapshot, columnId: operation.columnId, position });
      case 'delete':
        return buildKanbanColumnDeleteProposal({
          snapshot,
          columnId: operation.columnId,
          occupancy: operation.occupancy,
          ...(operation.policy === undefined ? {} : { policy: operation.policy }),
        });
    }
  }
  switch (operation.kind) {
    case 'add':
      return buildKanbanSwimlaneAddProposal({
        snapshot,
        draft: { swimlaneId: operation.swimlaneId, label },
        position: operation.position,
      });
    case 'update':
      return buildKanbanSwimlaneUpdateProposal({ snapshot, swimlaneId: operation.swimlaneId, changes: { label } });
    case 'reorder':
      return buildKanbanSwimlaneReorderProposal({ snapshot, swimlaneId: operation.swimlaneId, position });
    case 'delete':
      return buildKanbanSwimlaneDeleteProposal({
        snapshot,
        swimlaneId: operation.swimlaneId,
        occupancy: operation.occupancy,
        ...(operation.policy === undefined ? {} : { policy: operation.policy }),
      });
  }
}

/** Converts an application response to a detached request result without trusting its public properties. */
function applicationResult(value: unknown): KanbanRequestResult {
  const properties = snapshotKanbanDataProperties(value);
  if (typeof properties.operationId !== 'string') return invalidSession();
  return snapshotKanbanRequestResult(value, createKanbanOperationId(properties.operationId));
}

/**
 * Creates one isolated configuration session after resolving the initial authoritative structure.
 *
 * @example
 * ```ts
 * const session = await createKanbanConfigurationSession({
 *   source,
 *   operation: { kind: 'update', columnId: 'todo' },
 * });
 * ```
 */
export async function createKanbanConfigurationSession(value: unknown): Promise<KanbanConfigurationSession> {
  const options = sessionOptions(value);
  let disposed = false;
  let generation = 0;
  let structure: KanbanConfigurationSnapshot;
  let publicationDuringResolve: KanbanConfigurationSnapshot | undefined;
  let position: unknown = { kind: 'end' };
  const state: SessionState = {
    record: 'loading',
    label: '',
    baselineLabel: '',
    dirty: false,
    submission: 'idle',
  };
  const listeners = new Set<(snapshot: KanbanConfigurationSessionSnapshot) => void>();

  const snapshot = (): KanbanConfigurationSessionSnapshot =>
    Object.freeze({
      record: state.record,
      label: state.label,
      dirty: state.dirty,
      submission: state.submission,
      ...(state.code === undefined ? {} : { code: state.code }),
    });
  const publish = (): void => {
    const current = snapshot();
    for (const listener of [...listeners]) {
      try {
        listener(current);
      } catch {
        // One application observer cannot prevent the dialog or sibling observers from progressing.
      }
    }
  };
  const rebase = (next: KanbanConfigurationSnapshot): void => {
    structure = createKanbanConfigurationSnapshot(next);
    const label = operationLabel(options.operation, structure);
    state.label = label;
    state.baselineLabel = label;
    state.dirty = false;
    state.record = 'ready';
    state.submission = 'idle';
    delete state.code;
  };
  const publication = (next: KanbanConfigurationSnapshot): void => {
    if (disposed) return;
    try {
      const validated = createKanbanConfigurationSnapshot(next);
      if (state.record === 'loading') {
        publicationDuringResolve = validated;
        return;
      }
      if (state.dirty || state.submission === 'dispatching') {
        structure = validated;
        state.record = 'stale';
      } else {
        rebase(validated);
      }
    } catch {
      state.record = 'unavailable';
    }
    publish();
  };

  let unsubscribe: () => void;
  try {
    unsubscribe = options.source.subscribe(publication);
    if (typeof unsubscribe !== 'function') return invalidSession();
  } catch {
    return invalidSession();
  }
  try {
    const resolved = createKanbanConfigurationSnapshot(await options.source.resolve());
    structure = publicationDuringResolve ?? resolved;
    publicationDuringResolve = undefined;
    rebase(structure);
  } catch {
    unsubscribe();
    return invalidSession();
  }

  return Object.freeze({
    snapshot,
    setLabel(input: unknown): boolean {
      if (disposed || state.record === 'unavailable') return false;
      try {
        state.label = normalizeKanbanConfigurationName(input).label;
        state.dirty = state.label !== state.baselineLabel;
        state.submission = 'idle';
        delete state.code;
        publish();
        return true;
      } catch {
        return false;
      }
    },
    setPosition(next: Parameters<KanbanConfigurationSession['setPosition']>[0]): boolean {
      if (disposed || state.record === 'unavailable') return false;
      position = next;
      state.dirty = true;
      state.submission = 'idle';
      delete state.code;
      publish();
      return true;
    },
    async apply(): Promise<KanbanConfigurationSessionApplyResult> {
      if (disposed) return Object.freeze({ kind: 'disposed' });
      if (state.record === 'stale') return Object.freeze({ kind: 'stale' });
      if (state.record !== 'ready') return Object.freeze({ kind: 'unavailable' });
      let proposal: KanbanRequestProposal;
      try {
        proposal = proposalFor(options.operation, structure, state.label, position);
      } catch {
        return Object.freeze({ kind: 'failed' });
      }
      if (options.authority === undefined) return Object.freeze({ kind: 'proposal', proposal });
      const ownGeneration = ++generation;
      state.submission = 'dispatching';
      publish();
      try {
        const result = applicationResult(await options.authority.request(proposal));
        if (disposed || ownGeneration !== generation) return Object.freeze({ kind: 'disposed' });
        if (result.kind === 'accepted') {
          state.submission = 'accepted';
          publish();
          return Object.freeze({ kind: 'accepted', operationId: result.operationId });
        }
        state.submission = 'rejected';
        state.code = result.code ?? result.kind;
        publish();
        return Object.freeze({ kind: 'rejected', code: state.code });
      } catch {
        if (disposed || ownGeneration !== generation) return Object.freeze({ kind: 'disposed' });
        state.submission = 'rejected';
        state.code = 'request-failed';
        publish();
        return Object.freeze({ kind: 'rejected', code: state.code });
      }
    },
    async reload(): Promise<boolean> {
      if (disposed) return false;
      const ownGeneration = ++generation;
      try {
        const resolved = createKanbanConfigurationSnapshot(await options.source.resolve());
        if (disposed || ownGeneration !== generation) return false;
        rebase(resolved);
        publish();
        return true;
      } catch {
        if (!disposed && ownGeneration === generation) {
          state.record = 'unavailable';
          publish();
        }
        return false;
      }
    },
    subscribe(listener: (current: KanbanConfigurationSessionSnapshot) => void): () => void {
      if (disposed || typeof listener !== 'function' || listeners.size >= MAXIMUM_LISTENERS) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      generation += 1;
      listeners.clear();
      try {
        unsubscribe();
      } catch {
        // A hostile source disposer cannot keep the session or dialog alive.
      }
    },
    disposed: () => disposed,
  });
}
