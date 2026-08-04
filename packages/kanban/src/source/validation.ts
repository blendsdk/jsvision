import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidQueryError, KanbanInvalidSourcePublicationError } from '../contract/error.js';
import {
  createKanbanCardKey,
  createKanbanColumnId,
  createKanbanExtensionId,
  createKanbanFieldId,
  createKanbanSwimlaneId,
} from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { kanbanRevisionsEqual, snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import { snapshotKanbanCellAddress } from './address.js';
import { snapshotKanbanBoardCounts, snapshotKanbanCount } from './counts.js';
import { snapshotKanbanPlacement } from './placement.js';
import { snapshotKanbanSourceState } from './states.js';
import type {
  KanbanCardLocation,
  KanbanColumnHeader,
  KanbanColumnMeta,
  KanbanFilter,
  KanbanHeaderBatch,
  KanbanIdentityChange,
  KanbanIdentityChangeBatch,
  KanbanNumericSummary,
  KanbanQuery,
  KanbanSessionPublication,
  KanbanSort,
  KanbanSwimlaneHeader,
  KanbanSwimlaneMeta,
} from './types.js';

/** Stable structural reason-code grammar shared by source publications. */
const REASON_CODE = /^[a-z][a-z0-9-]*$/u;
/** Exact accepted members of a semantic query. */
const QUERY_KEYS = new Set([
  'search',
  'filters',
  'groupBy',
  'sort',
  'visibleColumnIds',
  'visibleSwimlaneIds',
  'viewRevision',
]);
/** Exact accepted members of one filter directive. */
const FILTER_KEYS = new Set(['fieldId', 'operatorId', 'value']);
/** Exact accepted members of one sort directive. */
const SORT_KEYS = new Set(['fieldId', 'direction']);
/** Exact accepted members of column or swimlane metadata. */
const META_KEYS = new Set(['columnId', 'swimlaneId', 'label', 'revision']);
/** Exact accepted members of one column or swimlane header. */
const HEADER_KEYS = new Set(['columnId', 'swimlaneId', 'label', 'wip', 'summaries']);
/** Exact accepted members of one header batch. */
const HEADER_BATCH_KEYS = new Set(['revision', 'columns', 'swimlanes']);
/** Exact accepted members of one identity-change batch. */
const IDENTITY_BATCH_KEYS = new Set(['revision', 'changes']);
/** Exact accepted members of one identity-change record. */
const IDENTITY_CHANGE_KEYS = new Set(['kind', 'cardKey', 'columnId', 'swimlaneId']);
/** Exact accepted members of one bounded card location. */
const LOCATION_KEYS = new Set(['kind', 'address', 'index', 'placement', 'sessionRevision']);
/** Exact accepted members of one atomic session publication. */
const PUBLICATION_KEYS = new Set(['revision', 'state', 'columns', 'swimlanes', 'counts', 'headers', 'identityChanges']);
/** Exact accepted members of one honest numeric summary. */
const NUMERIC_SUMMARY_KEYS = new Set(['scope', 'quality', 'value']);

/** Raises the bounded public error for an invalid query. */
function invalidQuery(): never {
  throw new KanbanInvalidQueryError();
}

/** Raises the bounded public error for an invalid source publication. */
function invalidPublication(): never {
  throw new KanbanInvalidSourcePublicationError();
}

/** Validates one equality-only revision without ordering or string coercion. */
function snapshotRevision(value: unknown): KanbanRevision {
  try {
    return snapshotKanbanRevision(value);
  } catch {
    return invalidPublication();
  }
}

/** Validates one card identity while preserving number/string distinction. */
function snapshotCardKey(value: unknown): CardKey {
  if (typeof value !== 'number' && typeof value !== 'string') return invalidPublication();
  try {
    return createKanbanCardKey(value);
  } catch {
    return invalidPublication();
  }
}

/** Returns a bounded sanitized display label. */
function snapshotLabel(value: unknown): string {
  if (typeof value !== 'string') return invalidPublication();
  return sanitizeContractText(value, 512)
    .replace(/[\t\n]+/gu, ' ')
    .trim();
}

/** Validates a dense array and maps it without retaining caller-owned storage. */
function mapArray<T>(value: unknown, maximumEntries: number, map: (entry: unknown) => T): readonly T[] {
  return Object.freeze(snapshotKanbanDataArray(value, maximumEntries).map(map));
}

/** Validates an optional unique list of structural IDs for a query. */
function snapshotQueryIds(
  value: unknown,
  maximumEntries: number,
  createId: (entry: string) => string,
): readonly string[] {
  const result = mapArray(value, maximumEntries, (entry) => {
    if (typeof entry !== 'string') return invalidQuery();
    try {
      return createId(entry);
    } catch {
      return invalidQuery();
    }
  });
  if (new Set(result).size !== result.length) return invalidQuery();
  return result;
}

/** Validates one detached semantic filter. */
function snapshotFilter(value: unknown): KanbanFilter {
  try {
    const properties = snapshotKanbanDataProperties(value, FILTER_KEYS.size);
    validateKanbanDataKeys(properties, FILTER_KEYS);
    if (
      Object.keys(properties).length !== FILTER_KEYS.size ||
      typeof properties.fieldId !== 'string' ||
      typeof properties.operatorId !== 'string'
    ) {
      return invalidQuery();
    }
    return Object.freeze({
      fieldId: createKanbanFieldId(properties.fieldId),
      operatorId: createKanbanExtensionId(properties.operatorId),
      value: snapshotKanbanSemanticValue(properties.value),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidQueryError) throw error;
    return invalidQuery();
  }
}

/** Validates one detached semantic sort directive. */
function snapshotSort(value: unknown): KanbanSort {
  try {
    const properties = snapshotKanbanDataProperties(value, SORT_KEYS.size);
    validateKanbanDataKeys(properties, SORT_KEYS);
    if (
      Object.keys(properties).length !== SORT_KEYS.size ||
      typeof properties.fieldId !== 'string' ||
      (properties.direction !== 'ascending' && properties.direction !== 'descending')
    ) {
      return invalidQuery();
    }
    return Object.freeze({ fieldId: createKanbanFieldId(properties.fieldId), direction: properties.direction });
  } catch (error) {
    if (error instanceof KanbanInvalidQueryError) throw error;
    return invalidQuery();
  }
}

/**
 * Validates and deeply snapshots one immutable semantic query before a source sees it.
 *
 * Omitted filter and sort arrays normalize to frozen empty arrays.
 */
export function snapshotKanbanQuery(value: unknown): KanbanQuery {
  try {
    const properties = snapshotKanbanDataProperties(value, QUERY_KEYS.size);
    validateKanbanDataKeys(properties, QUERY_KEYS);
    const filters = mapArray(properties.filters ?? [], KANBAN_LIMITS.cardFields.safe, snapshotFilter);
    const sort = mapArray(properties.sort ?? [], KANBAN_LIMITS.cardFields.safe, snapshotSort);
    if (new Set(sort.map((entry) => entry.fieldId)).size !== sort.length) return invalidQuery();

    const search = properties.search;
    if (search !== undefined && typeof search !== 'string') return invalidQuery();
    const groupBy = properties.groupBy;
    if (groupBy !== undefined && typeof groupBy !== 'string') return invalidQuery();
    const viewRevision = properties.viewRevision;
    if (viewRevision !== undefined && typeof viewRevision !== 'string' && typeof viewRevision !== 'number') {
      return invalidQuery();
    }
    return Object.freeze({
      ...(search === undefined ? {} : { search: snapshotKanbanSemanticValue(search) }),
      filters,
      ...(groupBy === undefined ? {} : { groupBy: createKanbanFieldId(groupBy) }),
      sort,
      ...(properties.visibleColumnIds === undefined
        ? {}
        : {
            visibleColumnIds: snapshotQueryIds(
              properties.visibleColumnIds,
              KANBAN_LIMITS.columns.safe,
              createKanbanColumnId,
            ),
          }),
      ...(properties.visibleSwimlaneIds === undefined
        ? {}
        : {
            visibleSwimlaneIds: snapshotQueryIds(
              properties.visibleSwimlaneIds,
              KANBAN_LIMITS.swimlanes.safe,
              createKanbanSwimlaneId,
            ),
          }),
      ...(viewRevision === undefined ? {} : { viewRevision: snapshotQueryRevision(viewRevision) }),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidQueryError) throw error;
    return invalidQuery();
  }
}

/** Validates a query revision while preserving its public query-error boundary. */
function snapshotQueryRevision(value: unknown): KanbanRevision {
  try {
    return snapshotRevision(value);
  } catch {
    return invalidQuery();
  }
}

/** Validates one ordered column metadata record. */
export function snapshotKanbanColumnMeta(value: unknown): KanbanColumnMeta {
  try {
    const properties = snapshotKanbanDataProperties(value, 3);
    validateKanbanDataKeys(properties, META_KEYS);
    if (
      Object.keys(properties).length !== 3 ||
      typeof properties.columnId !== 'string' ||
      properties.swimlaneId !== undefined
    ) {
      return invalidPublication();
    }
    return Object.freeze({
      columnId: createKanbanColumnId(properties.columnId),
      label: snapshotLabel(properties.label),
      revision: snapshotRevision(properties.revision),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Validates one ordered swimlane metadata record. */
export function snapshotKanbanSwimlaneMeta(value: unknown): KanbanSwimlaneMeta {
  try {
    const properties = snapshotKanbanDataProperties(value, 3);
    validateKanbanDataKeys(properties, META_KEYS);
    if (
      Object.keys(properties).length !== 3 ||
      typeof properties.swimlaneId !== 'string' ||
      properties.columnId !== undefined
    ) {
      return invalidPublication();
    }
    return Object.freeze({
      swimlaneId: createKanbanSwimlaneId(properties.swimlaneId),
      label: snapshotLabel(properties.label),
      revision: snapshotRevision(properties.revision),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Validates one numeric summary with explicit authority and quality. */
export function snapshotKanbanNumericSummary(value: unknown): KanbanNumericSummary {
  try {
    const properties = snapshotKanbanDataProperties(value, NUMERIC_SUMMARY_KEYS.size);
    validateKanbanDataKeys(properties, NUMERIC_SUMMARY_KEYS);
    const scope = properties.scope;
    if (scope !== 'authoritative' && scope !== 'loaded-only') return invalidPublication();
    if (properties.quality === 'unknown') {
      if (Object.keys(properties).length !== 2) return invalidPublication();
      return Object.freeze({ scope, quality: 'unknown' });
    }
    if (properties.quality !== 'exact' && properties.quality !== 'estimated' && properties.quality !== 'truncated') {
      return invalidPublication();
    }
    if (
      Object.keys(properties).length !== 3 ||
      typeof properties.value !== 'number' ||
      !Number.isFinite(properties.value)
    ) {
      return invalidPublication();
    }
    return Object.freeze({ scope, quality: properties.quality, value: properties.value });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Snapshots a bounded plain numeric summary map. */
function snapshotSummaries(value: unknown): Readonly<Record<string, KanbanNumericSummary>> {
  const properties = snapshotKanbanDataProperties(value, KANBAN_LIMITS.summarySections.safe);
  const result: Record<string, KanbanNumericSummary> = {};
  for (const [key, entry] of Object.entries(properties)) {
    result[createKanbanFieldId(key)] = snapshotKanbanNumericSummary(entry);
  }
  return Object.freeze(result);
}

/** Validates one column header record. */
function snapshotColumnHeader(value: unknown): KanbanColumnHeader {
  const properties = snapshotKanbanDataProperties(value, HEADER_KEYS.size);
  validateKanbanDataKeys(properties, HEADER_KEYS);
  if (typeof properties.columnId !== 'string' || properties.swimlaneId !== undefined) return invalidPublication();
  return Object.freeze({
    columnId: createKanbanColumnId(properties.columnId),
    label: snapshotLabel(properties.label),
    ...(properties.wip === undefined ? {} : { wip: snapshotKanbanCount(properties.wip) }),
    ...(properties.summaries === undefined ? {} : { summaries: snapshotSummaries(properties.summaries) }),
  });
}

/** Validates one swimlane header record. */
function snapshotSwimlaneHeader(value: unknown): KanbanSwimlaneHeader {
  const properties = snapshotKanbanDataProperties(value, HEADER_KEYS.size);
  validateKanbanDataKeys(properties, HEADER_KEYS);
  if (typeof properties.swimlaneId !== 'string' || properties.columnId !== undefined) return invalidPublication();
  return Object.freeze({
    swimlaneId: createKanbanSwimlaneId(properties.swimlaneId),
    label: snapshotLabel(properties.label),
    ...(properties.wip === undefined ? {} : { wip: snapshotKanbanCount(properties.wip) }),
    ...(properties.summaries === undefined ? {} : { summaries: snapshotSummaries(properties.summaries) }),
  });
}

/** Validates, detaches, and freezes one complete header batch. */
export function snapshotKanbanHeaderBatch(value: unknown): KanbanHeaderBatch {
  try {
    const properties = snapshotKanbanDataProperties(value, HEADER_BATCH_KEYS.size);
    validateKanbanDataKeys(properties, HEADER_BATCH_KEYS);
    if (Object.keys(properties).length !== HEADER_BATCH_KEYS.size) return invalidPublication();
    return Object.freeze({
      revision: snapshotRevision(properties.revision),
      columns: mapArray(properties.columns, KANBAN_LIMITS.columns.safe, snapshotColumnHeader),
      swimlanes: mapArray(properties.swimlanes, KANBAN_LIMITS.swimlanes.safe, snapshotSwimlaneHeader),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Validates one authoritative identity deletion record. */
function snapshotIdentityChange(value: unknown): KanbanIdentityChange {
  const properties = snapshotKanbanDataProperties(value, IDENTITY_CHANGE_KEYS.size);
  validateKanbanDataKeys(properties, IDENTITY_CHANGE_KEYS);
  if (properties.kind === 'deleted-card' && Object.keys(properties).length === 2) {
    return Object.freeze({ kind: 'deleted-card', cardKey: snapshotCardKey(properties.cardKey) });
  }
  if (
    properties.kind === 'deleted-column' &&
    Object.keys(properties).length === 2 &&
    typeof properties.columnId === 'string'
  ) {
    return Object.freeze({ kind: 'deleted-column', columnId: createKanbanColumnId(properties.columnId) });
  }
  if (
    properties.kind === 'deleted-swimlane' &&
    Object.keys(properties).length === 2 &&
    typeof properties.swimlaneId === 'string'
  ) {
    return Object.freeze({ kind: 'deleted-swimlane', swimlaneId: createKanbanSwimlaneId(properties.swimlaneId) });
  }
  return invalidPublication();
}

/** Validates and freezes one bounded authoritative identity-change batch atomically. */
export function snapshotKanbanIdentityChangeBatch(value: unknown): KanbanIdentityChangeBatch {
  try {
    const properties = snapshotKanbanDataProperties(value, IDENTITY_BATCH_KEYS.size);
    validateKanbanDataKeys(properties, IDENTITY_BATCH_KEYS);
    if (Object.keys(properties).length !== IDENTITY_BATCH_KEYS.size) return invalidPublication();
    const changes = mapArray(properties.changes, KANBAN_LIMITS.selectedKeys.safe, snapshotIdentityChange);
    const identities = changes.map((change) => {
      if (change.kind === 'deleted-card') return ['card', change.cardKey] as const;
      if (change.kind === 'deleted-column') return ['column', change.columnId] as const;
      return ['swimlane', change.swimlaneId] as const;
    });
    const seen = new Map<string | number, Set<string>>();
    for (const [kind, identity] of identities) {
      const kinds = seen.get(identity) ?? new Set<string>();
      if (kinds.has(kind)) return invalidPublication();
      kinds.add(kind);
      seen.set(identity, kinds);
    }
    return Object.freeze({ revision: snapshotRevision(properties.revision), changes });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Validates and freezes one bounded, revision-bound card-location result. */
export function snapshotKanbanCardLocation(value: unknown): KanbanCardLocation {
  try {
    const properties = snapshotKanbanDataProperties(value, LOCATION_KEYS.size);
    validateKanbanDataKeys(properties, LOCATION_KEYS);
    const sessionRevision = snapshotRevision(properties.sessionRevision);
    if (properties.kind === 'unknown' || properties.kind === 'unsupported') {
      if (Object.keys(properties).length !== 2) return invalidPublication();
      return Object.freeze({ kind: properties.kind, sessionRevision });
    }
    if (properties.kind !== 'found' && properties.kind !== 'unloaded') return invalidPublication();
    const index = properties.index;
    if (index !== undefined && (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0)) {
      return invalidPublication();
    }
    return Object.freeze({
      kind: properties.kind,
      address: snapshotKanbanCellAddress(properties.address),
      ...(index === undefined ? {} : { index }),
      ...(properties.placement === undefined ? {} : { placement: snapshotKanbanPlacement(properties.placement) }),
      sessionRevision,
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Validates, detaches, and freezes one atomic session metadata publication. */
export function snapshotKanbanSessionPublication(value: unknown): KanbanSessionPublication {
  try {
    const properties = snapshotKanbanDataProperties(value, PUBLICATION_KEYS.size);
    validateKanbanDataKeys(properties, PUBLICATION_KEYS);
    if (Object.keys(properties).length !== PUBLICATION_KEYS.size) return invalidPublication();
    const revision = snapshotRevision(properties.revision);
    const columns = mapArray(properties.columns, KANBAN_LIMITS.columns.safe, snapshotKanbanColumnMeta);
    const swimlanes = mapArray(properties.swimlanes, KANBAN_LIMITS.swimlanes.safe, snapshotKanbanSwimlaneMeta);
    if (new Set(columns.map((entry) => entry.columnId)).size !== columns.length) return invalidPublication();
    if (new Set(swimlanes.map((entry) => entry.swimlaneId)).size !== swimlanes.length) return invalidPublication();
    const headers = snapshotKanbanHeaderBatch(properties.headers);
    const identityChanges = snapshotKanbanIdentityChangeBatch(properties.identityChanges);
    if (
      !kanbanRevisionsEqual(headers.revision, revision) ||
      !kanbanRevisionsEqual(identityChanges.revision, revision)
    ) {
      return invalidPublication();
    }
    const columnIds = new Set(columns.map((entry) => entry.columnId));
    const swimlaneIds = new Set(swimlanes.map((entry) => entry.swimlaneId));
    const headerColumnIds = new Set(headers.columns.map((entry) => entry.columnId));
    const headerSwimlaneIds = new Set(headers.swimlanes.map((entry) => entry.swimlaneId));
    if (
      headerColumnIds.size !== headers.columns.length ||
      headerSwimlaneIds.size !== headers.swimlanes.length ||
      headerColumnIds.size !== columnIds.size ||
      headerSwimlaneIds.size !== swimlaneIds.size ||
      [...headerColumnIds].some((id) => !columnIds.has(id)) ||
      [...headerSwimlaneIds].some((id) => !swimlaneIds.has(id))
    ) {
      return invalidPublication();
    }
    return Object.freeze({
      revision,
      state: snapshotKanbanSourceState(properties.state),
      columns,
      swimlanes,
      counts: snapshotKanbanBoardCounts(properties.counts),
      headers,
      identityChanges,
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Returns true only for an allowlisted source reason code. */
export function isKanbanSourceReasonCode(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 128 && REASON_CODE.test(value);
}
