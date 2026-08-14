import { snapshotKanbanReasonCode } from '../contract/capability.js';
import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import type { KanbanDataProperties } from '../contract/data-snapshot.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import {
  createKanbanCardKey,
  createKanbanColumnId,
  createKanbanOperationId,
  createKanbanSwimlaneId,
} from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type {
  KanbanActionEventInput,
  KanbanActionEventState,
  KanbanEventCounts,
  KanbanEventInput,
  KanbanFocusEventTarget,
  KanbanRequestEventInput,
} from './types.js';
import type { KanbanActionOrigin } from '../command/types.js';
import type { KanbanRequest } from '../contract/request.js';
import type { KanbanOperationState } from '../operation/types.js';

/** Maximum UTF-8 bytes accepted for one action identity. */
const MAX_ACTION_ID_BYTES = 256;
/** Maximum payload-free counter entries on one event. */
const MAX_EVENT_COUNTS = 32;
/** Controls forbidden in public event action identities. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
/** Safe grammar for event counter keys. */
const COUNTER_KEY = /^[a-z][a-z0-9-]*$/u;
/** Closed members for each event input variant. */
const EVENT_KEYS = Object.freeze({
  action: new Set(['kind', 'actionId', 'origin', 'state', 'code']),
  request: new Set(['kind', 'operationId', 'requestKind', 'state', 'code']),
  focus: new Set(['kind', 'target']),
  selection: new Set(['kind', 'count']),
  view: new Set(['kind', 'revision']),
  source: new Set(['kind', 'state', 'revision', 'queryRevision']),
  error: new Set(['kind', 'code', 'counts']),
  degradation: new Set(['kind', 'code', 'counts']),
});
/** Closed focus-target members by discriminator. */
const FOCUS_KEYS = Object.freeze({
  board: new Set(['kind']),
  card: new Set(['kind', 'cardKey']),
  cell: new Set(['kind', 'columnId', 'swimlaneId']),
  column: new Set(['kind', 'columnId']),
  swimlane: new Set(['kind', 'swimlaneId']),
});

/** Raises the payload-free event validation error. */
function invalidEvent(): never {
  throw new KanbanInvalidSemanticValueError();
}

/** Narrows one event discriminator through the closed public inventory. */
function eventKind(value: unknown): keyof typeof EVENT_KEYS {
  switch (value) {
    case 'action':
    case 'request':
    case 'focus':
    case 'selection':
    case 'view':
    case 'source':
    case 'error':
    case 'degradation':
      return value;
    default:
      return invalidEvent();
  }
}

/** Narrows one action origin through the closed public inventory. */
function actionOrigin(value: unknown): KanbanActionOrigin {
  switch (value) {
    case 'keyboard':
    case 'menu':
    case 'context-menu':
    case 'status':
    case 'pointer':
    case 'programmatic':
      return value;
    default:
      return invalidEvent();
  }
}

/** Narrows one action lifecycle state. */
function actionState(value: unknown): KanbanActionEventState {
  switch (value) {
    case 'intent':
    case 'pending':
    case 'handled':
    case 'disabled':
    case 'hidden':
    case 'unavailable':
      return value;
    default:
      return invalidEvent();
  }
}

/** Narrows one request discriminator without retaining extension payloads. */
function requestKind(value: unknown): KanbanRequest['kind'] {
  switch (value) {
    case 'card-create':
    case 'card-update':
    case 'card-duplicate':
    case 'card-archive':
    case 'card-delete':
    case 'card-move':
    case 'column-add':
    case 'column-update':
    case 'column-reorder':
    case 'column-delete':
    case 'swimlane-add':
    case 'swimlane-update':
    case 'swimlane-reorder':
    case 'swimlane-delete':
    case 'saved-view-save':
    case 'saved-view-rename':
    case 'saved-view-delete':
    case 'extension':
      return value;
    default:
      return invalidEvent();
  }
}

/** Narrows one existing operation lifecycle state. */
function requestState(value: unknown): KanbanOperationState {
  switch (value) {
    case 'proposed':
    case 'pending':
    case 'accepted':
    case 'committed':
    case 'rejected':
    case 'cancelled':
    case 'superseded':
      return value;
    default:
      return invalidEvent();
  }
}

/** Returns one bounded action identity without retaining invalid input. */
function actionId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_ACTION_ID_BYTES ||
    CONTROL_CHARACTERS.test(value) ||
    new TextEncoder().encode(value).byteLength > MAX_ACTION_ID_BYTES
  ) {
    return invalidEvent();
  }
  return value;
}

/** Copies optional safe reason-code evidence. */
function optionalCode(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return snapshotKanbanReasonCode(value) ?? invalidEvent();
}

/** Copies bounded finite non-negative counters. */
function eventCounts(value: unknown): KanbanEventCounts | undefined {
  if (value === undefined) return undefined;
  const properties = snapshotKanbanDataProperties(value, MAX_EVENT_COUNTS);
  const result: Record<string, number> = {};
  for (const key of Object.keys(properties).sort()) {
    const count = properties[key];
    if (!COUNTER_KEY.test(key) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
      return invalidEvent();
    }
    result[key] = count;
  }
  return Object.freeze(result);
}

/** Copies one exact focus target without record or geometry data. */
function focusTarget(value: unknown): KanbanFocusEventTarget {
  const properties = snapshotKanbanDataProperties(value, 3);
  const kind = properties.kind;
  if (kind === 'board') {
    validateKanbanDataKeys(properties, FOCUS_KEYS.board);
    return Object.freeze({ kind });
  }
  if (kind === 'card') {
    validateKanbanDataKeys(properties, FOCUS_KEYS.card);
    if (typeof properties.cardKey !== 'string' && typeof properties.cardKey !== 'number') return invalidEvent();
    return Object.freeze({ kind, cardKey: createKanbanCardKey(properties.cardKey) });
  }
  if (kind === 'cell') {
    validateKanbanDataKeys(properties, FOCUS_KEYS.cell);
    if (typeof properties.columnId !== 'string') return invalidEvent();
    if (properties.swimlaneId !== undefined && typeof properties.swimlaneId !== 'string') return invalidEvent();
    return Object.freeze({
      kind,
      columnId: createKanbanColumnId(properties.columnId),
      ...(properties.swimlaneId === undefined ? {} : { swimlaneId: createKanbanSwimlaneId(properties.swimlaneId) }),
    });
  }
  if (kind === 'column') {
    validateKanbanDataKeys(properties, FOCUS_KEYS.column);
    if (typeof properties.columnId !== 'string') return invalidEvent();
    return Object.freeze({ kind, columnId: createKanbanColumnId(properties.columnId) });
  }
  if (kind !== 'swimlane' || typeof properties.swimlaneId !== 'string') return invalidEvent();
  validateKanbanDataKeys(properties, FOCUS_KEYS.swimlane);
  return Object.freeze({ kind: 'swimlane', swimlaneId: createKanbanSwimlaneId(properties.swimlaneId) });
}

/** Copies one action lifecycle input. */
function actionInput(properties: KanbanDataProperties): KanbanActionEventInput {
  const origin = actionOrigin(properties.origin);
  const state = actionState(properties.state);
  const code = optionalCode(properties.code);
  if ((state === 'disabled' || state === 'unavailable') !== (code !== undefined)) {
    return invalidEvent();
  }
  return Object.freeze({
    kind: 'action',
    actionId: actionId(properties.actionId),
    origin,
    state,
    ...(code === undefined ? {} : { code }),
  });
}

/** Copies one request lifecycle input. */
function requestInput(properties: KanbanDataProperties): KanbanRequestEventInput {
  if (typeof properties.operationId !== 'string') return invalidEvent();
  const kind = requestKind(properties.requestKind);
  const state = requestState(properties.state);
  const code = optionalCode(properties.code);
  return Object.freeze({
    kind: 'request',
    operationId: createKanbanOperationId(properties.operationId),
    requestKind: kind,
    state,
    ...(code === undefined ? {} : { code }),
  });
}

/** Validates, detaches, and freezes one closed event input. */
export function snapshotKanbanEventInput(value: unknown): KanbanEventInput {
  const properties = snapshotKanbanDataProperties(value, 7);
  const kind = eventKind(properties.kind);
  validateKanbanDataKeys(properties, EVENT_KEYS[kind]);
  if (kind === 'action') return actionInput(properties);
  if (kind === 'request') return requestInput(properties);
  if (kind === 'focus') return Object.freeze({ kind, target: focusTarget(properties.target) });
  if (kind === 'selection') {
    if (
      typeof properties.count !== 'number' ||
      !Number.isSafeInteger(properties.count) ||
      properties.count < 0 ||
      properties.count > KANBAN_LIMITS.selectedKeys.absolute
    ) {
      return invalidEvent();
    }
    return Object.freeze({ kind, count: properties.count });
  }
  if (kind === 'view') return Object.freeze({ kind, revision: snapshotKanbanRevision(properties.revision) });
  if (kind === 'source') {
    if (
      properties.state !== 'ready' &&
      properties.state !== 'loading' &&
      properties.state !== 'error' &&
      properties.state !== 'disposed'
    ) {
      return invalidEvent();
    }
    const revision = properties.revision === undefined ? undefined : snapshotKanbanRevision(properties.revision);
    const queryRevision =
      properties.queryRevision === undefined ? undefined : snapshotKanbanRevision(properties.queryRevision);
    return Object.freeze({
      kind,
      state: properties.state,
      ...(revision === undefined ? {} : { revision }),
      ...(queryRevision === undefined ? {} : { queryRevision }),
    });
  }
  const code = snapshotKanbanReasonCode(properties.code) ?? invalidEvent();
  const counts = eventCounts(properties.counts);
  return Object.freeze({ kind, code, ...(counts === undefined ? {} : { counts }) });
}
