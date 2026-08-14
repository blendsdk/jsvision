import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { createKanbanColumnId, createKanbanOperationId, createKanbanSwimlaneId } from '../contract/identity.js';
import type {
  KanbanExpectedEntityRevision,
  KanbanPublicationExpectation,
  KanbanRequestProposal,
  KanbanRequestResult,
} from '../contract/request.js';
import { snapshotKanbanRequestProposal, snapshotKanbanRequestResult } from '../contract/request-validation.js';
import { kanbanRevisionsEqual } from '../contract/revision.js';
import { snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanDefinitionOfDoneSnapshot } from '../workflow/definition-of-done.js';
import type { KanbanStructureStyle, KanbanWipPolicy } from '../source/types.js';
import {
  reconcileKanbanDeletedColumnFocus,
  reconcileKanbanDeletedSwimlaneFocus,
} from '../board/board-configuration-binding.js';
import type { KanbanConfigurationFocusTarget } from '../board/board-configuration-binding.js';
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
import { snapshotKanbanConfigurationDeletionPolicy, type KanbanConfigurationDeletionPolicy } from './deletion.js';
import type { KanbanConfigurationSessionOptions } from './session.js';
import type {
  KanbanColumnConfigurationOperation,
  KanbanConfigurationAuthority,
  KanbanConfigurationDeletionDestination,
  KanbanConfigurationReorderDestination,
  KanbanConfigurationSnapshot,
  KanbanSwimlaneConfigurationOperation,
} from './types.js';
import { snapshotKanbanConfigurationOccupancy } from './validation.js';

/** Exact keys accepted by a configuration-session constructor. */
const SESSION_KEYS = new Set(['source', 'operation', 'authority', 'signal']);
/** Exact keys accepted by the source seam. */
const SOURCE_KEYS = new Set(['resolve', 'subscribe']);
/** Exact keys accepted by the optional authority seam. */
const AUTHORITY_KEYS = new Set(['request']);
/** Exact union of members accepted by one selected configuration operation. */
const OPERATION_KEYS = new Set(['kind', 'columnId', 'swimlaneId', 'position', 'occupancy', 'policy']);

/** Raises a fixed session-construction failure without retaining application input. */
export function invalidSession(): never {
  throw new Error('Invalid Kanban configuration session.');
}

/** Narrows a function with no arguments and unknown output without invoking it. */
function isResolver(
  value: unknown,
): value is (context?: { readonly signal: AbortSignal }) => Promise<KanbanConfigurationSnapshot> {
  return typeof value === 'function';
}

/** Narrows the configuration subscription seam without invoking it. */
function isSubscriber(
  value: unknown,
): value is (listener: (snapshot: KanbanConfigurationSnapshot) => void) => () => void {
  return typeof value === 'function';
}

/** Narrows the application request seam without invoking it. */
function isRequester(value: unknown): value is KanbanConfigurationAuthority['request'] {
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
          ...(properties.policy === undefined
            ? {}
            : { policy: snapshotKanbanConfigurationDeletionPolicy(properties.policy) }),
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
          ...(properties.policy === undefined
            ? {}
            : { policy: snapshotKanbanConfigurationDeletionPolicy(properties.policy) }),
        });
      default:
        return invalidSession();
    }
  }
  return invalidSession();
}

/** Validates function-valued application seams without invoking accessors. */
export function sessionOptions(value: unknown): KanbanConfigurationSessionOptions {
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
  if (properties.signal !== undefined && !(properties.signal instanceof AbortSignal)) return invalidSession();
  return Object.freeze({
    source: Object.freeze({ resolve: sourceProperties.resolve, subscribe: sourceProperties.subscribe }),
    operation: configurationOperation(properties.operation),
    ...(authority === undefined ? {} : { authority }),
    ...(properties.signal === undefined ? {} : { signal: properties.signal }),
  });
}

/** Returns the label represented by an operation in one authoritative snapshot. */
export function operationLabel(
  operation: KanbanConfigurationSessionOptions['operation'],
  snapshot: KanbanConfigurationSnapshot,
): string {
  if (operation.kind === 'add') return '';
  if ('columnId' in operation) {
    return snapshot.columns.find((column) => column.columnId === operation.columnId)?.label ?? '';
  }
  return snapshot.swimlanes.find((swimlane) => swimlane.swimlaneId === operation.swimlaneId)?.label ?? '';
}

/** Builds the exact proposal represented by current session state. */
export function proposalFor(
  operation: KanbanConfigurationSessionOptions['operation'],
  snapshot: KanbanConfigurationSnapshot,
  draft: {
    readonly label: string;
    readonly disambiguator?: string;
    readonly definitionOfDone?: KanbanDefinitionOfDoneSnapshot;
    readonly definitionOfDoneChanged: boolean;
    readonly wip?: KanbanWipPolicy;
    readonly wipChanged: boolean;
    readonly style?: KanbanStructureStyle;
    readonly styleChanged: boolean;
    readonly data?: ReturnType<typeof snapshotKanbanSemanticValue>;
    readonly dataChanged: boolean;
  },
  position: unknown,
  deletionPolicy: KanbanConfigurationDeletionPolicy | undefined,
): KanbanRequestProposal {
  const duplicateName =
    draft.disambiguator === undefined ? {} : { duplicateName: { disambiguator: draft.disambiguator } };
  if ('columnId' in operation) {
    switch (operation.kind) {
      case 'add':
        return buildKanbanColumnAddProposal({
          snapshot,
          draft: {
            columnId: operation.columnId,
            label: draft.label,
            ...(draft.definitionOfDone === undefined ? {} : { definitionOfDone: draft.definitionOfDone }),
            ...(draft.wip === undefined ? {} : { wip: draft.wip }),
            ...(draft.style === undefined ? {} : { style: draft.style }),
            ...(draft.data === undefined ? {} : { data: draft.data }),
          },
          position: operation.position,
          ...duplicateName,
        });
      case 'update':
        return buildKanbanColumnUpdateProposal({
          snapshot,
          columnId: operation.columnId,
          changes: {
            label: draft.label,
            ...(draft.definitionOfDoneChanged ? { definitionOfDone: draft.definitionOfDone ?? null } : {}),
            ...(draft.wipChanged ? { wip: draft.wip ?? null } : {}),
            ...(draft.styleChanged ? { style: draft.style ?? null } : {}),
            ...(draft.dataChanged ? { data: draft.data ?? null } : {}),
          },
          ...duplicateName,
        });
      case 'reorder':
        return buildKanbanColumnReorderProposal({ snapshot, columnId: operation.columnId, position });
      case 'delete':
        return buildKanbanColumnDeleteProposal({
          snapshot,
          columnId: operation.columnId,
          occupancy: operation.occupancy,
          ...(deletionPolicy === undefined ? {} : { policy: deletionPolicy }),
        });
    }
  }
  switch (operation.kind) {
    case 'add':
      return buildKanbanSwimlaneAddProposal({
        snapshot,
        draft: {
          swimlaneId: operation.swimlaneId,
          label: draft.label,
          ...(draft.style === undefined ? {} : { style: draft.style }),
          ...(draft.data === undefined ? {} : { data: draft.data }),
        },
        position: operation.position,
        ...duplicateName,
      });
    case 'update':
      return buildKanbanSwimlaneUpdateProposal({
        snapshot,
        swimlaneId: operation.swimlaneId,
        changes: {
          label: draft.label,
          ...(draft.styleChanged ? { style: draft.style ?? null } : {}),
          ...(draft.dataChanged ? { data: draft.data ?? null } : {}),
        },
        ...duplicateName,
      });
    case 'reorder':
      return buildKanbanSwimlaneReorderProposal({ snapshot, swimlaneId: operation.swimlaneId, position });
    case 'delete':
      return buildKanbanSwimlaneDeleteProposal({
        snapshot,
        swimlaneId: operation.swimlaneId,
        occupancy: operation.occupancy,
        ...(deletionPolicy === undefined ? {} : { policy: deletionPolicy }),
      });
  }
}

/** Converts an application response to a detached request result without trusting its public properties. */
export function applicationResult(value: unknown): KanbanRequestResult {
  const properties = snapshotKanbanDataProperties(value);
  if (typeof properties.operationId !== 'string') return invalidSession();
  return snapshotKanbanRequestResult(value, createKanbanOperationId(properties.operationId));
}

/** Captures revisions for the edited identity and every stable neighbor named by the proposal. */
export function authorityEntities(
  operation: KanbanConfigurationSessionOptions['operation'],
  snapshot: KanbanConfigurationSnapshot,
  proposal: KanbanRequestProposal,
): readonly KanbanExpectedEntityRevision[] {
  const entities: KanbanExpectedEntityRevision[] = [];
  const addColumn = (columnId: string): void => {
    const column = snapshot.columns.find((entry) => entry.columnId === columnId);
    if (
      column !== undefined &&
      !entities.some((entry) => entry.kind === 'column' && entry.columnId === column.columnId)
    ) {
      entities.push(Object.freeze({ kind: 'column', columnId: column.columnId, revision: column.revision }));
    }
  };
  const addSwimlane = (swimlaneId: string): void => {
    const swimlane = snapshot.swimlanes.find((entry) => entry.swimlaneId === swimlaneId);
    if (
      swimlane !== undefined &&
      !entities.some((entry) => entry.kind === 'swimlane' && entry.swimlaneId === swimlane.swimlaneId)
    ) {
      entities.push(Object.freeze({ kind: 'swimlane', swimlaneId: swimlane.swimlaneId, revision: swimlane.revision }));
    }
  };
  if ('columnId' in operation) addColumn(operation.columnId);
  else addSwimlane(operation.swimlaneId);
  if (proposal.kind === 'column-add' || proposal.kind === 'column-reorder') {
    if (proposal.position.kind === 'between') {
      if (proposal.position.beforeColumnId !== null) addColumn(proposal.position.beforeColumnId);
      if (proposal.position.afterColumnId !== null) addColumn(proposal.position.afterColumnId);
    }
  }
  if (proposal.kind === 'swimlane-add' || proposal.kind === 'swimlane-reorder') {
    if (proposal.position.kind === 'before' || proposal.position.kind === 'after')
      addSwimlane(proposal.position.swimlaneId);
  }
  if (proposal.kind === 'column-delete' && proposal.reassignTo !== undefined) addColumn(proposal.reassignTo);
  if (proposal.kind === 'swimlane-delete' && proposal.reassignTo !== undefined) addSwimlane(proposal.reassignTo);
  return Object.freeze(entities);
}

/** Finds the publication subject that represents the configured structural identity. */
export function operationSubject(
  operation: KanbanConfigurationSessionOptions['operation'],
  expectation: KanbanPublicationExpectation,
) {
  return expectation.subjects.find((subject) =>
    'columnId' in operation
      ? subject.kind === 'column' && subject.columnId === operation.columnId
      : subject.kind === 'swimlane' && subject.swimlaneId === operation.swimlaneId,
  );
}

/** Classifies one publication against accepted operation metadata without inferring application records. */
export function publicationOutcome(
  operation: KanbanConfigurationSessionOptions['operation'],
  baseline: KanbanConfigurationSnapshot,
  next: KanbanConfigurationSnapshot,
  expectation: KanbanPublicationExpectation,
): 'pending' | 'committed' | 'contradictory' {
  const subject = operationSubject(operation, expectation);
  if (subject === undefined) return 'contradictory';
  const entity =
    subject.kind === 'column'
      ? next.columns.find((entry) => entry.columnId === subject.columnId)
      : subject.kind === 'swimlane'
        ? next.swimlanes.find((entry) => entry.swimlaneId === subject.swimlaneId)
        : undefined;
  if (operation.kind === 'delete') {
    if (entity === undefined && !kanbanRevisionsEqual(next.revision, baseline.revision)) return 'committed';
  } else if (entity !== undefined && kanbanRevisionsEqual(entity.revision, subject.expectedRevision)) {
    return 'committed';
  }
  return kanbanRevisionsEqual(next.revision, baseline.revision) ? 'pending' : 'contradictory';
}

/** Resolves the post-publication board focus target for one committed structural deletion. */
export function deletionFocusTarget(
  operation: KanbanConfigurationSessionOptions['operation'],
  previous: KanbanConfigurationSnapshot,
  current: KanbanConfigurationSnapshot,
): KanbanConfigurationFocusTarget | undefined {
  if (operation.kind !== 'delete') return undefined;
  return 'columnId' in operation
    ? reconcileKanbanDeletedColumnFocus({
        previousColumnIds: previous.columns.map((column) => column.columnId),
        currentColumnIds: current.columns.map((column) => column.columnId),
        deletedColumnId: operation.columnId,
        focusedColumnId: operation.columnId,
      })
    : reconcileKanbanDeletedSwimlaneFocus({
        previousSwimlaneIds: previous.swimlanes.map((swimlane) => swimlane.swimlaneId),
        currentSwimlaneIds: current.swimlanes.map((swimlane) => swimlane.swimlaneId),
        deletedSwimlaneId: operation.swimlaneId,
        focusedSwimlaneId: operation.swimlaneId,
      });
}

/** Builds the bounded stable destinations shown by package reorder dialogs. */
export function reorderDestinations(
  operation: KanbanConfigurationSessionOptions['operation'],
  snapshot: KanbanConfigurationSnapshot,
): readonly KanbanConfigurationReorderDestination[] {
  if (operation.kind !== 'reorder') return Object.freeze([]);
  if ('columnId' in operation) {
    const remaining = snapshot.columns.filter((column) => column.columnId !== operation.columnId);
    const destinations: KanbanConfigurationReorderDestination[] = [
      Object.freeze({ label: '', position: Object.freeze({ kind: 'start' }) }),
    ];
    for (let index = 0; index + 1 < remaining.length; index += 1) {
      const before = remaining[index];
      const after = remaining[index + 1];
      if (before === undefined || after === undefined) continue;
      destinations.push(
        Object.freeze({
          label: `${before.label} / ${after.label}`,
          position: Object.freeze({
            kind: 'between',
            beforeColumnId: before.columnId,
            afterColumnId: after.columnId,
          }),
        }),
      );
    }
    destinations.push(Object.freeze({ label: '', position: Object.freeze({ kind: 'end' }) }));
    return Object.freeze(destinations);
  }
  const remaining = snapshot.swimlanes.filter(
    (swimlane) => swimlane.mode === 'explicit' && swimlane.swimlaneId !== operation.swimlaneId,
  );
  return Object.freeze([
    Object.freeze({ label: '', position: Object.freeze({ kind: 'start' }) }),
    ...remaining.map((swimlane) =>
      Object.freeze({
        label: swimlane.label,
        position: Object.freeze({ kind: 'before' as const, swimlaneId: swimlane.swimlaneId }),
      }),
    ),
    Object.freeze({ label: '', position: Object.freeze({ kind: 'end' }) }),
  ]);
}

/** Builds valid same-axis reassignment choices for a structural delete workflow. */
export function deletionDestinations(
  operation: KanbanConfigurationSessionOptions['operation'],
  snapshot: KanbanConfigurationSnapshot,
): readonly KanbanConfigurationDeletionDestination[] {
  if (operation.kind !== 'delete') return Object.freeze([]);
  if ('columnId' in operation) {
    return Object.freeze(
      snapshot.columns
        .filter((column) => column.columnId !== operation.columnId)
        .map((column) => Object.freeze({ destinationId: column.columnId, label: column.label })),
    );
  }
  return Object.freeze(
    snapshot.swimlanes
      .filter((swimlane) => swimlane.mode === 'explicit' && swimlane.swimlaneId !== operation.swimlaneId)
      .map((swimlane) => Object.freeze({ destinationId: swimlane.swimlaneId, label: swimlane.label })),
  );
}
