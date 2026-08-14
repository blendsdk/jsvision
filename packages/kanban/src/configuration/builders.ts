import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanColumnId, createKanbanSwimlaneId } from '../contract/identity.js';
import type { KanbanColumnId, KanbanSwimlaneId } from '../contract/identity.js';
import type {
  KanbanColumnAddProposal,
  KanbanColumnPosition,
  KanbanColumnReorderProposal,
  KanbanColumnUpdateProposal,
  KanbanSwimlaneAddProposal,
  KanbanSwimlanePosition,
  KanbanSwimlaneReorderProposal,
  KanbanSwimlaneUpdateProposal,
} from '../contract/request.js';
import { snapshotKanbanRequestProposal } from '../contract/request-validation.js';
import { snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import { snapshotKanbanDefinitionOfDone } from '../workflow/definition-of-done.js';
import type { KanbanDefinitionOfDoneSnapshot } from '../workflow/definition-of-done.js';
import {
  buildColumnDeletion,
  buildSwimlaneDeletion,
  type KanbanColumnDeletionProposal,
  type KanbanSwimlaneDeletionProposal,
} from './deletion.js';
import type { KanbanConfigurationSnapshot, KanbanDuplicateConfigurationName } from './types.js';
import {
  createKanbanConfigurationSnapshot,
  normalizeKanbanConfigurationName,
  snapshotKanbanConfigurationOccupancy,
  snapshotKanbanDuplicateConfigurationName,
} from './validation.js';

/** Exact members accepted by a builder input envelope. */
const BUILDER_KEYS = new Set([
  'snapshot',
  'draft',
  'position',
  'columnId',
  'swimlaneId',
  'changes',
  'duplicateName',
  'occupancy',
  'policy',
]);
/** Exact members accepted by one configurable column draft. */
const COLUMN_DRAFT_KEYS = new Set(['columnId', 'label', 'definitionOfDone', 'data']);
/** Exact members accepted by one configurable swimlane draft. */
const SWIMLANE_DRAFT_KEYS = new Set(['swimlaneId', 'label', 'data']);
/** Exact members accepted by one structural rename patch. */
const CHANGE_KEYS = new Set(['label', 'definitionOfDone', 'data']);
/** Exact members accepted by semantic column positions. */
const COLUMN_POSITION_KEYS = new Set(['kind', 'beforeColumnId', 'afterColumnId']);
/** Exact members accepted by semantic swimlane positions. */
const SWIMLANE_POSITION_KEYS = new Set(['kind', 'swimlaneId']);

/** Raises a payload-free failure for malformed or structurally inconsistent builder input. */
function invalidBuilder(): never {
  throw new KanbanInvalidSemanticValueError();
}

/** Returns one string without invoking coercion hooks. */
function requiredString(value: unknown): string {
  if (typeof value !== 'string') return invalidBuilder();
  return value;
}

/** Captures one builder envelope with an exact public shape. */
function builderProperties(value: unknown) {
  const properties = snapshotKanbanDataProperties(value, BUILDER_KEYS.size);
  validateKanbanDataKeys(properties, BUILDER_KEYS);
  return properties;
}

/** Returns one detached authoritative configuration snapshot. */
function configuration(value: unknown): KanbanConfigurationSnapshot {
  return createKanbanConfigurationSnapshot(value);
}

/** Normalizes optional duplicate-name permission. */
function duplicatePermission(value: unknown): KanbanDuplicateConfigurationName | undefined {
  return value === undefined ? undefined : snapshotKanbanDuplicateConfigurationName(value);
}

/** Rejects a duplicate name unless a visible disambiguator explicitly permits it. */
function resolveName(
  value: unknown,
  existingLabels: readonly string[],
  duplicate: KanbanDuplicateConfigurationName | undefined,
): { readonly label: string; readonly disambiguator?: string } {
  const normalized = normalizeKanbanConfigurationName(value);
  const collides = existingLabels.some(
    (label) => normalizeKanbanConfigurationName(label).collisionKey === normalized.collisionKey,
  );
  if (collides && duplicate === undefined) return invalidBuilder();
  return Object.freeze({
    label: normalized.label,
    ...(collides && duplicate !== undefined ? { disambiguator: duplicate.disambiguator } : {}),
  });
}

/** Validates one semantic column position against stable identities in the current snapshot. */
function columnPosition(
  value: unknown,
  snapshot: KanbanConfigurationSnapshot,
  moving?: KanbanColumnId,
): KanbanColumnPosition {
  const properties = snapshotKanbanDataProperties(value, COLUMN_POSITION_KEYS.size);
  validateKanbanDataKeys(properties, COLUMN_POSITION_KEYS);
  if ((properties.kind === 'start' || properties.kind === 'end') && Object.keys(properties).length === 1) {
    return Object.freeze({ kind: properties.kind });
  }
  if (properties.kind !== 'between' || Object.keys(properties).length !== COLUMN_POSITION_KEYS.size) {
    return invalidBuilder();
  }
  const beforeColumnId =
    properties.beforeColumnId === null ? null : createKanbanColumnId(requiredString(properties.beforeColumnId));
  const afterColumnId =
    properties.afterColumnId === null ? null : createKanbanColumnId(requiredString(properties.afterColumnId));
  const known = new Set(snapshot.columns.map((column) => column.columnId));
  if (
    (beforeColumnId === null && afterColumnId === null) ||
    (beforeColumnId !== null && !known.has(beforeColumnId)) ||
    (afterColumnId !== null && !known.has(afterColumnId)) ||
    beforeColumnId === moving ||
    afterColumnId === moving
  ) {
    return invalidBuilder();
  }
  return Object.freeze({ kind: 'between', beforeColumnId, afterColumnId });
}

/** Validates one semantic swimlane position against stable identities in the current snapshot. */
function swimlanePosition(
  value: unknown,
  snapshot: KanbanConfigurationSnapshot,
  moving?: KanbanSwimlaneId,
): KanbanSwimlanePosition {
  const properties = snapshotKanbanDataProperties(value, SWIMLANE_POSITION_KEYS.size);
  validateKanbanDataKeys(properties, SWIMLANE_POSITION_KEYS);
  if ((properties.kind === 'start' || properties.kind === 'end') && Object.keys(properties).length === 1) {
    return Object.freeze({ kind: properties.kind });
  }
  if (
    (properties.kind !== 'before' && properties.kind !== 'after') ||
    Object.keys(properties).length !== SWIMLANE_POSITION_KEYS.size
  ) {
    return invalidBuilder();
  }
  const swimlaneId = createKanbanSwimlaneId(requiredString(properties.swimlaneId));
  if (!snapshot.swimlanes.some((swimlane) => swimlane.swimlaneId === swimlaneId) || swimlaneId === moving) {
    return invalidBuilder();
  }
  return Object.freeze({ kind: properties.kind, swimlaneId });
}

/** Snapshots optional generic application metadata without interpreting it. */
function optionalData(value: unknown): { readonly data?: ReturnType<typeof snapshotKanbanSemanticValue> } {
  return value === undefined ? Object.freeze({}) : Object.freeze({ data: snapshotKanbanSemanticValue(value) });
}

/** Snapshots optional definition-of-done evidence. */
function optionalDefinition(value: unknown): { readonly definitionOfDone?: KanbanDefinitionOfDoneSnapshot } {
  return value === undefined
    ? Object.freeze({})
    : Object.freeze({ definitionOfDone: snapshotKanbanDefinitionOfDone(value) });
}

/**
 * Builds a validated lifecycle-free column-add proposal without opening UI or dispatching it.
 *
 * @example
 * ```ts
 * buildKanbanColumnAddProposal({ snapshot, draft: { columnId: 'done', label: 'Done' }, position: { kind: 'end' } });
 * ```
 */
export function buildKanbanColumnAddProposal(value: unknown): KanbanColumnAddProposal {
  const properties = builderProperties(value);
  const snapshot = configuration(properties.snapshot);
  const draft = snapshotKanbanDataProperties(properties.draft, COLUMN_DRAFT_KEYS.size);
  validateKanbanDataKeys(draft, COLUMN_DRAFT_KEYS);
  const columnId = createKanbanColumnId(requiredString(draft.columnId));
  if (snapshot.columns.some((column) => column.columnId === columnId)) return invalidBuilder();
  const name = resolveName(
    draft.label,
    snapshot.columns.map((column) => column.label),
    duplicatePermission(properties.duplicateName),
  );
  return snapshotKanbanRequestProposal({
    kind: 'column-add',
    draft: {
      columnId,
      ...name,
      ...optionalDefinition(draft.definitionOfDone),
      ...optionalData(draft.data),
    },
    position: columnPosition(properties.position, snapshot),
  });
}

/** Builds a validated lifecycle-free column-update proposal while preserving column identity. */
export function buildKanbanColumnUpdateProposal(value: unknown): KanbanColumnUpdateProposal {
  const properties = builderProperties(value);
  const snapshot = configuration(properties.snapshot);
  const columnId = createKanbanColumnId(requiredString(properties.columnId));
  if (!snapshot.columns.some((column) => column.columnId === columnId)) return invalidBuilder();
  const changes = snapshotKanbanDataProperties(properties.changes, CHANGE_KEYS.size);
  validateKanbanDataKeys(changes, CHANGE_KEYS);
  if (Object.keys(changes).length === 0) return invalidBuilder();
  const name =
    changes.label === undefined
      ? {}
      : resolveName(
          changes.label,
          snapshot.columns.filter((column) => column.columnId !== columnId).map((column) => column.label),
          duplicatePermission(properties.duplicateName),
        );
  return snapshotKanbanRequestProposal({
    kind: 'column-update',
    columnId,
    patch: {
      ...name,
      ...optionalDefinition(changes.definitionOfDone),
      ...optionalData(changes.data),
    },
  });
}

/** Builds a validated lifecycle-free stable-neighbor column-reorder proposal. */
export function buildKanbanColumnReorderProposal(value: unknown): KanbanColumnReorderProposal {
  const properties = builderProperties(value);
  const snapshot = configuration(properties.snapshot);
  const columnId = createKanbanColumnId(requiredString(properties.columnId));
  if (!snapshot.columns.some((column) => column.columnId === columnId)) return invalidBuilder();
  return snapshotKanbanRequestProposal({
    kind: 'column-reorder',
    columnId,
    position: columnPosition(properties.position, snapshot, columnId),
  });
}

/** Builds an empty-column delete proposal without presenting UI confirmation. */
export function buildKanbanColumnDeleteProposal(value: unknown): KanbanColumnDeletionProposal {
  const properties = builderProperties(value);
  const snapshot = configuration(properties.snapshot);
  const columnId = createKanbanColumnId(requiredString(properties.columnId));
  if (!snapshot.columns.some((column) => column.columnId === columnId)) return invalidBuilder();
  return buildColumnDeletion(
    snapshot,
    columnId,
    snapshotKanbanConfigurationOccupancy(properties.occupancy),
    properties.policy,
  );
}

/** Builds a validated lifecycle-free explicit-swimlane-add proposal. */
export function buildKanbanSwimlaneAddProposal(value: unknown): KanbanSwimlaneAddProposal {
  const properties = builderProperties(value);
  const snapshot = configuration(properties.snapshot);
  const draft = snapshotKanbanDataProperties(properties.draft, SWIMLANE_DRAFT_KEYS.size);
  validateKanbanDataKeys(draft, SWIMLANE_DRAFT_KEYS);
  const swimlaneId = createKanbanSwimlaneId(requiredString(draft.swimlaneId));
  if (snapshot.swimlanes.some((swimlane) => swimlane.swimlaneId === swimlaneId)) return invalidBuilder();
  const name = resolveName(
    draft.label,
    snapshot.swimlanes.map((swimlane) => swimlane.label),
    duplicatePermission(properties.duplicateName),
  );
  return snapshotKanbanRequestProposal({
    kind: 'swimlane-add',
    draft: { swimlaneId, ...name, ...optionalData(draft.data) },
    position: swimlanePosition(properties.position, snapshot),
  });
}

/** Builds a validated lifecycle-free explicit-swimlane-update proposal. */
export function buildKanbanSwimlaneUpdateProposal(value: unknown): KanbanSwimlaneUpdateProposal {
  const properties = builderProperties(value);
  const snapshot = configuration(properties.snapshot);
  const swimlaneId = createKanbanSwimlaneId(requiredString(properties.swimlaneId));
  const current = snapshot.swimlanes.find((swimlane) => swimlane.swimlaneId === swimlaneId);
  if (current === undefined || current.mode !== 'explicit') return invalidBuilder();
  const changes = snapshotKanbanDataProperties(properties.changes, CHANGE_KEYS.size);
  validateKanbanDataKeys(changes, CHANGE_KEYS);
  if (Object.keys(changes).length === 0 || changes.definitionOfDone !== undefined) return invalidBuilder();
  const name =
    changes.label === undefined
      ? {}
      : resolveName(
          changes.label,
          snapshot.swimlanes.filter((swimlane) => swimlane.swimlaneId !== swimlaneId).map((swimlane) => swimlane.label),
          duplicatePermission(properties.duplicateName),
        );
  return snapshotKanbanRequestProposal({
    kind: 'swimlane-update',
    swimlaneId,
    patch: { ...name, ...optionalData(changes.data) },
  });
}

/** Builds a validated lifecycle-free stable-neighbor explicit-swimlane-reorder proposal. */
export function buildKanbanSwimlaneReorderProposal(value: unknown): KanbanSwimlaneReorderProposal {
  const properties = builderProperties(value);
  const snapshot = configuration(properties.snapshot);
  const swimlaneId = createKanbanSwimlaneId(requiredString(properties.swimlaneId));
  const current = snapshot.swimlanes.find((swimlane) => swimlane.swimlaneId === swimlaneId);
  if (current === undefined || current.mode !== 'explicit') return invalidBuilder();
  return snapshotKanbanRequestProposal({
    kind: 'swimlane-reorder',
    swimlaneId,
    position: swimlanePosition(properties.position, snapshot, swimlaneId),
  });
}

/** Builds an empty explicit-swimlane delete proposal without presenting UI confirmation. */
export function buildKanbanSwimlaneDeleteProposal(value: unknown): KanbanSwimlaneDeletionProposal {
  const properties = builderProperties(value);
  const snapshot = configuration(properties.snapshot);
  const swimlaneId = createKanbanSwimlaneId(requiredString(properties.swimlaneId));
  const current = snapshot.swimlanes.find((swimlane) => swimlane.swimlaneId === swimlaneId);
  if (current === undefined || current.mode !== 'explicit') return invalidBuilder();
  return buildSwimlaneDeletion(
    snapshot,
    swimlaneId,
    snapshotKanbanConfigurationOccupancy(properties.occupancy),
    properties.policy,
  );
}
